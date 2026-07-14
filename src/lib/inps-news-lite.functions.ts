import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Layer NOTIZIE INPS — versione LITE (senza Firecrawl, senza AI)
//
// Fetch diretto dell'HTML di inps.it, estrazione link con regex, parse del
// testo con regex leggeri. Zero crediti Firecrawl e zero crediti Lovable AI:
// consuma solo CPU del Worker. Utile finché i crediti Firecrawl sono bloccati.
// Riusa la stessa tabella `inps_news_queue` e `sources` (source_type = notizia)
// del cron ufficiale, così quando Firecrawl torna online tutto è già allineato.
// ---------------------------------------------------------------------------

const BASE = "https://www.inps.it";
const LIST_JSON = `${BASE}/it/it/inps-comunica/notizie.cfListDynamic.search.json`;
const QUEUE = "inps_news_queue" as const;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return await res.text();
}

// La lista notizie è caricata via AJAX dall'endpoint AEM cfListDynamic.
// paginaDettaglio arriva come "/content/inps-site/it/it/..." → normalizziamo
// all'URL pubblico "https://www.inps.it/it/it/...".
type NewsListItem = {
  paginaDettaglio?: string;
  title?: string;
  description?: string;
  metadata?: { dataDiPubblicazione?: number };
};
type NewsListResponse = {
  items: NewsListItem[];
  totResult: number;
  numPages: number;
  currentPage: number;
};

async function fetchNewsListPage(pageNumber: number, maxItems = 100): Promise<NewsListResponse> {
  const url = `${LIST_JSON}?pageNumber=${pageNumber}&maxItems=${maxItems}`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json,text/plain,*/*" },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return (await res.json()) as NewsListResponse;
}

function normalizeDetailUrl(paginaDettaglio: string | undefined): string | null {
  if (!paginaDettaglio) return null;
  let p = paginaDettaglio.replace(/^\/content\/inps-site/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.toLowerCase().endsWith(".html")) return null;
  return `${BASE}${p}`;
}

function buildExternalId(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `inps-news-${hash}`;
}

function extractNewsLinks(html: string): string[] {
  const out = new Set<string>();
  const matches = html.match(NEWS_URL_REGEX) ?? [];
  for (const raw of matches) {
    const path = raw.split("#")[0].split("?")[0];
    if (!path.toLowerCase().endsWith(".html")) continue;
    out.add(`${BASE}${path.startsWith("/") ? path : `/${path}`}`);
  }
  return Array.from(out);
}

// Rimuove tag script/style e collassa i tag HTML in testo semplice
function htmlToText(html: string): string {
  let t = html;
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Isola il contenuto principale se presente
  const mainMatch = t.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    ?? t.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (mainMatch) t = mainMatch[1];
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|h[1-6]|section)>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
       .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return htmlToText(h1[1]).slice(0, 250);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? t[1].replace(/\s+\|\s+INPS.*$/i, "").trim().slice(0, 250) : "INPS — notizia";
}

function extractDescription(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim().slice(0, 500);
  const d = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return d ? d[1].trim().slice(0, 500) : "";
}

const MESI: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05", giugno: "06",
  luglio: "07", agosto: "08", settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};
function extractDate(text: string, url: string): string {
  const um = url.match(/\/notizie\/(\d{4})[\.\/](\d{2})[\.\/]/);
  let fallback: string | null = null;
  if (um) fallback = `${um[1]}-${um[2]}-01`;
  const t = text.slice(0, 4000).toLowerCase();
  const m1 = t.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/);
  if (m1) return `${m1[3]}-${MESI[m1[2]]}-${m1[1].padStart(2, "0")}`;
  const m2 = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return fallback ?? new Date().toISOString().slice(0, 10);
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
    "Bonus Asilo": ["bonus asilo nido"],
    Maternità: ["maternit", "congedo parentale"],
    Disabilità: ["disabilit", "invalidit", "legge 104"],
    Lavoro: ["lavoro", "contratto"],
    Imprese: ["imprese", "artigiani", "commercianti", "uniemens"],
  };
  for (const [tag, kws] of Object.entries(map)) if (kws.some((k) => t.includes(k))) out.push(tag);
  return out;
}

// ---------------------------------------------------------------------------
// Discovery lite: fetcha ENTRY (e opzionalmente pagine paginate) e collect URLs
// ---------------------------------------------------------------------------
const DiscoverInput = z.object({
  pages: z.number().int().min(1).max(20).default(1),
});

export const discoverInpsNewsLite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const errors: string[] = [];
    const found = new Set<string>();

    const urls: string[] = [ENTRY];
    // Prova varianti paginazione comuni (INPS usa spesso ?p= o pageNumber=)
    for (let p = 1; p < data.pages; p++) {
      urls.push(`${ENTRY}?p=${p}`);
      urls.push(`${ENTRY}?pageNumber=${p}`);
    }

    for (const u of urls) {
      try {
        const html = await fetchHtml(u);
        for (const link of extractNewsLinks(html)) found.add(link);
      } catch (e) {
        errors.push(`${u}: ${(e as Error).message}`);
      }
    }

    const list = Array.from(found);
    // Quante già presenti nel corpus
    const externalIds = list.map((u) => buildExternalId(u));
    let inCorpus = 0;
    const CHUNK_Q = 200;
    for (let i = 0; i < externalIds.length; i += CHUNK_Q) {
      const slice = externalIds.slice(i, i + CHUNK_Q);
      const { data: exist } = await supabaseAdmin
        .from("sources")
        .select("external_id")
        .in("external_id", slice);
      inCorpus += (exist ?? []).length;
    }

    const rows = list.map((url) => ({ url, status: "pending" }));
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
      totalLinksSeen: list.length,
      matched: list.length,
      inCorpus,
      newEnqueued,
      errors: errors.slice(0, 10),
    };
  });

// ---------------------------------------------------------------------------
// Batch lite: pop `limit` URL pending, fetch HTML, upsert
// ---------------------------------------------------------------------------
const BatchInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  concurrency: z.number().int().min(1).max(6).default(4),
});

async function ingestOne(url: string): Promise<
  | { ok: true; created: boolean; external_id: string; title: string }
  | { ok: false; url: string; reason: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const external_id = buildExternalId(url);
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id, title")
    .eq("external_id", external_id)
    .maybeSingle();
  if (existing) return { ok: true, created: false, external_id, title: existing.title };

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    return { ok: false, url, reason: (e as Error).message };
  }
  const title = extractTitle(html);
  const description = extractDescription(html);
  const text = htmlToText(html);
  if (text.length < 150) return { ok: false, url, reason: `testo estratto vuoto (${text.length} chars)` };

  const fullText = text.slice(0, 60000);
  const topics = guessTopicTags(`${title} ${text.slice(0, 4000)}`);
  const publication_date = extractDate(text, url);

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

export const batchIngestNewsLite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BatchInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pending, error } = await (supabaseAdmin as any).from(QUEUE)
      .select("id, url")
      .eq("status", "pending")
      .order("discovered_at", { ascending: false })
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
          const r = await ingestOne(row.url);
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
