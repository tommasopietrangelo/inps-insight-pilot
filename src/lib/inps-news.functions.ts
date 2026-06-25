import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Layer NOTIZIE INPS
//
// Scarica le notizie pubblicate in /it/it/inps-comunica/notizie/ tramite
// Firecrawl, le accoda in `inps_news_queue` e poi le importa nel corpus
// (`sources.source_type = 'notizia'`, `corpus_layer = 'operativo'`).
// Stesso modello a discovery + batch usato per il layer operativo:
//   1) discoverInpsNews   → Firecrawl map (entry + base con keyword)
//   2) batchIngestNews    → scrape + upsert in `sources`
//   3) getNewsQueueStats  → contatori per la UI
// ---------------------------------------------------------------------------

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";
const BASE = "https://www.inps.it";
const ENTRY = `${BASE}/it/it/inps-comunica/notizie.html`;
const QUEUE = "inps_news_queue" as const;

// URL di una notizia INPS: vivono sotto /it/it/inps-comunica/notizie/...html
// es: /it/it/inps-comunica/notizie/dettaglio.news.2025.11.titolo_xxxx.html
const NEWS_URL_REGEX =
  /^\/it\/it\/inps-comunica\/notizie\/[^\s"'<>]+\.html$/i;

function requireFirecrawlKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configurata");
  return key;
}

type ScrapeResult = {
  markdown?: string;
  links?: string[];
  metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number };
};

async function firecrawlScrape(url: string): Promise<ScrapeResult> {
  const key = requireFirecrawlKey();
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { success?: boolean; data?: ScrapeResult; error?: string };
  if (!json.success || !json.data) throw new Error(`Firecrawl scrape failed: ${json.error ?? "unknown"}`);
  return json.data;
}

async function firecrawlMap(url: string, search: string | undefined, limit = 5000): Promise<string[]> {
  const key = requireFirecrawlKey();
  for (let attempt = 0; attempt < 4; attempt++) {
    const body: Record<string, unknown> = { url, limit, includeSubdomains: false };
    if (search) body.search = search;
    const res = await fetch(`${FIRECRAWL_BASE}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const text = await res.text();
      const m = text.match(/retry after (\d+)s/i);
      await new Promise((r) => setTimeout(r, ((m ? Number(m[1]) : 30) + 1) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as {
      success?: boolean;
      links?: Array<string | { url: string }>;
      data?: { links?: Array<string | { url: string }> };
    };
    const raw = json.links ?? json.data?.links ?? [];
    return raw.map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean);
  }
  throw new Error("Firecrawl map: rate limit persistente");
}

function buildExternalId(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `inps-news-${hash}`;
}

function guessTopicTags(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  const map: Record<string, string[]> = {
    ADI: ["adi", "assegno di inclusione"],
    NASpI: ["naspi"],
    "Assegno Unico": ["assegno unico", "auu"],
    ISEE: ["isee", "dsu"],
    Pensioni: ["pensione", "pensioni"],
    SFL: ["supporto formazione", "sfl"],
    "Bonus Asilo": ["bonus asilo nido", "asilo nido"],
    Maternità: ["maternit", "congedo parentale"],
    Disabilità: ["disabilit", "invalidit", "legge 104"],
    Lavoro: ["lavoro", "contratto"],
    Imprese: ["imprese", "artigiani", "commercianti", "uniemens"],
  };
  for (const [tag, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) out.push(tag);
  }
  return out;
}

// Cerca una data nel markdown (formato "12 giugno 2026", "12/06/2026")
const MESI: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05", giugno: "06",
  luglio: "07", agosto: "08", settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};
function extractDate(text: string, url: string): string {
  // YYYY/MM in URL: /notizie/2025/11/...
  const um = url.match(/\/notizie\/(\d{4})\/(\d{2})\//);
  let fallback: string | null = null;
  if (um) fallback = `${um[1]}-${um[2]}-01`;

  const t = text.slice(0, 4000).toLowerCase();
  const m1 = t.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/);
  if (m1) {
    const dd = m1[1].padStart(2, "0");
    return `${m1[3]}-${MESI[m1[2]]}-${dd}`;
  }
  const m2 = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return fallback ?? new Date().toISOString().slice(0, 10);
}

async function ingestSingle(url: string): Promise<
  | { ok: true; created: boolean; external_id: string; title: string }
  | { ok: false; url: string; reason: string }
> {
  const external_id = buildExternalId(url);
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id, title")
    .eq("external_id", external_id)
    .maybeSingle();
  if (existing) return { ok: true, created: false, external_id, title: existing.title };

  const page = await firecrawlScrape(url);
  const md = (page.markdown ?? "").trim();
  if (md.length < 150) return { ok: false, url, reason: `markdown vuoto (${md.length} chars)` };

  const rawTitle = page.metadata?.title?.replace(/\s+\|\s+INPS.*$/i, "").trim() || "INPS — notizia";
  const title = rawTitle.length > 250 ? rawTitle.slice(0, 247) + "…" : rawTitle;
  const fullText = md.slice(0, 60000);
  const description = page.metadata?.description?.slice(0, 500) ?? "";
  const topics = guessTopicTags(`${title} ${md.slice(0, 4000)}`);
  const publication_date = extractDate(md, url);

  const { data: upserted, error } = await supabaseAdmin
    .from("sources")
    .upsert(
      {
        external_id,
        title,
        source_type: "notizia",
        document_number: null,
        publication_date,
        topic_tags: topics,
        summary: description || fullText.slice(0, 500),
        excerpt: fullText.slice(0, 800),
        full_text: fullText,
        official_url: url,
        corpus_layer: "operativo",
      } as any,
      { onConflict: "external_id" },
    )
    .select("id, title, external_id")
    .single();
  if (error) return { ok: false, url, reason: error.message };

  await supabaseAdmin.from("chunks").delete().eq("source_id", upserted.id);
  return { ok: true, created: true, external_id: upserted.external_id!, title: upserted.title };
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const DiscoverInput = z.object({
  limit: z.number().int().min(100).max(10000).default(5000),
});

export const discoverInpsNews = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const errors: string[] = [];
    const allSeen = new Set<string>();
    const matched = new Set<string>();
    const normalize = (raw: string) => raw.split("#")[0].split("?")[0];
    const isInps = (u: string) => /^https?:\/\/(www\.)?inps\.it\//i.test(u);

    const calls: Array<{ url: string; search?: string; label: string }> = [
      { url: ENTRY, search: undefined, label: "entry" },
      { url: BASE, search: "notizia comunicato stampa news inps-comunica", label: "base+search" },
      { url: `${BASE}/it/it/inps-comunica`, search: undefined, label: "inps-comunica" },
    ];

    for (const c of calls) {
      try {
        const links = await firecrawlMap(c.url, c.search, data.limit);
        for (const raw of links) {
          const clean = normalize(raw);
          if (!isInps(clean)) continue;
          allSeen.add(clean);
          const path = clean.replace(/^https?:\/\/(www\.)?inps\.it/i, "");
          if (NEWS_URL_REGEX.test(path)) matched.add(clean);
        }
      } catch (e) {
        errors.push(`${c.label}: ${(e as Error).message}`);
      }
    }

    const matchedList = Array.from(matched);

    // Quante sono già nel corpus
    const externalIds = matchedList.map((u) => buildExternalId(u));
    let inCorpus = 0;
    const CHUNK_Q = 200;
    for (let i = 0; i < externalIds.length; i += CHUNK_Q) {
      const slice = externalIds.slice(i, i + CHUNK_Q);
      const { data: exist, error } = await supabaseAdmin
        .from("sources")
        .select("external_id")
        .in("external_id", slice);
      if (error) {
        errors.push(`in-corpus check: ${error.message}`);
        continue;
      }
      inCorpus += (exist ?? []).length;
    }

    const rows = matchedList.map((url) => ({ url, status: "pending" }));
    let newEnqueued = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { data: ins, error } = await (supabaseAdmin as any).from(QUEUE)
        .upsert(slice, { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) errors.push(`enqueue ${i}: ${error.message}`);
      else newEnqueued += (ins as unknown[] | null)?.length ?? 0;
    }

    return {
      totalLinksSeen: allSeen.size,
      matched: matched.size,
      ignored: allSeen.size - matched.size,
      inCorpus,
      newEnqueued,
      errors: errors.slice(0, 10),
    };
  });

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

const BatchInput = z.object({
  limit: z.number().int().min(1).max(40).default(20),
  concurrency: z.number().int().min(1).max(6).default(4),
});

export const batchIngestNews = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BatchInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { data: pending, error } = await (supabaseAdmin as any).from(QUEUE)
      .select("id, url")
      .eq("status", "pending")
      .order("discovered_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const rows = (pending as Array<{ id: string; url: string }> | null) ?? [];

    let created = 0, skipped = 0, failed = 0;
    let idx = 0;
    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= rows.length) return;
        const row = rows[i];
        try {
          const r = await ingestSingle(row.url);
          if (r.ok) {
            await (supabaseAdmin as any).from(QUEUE).update({
              status: r.created ? "done" : "skipped",
              external_id: r.external_id,
              processed_at: new Date().toISOString(),
              error: null,
            }).eq("id", row.id);
            if (r.created) created++; else skipped++;
          } else {
            failed++;
            await (supabaseAdmin as any).from(QUEUE).update({
              status: "error",
              error: r.reason.slice(0, 500),
              processed_at: new Date().toISOString(),
            }).eq("id", row.id);
          }
        } catch (e) {
          failed++;
          await (supabaseAdmin as any).from(QUEUE).update({
            status: "error",
            error: (e as Error).message.slice(0, 500),
            processed_at: new Date().toISOString(),
          }).eq("id", row.id);
        }
      }
    };
    const pool = Math.min(data.concurrency, rows.length);
    await Promise.all(Array.from({ length: pool }, () => worker()));

    const { count: remainingCount } = await (supabaseAdmin as any).from(QUEUE)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return {
      processed: rows.length,
      created,
      skipped,
      failed,
      remaining: remainingCount ?? 0,
    };
  });

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getNewsQueueStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any).from(QUEUE).select("status");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ status: string }>;
    const stats = { pending: 0, done: 0, skipped: 0, error: 0, total: 0 };
    for (const r of rows) {
      stats.total++;
      if (r.status === "pending") stats.pending++;
      else if (r.status === "done") stats.done++;
      else if (r.status === "skipped") stats.skipped++;
      else if (r.status === "error") stats.error++;
    }
    const { count: corpusCount } = await supabaseAdmin
      .from("sources")
      .select("id", { count: "exact", head: true } as any)
      .eq("source_type" as any, "notizia");
    return { ...stats, corpusTotal: corpusCount ?? 0 };
  });

// ---------------------------------------------------------------------------
// Daily auto-ingest (cron)
// Discovery + batch automatico delle notizie INPS. Lanciato dal cron quando
// `ingest-news-daily` è attivo. Limita gli scrape giornalieri per non
// esplodere i crediti Firecrawl.
// ---------------------------------------------------------------------------

const DailyInput = z.object({
  scrapeLimit: z.number().int().min(0).max(200).default(30),
  concurrency: z.number().int().min(1).max(6).default(3),
});

export const ingestNewsDaily = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DailyInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    // 1) Discovery
    let discovery: { totalLinksSeen: number; matched: number; newEnqueued: number; errors: string[] } = {
      totalLinksSeen: 0, matched: 0, newEnqueued: 0, errors: [],
    };
    try {
      const allSeen = new Set<string>();
      const matched = new Set<string>();
      const normalize = (raw: string) => raw.split("#")[0].split("?")[0];
      const isInps = (u: string) => /^https?:\/\/(www\.)?inps\.it\//i.test(u);
      const errors: string[] = [];
      const calls: Array<{ url: string; search?: string; label: string }> = [
        { url: ENTRY, search: undefined, label: "entry" },
        { url: BASE, search: "notizia comunicato stampa news inps-comunica", label: "base+search" },
      ];
      for (const c of calls) {
        try {
          const links = await firecrawlMap(c.url, c.search, 5000);
          for (const raw of links) {
            const clean = normalize(raw);
            if (!isInps(clean)) continue;
            allSeen.add(clean);
            const path = clean.replace(/^https?:\/\/(www\.)?inps\.it/i, "");
            if (NEWS_URL_REGEX.test(path)) matched.add(clean);
          }
        } catch (e) {
          errors.push(`${c.label}: ${(e as Error).message}`);
        }
      }
      const rows = Array.from(matched).map((url) => ({ url, status: "pending" }));
      let newEnqueued = 0;
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { data: ins, error } = await (supabaseAdmin as any).from(QUEUE)
          .upsert(slice, { onConflict: "url", ignoreDuplicates: true })
          .select("id");
        if (error) errors.push(`enqueue ${i}: ${error.message}`);
        else newEnqueued += (ins as unknown[] | null)?.length ?? 0;
      }
      discovery = {
        totalLinksSeen: allSeen.size,
        matched: matched.size,
        newEnqueued,
        errors: errors.slice(0, 5),
      };
    } catch (e) {
      discovery.errors.push((e as Error).message);
    }

    // 2) Batch ingest (al massimo `scrapeLimit` URL pending)
    let created = 0, skipped = 0, failed = 0;
    if (data.scrapeLimit > 0) {
      const { data: pending } = await (supabaseAdmin as any).from(QUEUE)
        .select("id, url")
        .eq("status", "pending")
        .order("discovered_at", { ascending: false })
        .limit(data.scrapeLimit);
      const rows = (pending as Array<{ id: string; url: string }> | null) ?? [];
      let idx = 0;
      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= rows.length) return;
          const row = rows[i];
          try {
            const r = await ingestSingle(row.url);
            if (r.ok) {
              await (supabaseAdmin as any).from(QUEUE).update({
                status: r.created ? "done" : "skipped",
                external_id: r.external_id,
                processed_at: new Date().toISOString(),
                error: null,
              }).eq("id", row.id);
              if (r.created) created++; else skipped++;
            } else {
              failed++;
              await (supabaseAdmin as any).from(QUEUE).update({
                status: "error",
                error: r.reason.slice(0, 500),
                processed_at: new Date().toISOString(),
              }).eq("id", row.id);
            }
          } catch (e) {
            failed++;
            await (supabaseAdmin as any).from(QUEUE).update({
              status: "error",
              error: (e as Error).message.slice(0, 500),
              processed_at: new Date().toISOString(),
            }).eq("id", row.id);
          }
        }
      };
      const pool = Math.min(data.concurrency, rows.length);
      await Promise.all(Array.from({ length: pool }, () => worker()));
    }

    return { discovery, ingest: { created, skipped, failed } };
  });
