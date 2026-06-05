import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// INPS scraper via Firecrawl
//
// La pagina ufficiale "Circolari, messaggi e normativa" di INPS è paginata
// via JavaScript/AJAX, quindi un semplice fetch HTML restituisce solo la
// prima pagina. Usiamo Firecrawl (`map` + `scrape`) per:
//   - backfill: scoprire URL di circolari e messaggi pubblicati negli ultimi
//     24 mesi e importarli (dedup su external_id);
//   - cron giornaliero: scraping della pagina di elenco per intercettare le
//     pubblicazioni nuove.
// I PDF allegati vengono parsati automaticamente da Firecrawl in markdown.
// ---------------------------------------------------------------------------

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

function requireFirecrawlKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY non configurata");
  return key;
}

type ScrapeResult = {
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    publishedTime?: string;
    statusCode?: number;
  };
};

async function firecrawlScrape(url: string, opts?: { onlyMainContent?: boolean; waitFor?: number }): Promise<ScrapeResult> {
  const key = requireFirecrawlKey();
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: opts?.onlyMainContent ?? true,
      waitFor: opts?.waitFor,
      parsers: ["pdf"],
    }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { success?: boolean; data?: ScrapeResult; error?: string };
  if (!json.success || !json.data) throw new Error(`Firecrawl scrape failed: ${json.error ?? "unknown"}`);
  return json.data;
}

async function firecrawlMap(url: string, search: string, limit = 200): Promise<string[]> {
  const key = requireFirecrawlKey();
  // Retry automatico sui 429 (rate limit Firecrawl: 6 req/min sul piano standard).
  // Rispettiamo il "retry after Ns" indicato nel messaggio di errore.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${FIRECRAWL_BASE}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, search, limit, includeSubdomains: false }),
    });
    if (res.status === 429) {
      const text = await res.text();
      const m = text.match(/retry after (\d+)s/i);
      const waitMs = (m ? Number(m[1]) : 30) * 1000 + 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { success?: boolean; links?: Array<string | { url: string }>; data?: { links?: Array<string | { url: string }> } };
    const raw = json.links ?? json.data?.links ?? [];
    return raw.map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean);
  }
  throw new Error("Firecrawl map: rate limit persistente dopo 4 tentativi");
}

// ---------- URL → external_id ----------

type AttoMeta = {
  kind: "circolare" | "messaggio" | "normativa" | "decreto" | "pagina_servizio";
  number: string | null;
  year: number | null;
  date: string | null; // YYYY-MM-DD
};

function parseInpsUrl(url: string): AttoMeta {
  const lower = url.toLowerCase();
  let kind: AttoMeta["kind"] = "pagina_servizio";
  if (lower.includes("circolare")) kind = "circolare";
  else if (lower.includes("messaggio")) kind = "messaggio";
  else if (lower.includes("decreto")) kind = "decreto";
  else if (lower.includes("legge") || lower.includes("normativa")) kind = "normativa";

  // Pattern tipico: ".../circolare-numero-58-del-20-05-2026_15274.html"
  //                ".../messaggio-numero-1794-del-28-05-2026_15211.html"
  const m = lower.match(/numero[-\s]?(\d{1,5})[-\s_]+del[-\s_]+(\d{2})[-\s_](\d{2})[-\s_](\d{4})/);
  if (m) {
    return { kind, number: m[1], year: Number(m[4]), date: `${m[4]}-${m[3]}-${m[2]}` };
  }
  const m2 = lower.match(/n[-_.]?(\d{1,5})[-_.](?:del[-_.])?(\d{4})/);
  if (m2) return { kind, number: m2[1], year: Number(m2[2]), date: null };
  return { kind, number: null, year: null, date: null };
}

function buildExternalId(meta: AttoMeta, fallbackUrl: string): string {
  const prefix = meta.kind === "circolare" ? "circ" : meta.kind === "messaggio" ? "msg" : meta.kind === "decreto" ? "dec" : "doc";
  if (meta.number && meta.year) return `inps-${prefix}-${meta.number}-${meta.year}`;
  const hash = Buffer.from(fallbackUrl).toString("base64url").slice(0, 14);
  return `inps-${prefix}-${hash}`;
}

const months: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05", giugno: "06",
  luglio: "07", agosto: "08", settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

function detectDateFromText(text: string, fallback: string | null): string {
  if (fallback) return fallback;
  const m = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
  if (m) return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  const m2 = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return new Date().toISOString().slice(0, 10);
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
    Contribuzione: ["contribut", "aliquota"],
    "Bonus Asilo": ["bonus asilo nido", "asilo nido"],
    "Maternità": ["maternit", "congedo parentale"],
  };
  for (const [tag, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) out.push(tag);
  }
  return out;
}

// ---------- ingest single URL via Firecrawl ----------

async function ingestSingleInps(url: string): Promise<
  | { ok: true; created: boolean; external_id: string; title: string }
  | { ok: false; url: string; reason: string }
> {
  const meta = parseInpsUrl(url);
  if (meta.kind === "pagina_servizio") return { ok: false, url, reason: "non è un atto" };

  const external_id = buildExternalId(meta, url);

  // Dedup PRIMA dello scrape: risparmia crediti Firecrawl sui 25 già in DB
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id, title")
    .eq("external_id", external_id)
    .maybeSingle();
  if (existing) return { ok: true, created: false, external_id, title: existing.title };

  const scraped = await firecrawlScrape(url, { onlyMainContent: true });
  const md = (scraped.markdown ?? "").trim();
  if (md.length < 400) return { ok: false, url, reason: `markdown vuoto (${md.length} chars)` };

  const title = scraped.metadata?.title?.replace(/\s+\|\s+INPS.*$/i, "").trim() || `INPS ${meta.kind} ${meta.number ?? ""}`.trim();
  const fullText = md.slice(0, 60000);
  const date = detectDateFromText(`${title}\n${md.slice(0, 2000)}`, meta.date);
  const description = scraped.metadata?.description?.slice(0, 500) ?? "";
  const topics = guessTopicTags(`${title} ${md.slice(0, 4000)}`);

  const { data: upserted, error } = await supabaseAdmin
    .from("sources")
    .upsert(
      {
        external_id,
        title,
        source_type: meta.kind,
        document_number: meta.number,
        publication_date: date,
        topic_tags: topics,
        summary: description || fullText.slice(0, 500),
        excerpt: fullText.slice(0, 800),
        full_text: fullText,
        official_url: url,
      },
      { onConflict: "external_id" },
    )
    .select("id, title, external_id")
    .single();
  if (error) return { ok: false, url, reason: error.message };

  // Stale chunks via re-embedding al prossimo "Aggiorna indice"
  await supabaseAdmin.from("chunks").delete().eq("source_id", upserted.id);

  return { ok: true, created: true, external_id: upserted.external_id!, title: upserted.title };
}

// ---------- Backfill 24 mesi ----------

const BackfillInput = z.object({
  limit: z.number().int().min(1).max(400).default(100),
  kinds: z.array(z.enum(["circolare", "messaggio"])).default(["circolare", "messaggio"]),
});

export const backfillInpsViaFirecrawl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BackfillInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const discovered = new Set<string>();
    for (const kind of data.kinds) {
      const term = kind === "circolare" ? "circolare numero del" : "messaggio numero del";
      try {
        const links = await firecrawlMap("https://www.inps.it", term, 300);
        for (const l of links) {
          if (/inps\.it\/.+(circolare|messaggio).*\d/i.test(l)) discovered.add(l.split("#")[0].split("?")[0]);
        }
      } catch (e) {
        console.error(`map ${kind} failed`, e);
      }
    }

    // Filtra solo atti degli ultimi 24 mesi sulla base del pattern URL
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    const candidates: string[] = [];
    for (const url of discovered) {
      const meta = parseInpsUrl(url);
      if (!meta.year) continue;
      if (meta.date) {
        const d = new Date(meta.date);
        if (!isNaN(d.getTime()) && d >= cutoff) candidates.push(url);
      } else if (meta.year >= cutoff.getFullYear()) {
        candidates.push(url);
      }
    }
    candidates.sort().reverse(); // più recenti prima
    const toProcess = candidates.slice(0, data.limit);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const url of toProcess) {
      try {
        const r = await ingestSingleInps(url);
        if (r.ok) {
          if (r.created) created++; else skipped++;
        } else {
          errors.push(`${url}: ${r.reason}`);
        }
      } catch (e) {
        errors.push(`${url}: ${(e as Error).message}`);
      }
    }

    return {
      discovered: discovered.size,
      eligible: candidates.length,
      processed: toProcess.length,
      created,
      skipped,
      errors: errors.slice(0, 10),
    };
  });

// ---------- Cron giornaliero: nuove pubblicazioni ----------

export const ingestInpsDaily = createServerFn({ method: "POST" })
  .handler(async () => {
    // Strategia: scopriamo gli atti pubblicati negli ultimi 14 giorni
    // (circolari + messaggi con query separate per non perderne nessuno),
    // ordiniamo per data REALE estratta dall'URL (più recente prima) e
    // ingeriamo i primi 20. Dedup su external_id evita lavoro inutile sui
    // già noti, quindi il costo Firecrawl in regime è basso.
    const discovered = new Set<string>();
    for (const term of ["circolare numero del", "messaggio numero del"]) {
      try {
        const links = await firecrawlMap("https://www.inps.it", term, 150);
        for (const l of links) {
          if (/inps\.it\/.+(circolare|messaggio).*\d/i.test(l)) {
            discovered.add(l.split("#")[0].split("?")[0]);
          }
        }
      } catch (e) {
        console.error(`ingestInpsDaily map "${term}" failed`, e);
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const dated: Array<{ url: string; date: Date }> = [];
    for (const url of discovered) {
      const meta = parseInpsUrl(url);
      if (!meta.date) continue;
      const d = new Date(meta.date);
      if (isNaN(d.getTime())) continue;
      if (d < cutoff) continue;
      dated.push({ url, date: d });
    }
    dated.sort((a, b) => b.date.getTime() - a.date.getTime());
    const candidates = dated.slice(0, 20).map((c) => c.url);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const createdItems: Array<{ url: string; title: string }> = [];
    for (const url of candidates) {
      try {
        const r = await ingestSingleInps(url);
        if (r.ok) {
          if (r.created) {
            created++;
            createdItems.push({ url, title: r.title });
          } else {
            skipped++;
          }
        } else {
          errors.push(`${url}: ${r.reason}`);
        }
      } catch (e) {
        errors.push(`${url}: ${(e as Error).message}`);
      }
    }
    return {
      discovered: discovered.size,
      eligible: dated.length,
      checked: candidates.length,
      created,
      skipped,
      createdItems,
      errors: errors.slice(0, 10),
    };
  });

// ---------- Cron giornaliero: backfill "a ritroso" ----------
//
// Trova la pubblicazione più vecchia già nel corpus e cerca su INPS atti
// ancora più datati, ingestendone fino a `target` nuovi (default 5).
// Procede per anni decrescenti finché non raggiunge la quota o esaurisce
// i candidati antecedenti.

const BackfillOlderInput = z.object({
  target: z.number().int().min(1).max(20).default(5),
  yearsBack: z.number().int().min(1).max(15).default(10),
});

export const backfillInpsOlder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BackfillOlderInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    // 1) trova la data più vecchia già nel corpus (solo atti INPS)
    const { data: oldestRows, error: oldestErr } = await supabaseAdmin
      .from("sources")
      .select("publication_date")
      .in("source_type", ["circolare", "messaggio"])
      .order("publication_date", { ascending: true })
      .limit(1);
    if (oldestErr) throw new Error(oldestErr.message);

    const oldestDate = oldestRows?.[0]?.publication_date
      ? new Date(oldestRows[0].publication_date as string)
      : new Date(); // fallback: oggi (cercherà comunque tutto il passato)
    const oldestYear = oldestDate.getFullYear();

    // 2) URL già nel DB (per dedup veloce senza scrape)
    const { data: existingRows } = await supabaseAdmin
      .from("sources")
      .select("external_id")
      .in("source_type", ["circolare", "messaggio"]);
    const knownIds = new Set((existingRows ?? []).map((r) => r.external_id).filter(Boolean) as string[]);

    // 3) scopri candidati anno per anno, dal più recente "minore di oldestYear"
    //    a ritroso, includendo anche l'anno corrente di oldestDate per
    //    intercettare atti dello stesso anno ma con data precedente.
    const target = data.target;
    const created: Array<{ url: string; external_id: string; title: string }> = [];
    const errors: string[] = [];
    let totalDiscovered = 0;
    let totalEligible = 0;

    for (let year = oldestYear; year >= oldestYear - data.yearsBack && created.length < target; year--) {
      const links = new Set<string>();
      for (const term of [`circolare numero del ${year}`, `messaggio numero del ${year}`]) {
        try {
          const found = await firecrawlMap("https://www.inps.it", term, 200);
          for (const l of found) {
            if (/inps\.it\/.+(circolare|messaggio).*\d/i.test(l)) {
              links.add(l.split("#")[0].split("?")[0]);
            }
          }
        } catch (e) {
          console.error(`map ${term} failed`, e);
        }
      }
      totalDiscovered += links.size;

      // tieni solo URL dell'anno e con data precedente a oldestDate; salta i già noti
      const candidates: Array<{ url: string; date: Date }> = [];
      for (const url of links) {
        const meta = parseInpsUrl(url);
        if (meta.year !== year) continue;
        if (!meta.date) continue;
        const d = new Date(meta.date);
        if (isNaN(d.getTime())) continue;
        if (d >= oldestDate) continue;
        const extId = buildExternalId(meta, url);
        if (knownIds.has(extId)) continue;
        candidates.push({ url, date: d });
      }
      totalEligible += candidates.length;

      // ordina dal più recente al più vecchio (riempie il "buco" appena prima di oldestDate)
      candidates.sort((a, b) => b.date.getTime() - a.date.getTime());

      for (const c of candidates) {
        if (created.length >= target) break;
        try {
          const r = await ingestSingleInps(c.url);
          if (r.ok && r.created) {
            created.push({ url: c.url, external_id: r.external_id, title: r.title });
            knownIds.add(r.external_id);
          } else if (!r.ok) {
            errors.push(`${c.url}: ${r.reason}`);
          }
        } catch (e) {
          errors.push(`${c.url}: ${(e as Error).message}`);
        }
      }
    }

    return {
      oldestBefore: oldestDate.toISOString().slice(0, 10),
      discovered: totalDiscovered,
      eligible: totalEligible,
      created: created.length,
      createdItems: created,
      errors: errors.slice(0, 10),
    };
  });

// ---------------------------------------------------------------------------
// Backfill MASSIVO progressivo via coda DB
//
// L'archivio INPS contiene ~15k atti; non possiamo scoprirli e ingerirli tutti
// in una run (timeout + crediti Firecrawl). Strategia:
//   1) "Discovery": chiamate `map` per (kind × anno) → enqueue URL in
//      `inps_ingest_queue` (status=pending). Idempotente: l'unique constraint
//      su url scarta i duplicati. Costo: ~2 crediti per anno coperto.
//   2) "Processing": l'utente avvia batch da 200–500 URL alla volta.
//      Per ogni URL: dedup PRIMA dello scrape (controllo external_id sulle
//      sources già in DB, niente credito) → scrape + insert se nuovo →
//      aggiornamento riga di coda. Costo: 1 credito per atto effettivamente
//      scaricato (gli skip non costano).
// ---------------------------------------------------------------------------

type QueueRow = { id: string; url: string; status: string };
const QUEUE_TABLE = "inps_ingest_queue" as const;

const DiscoverInput = z.object({
  yearFrom: z.number().int().min(1995).max(2100).default(1999),
  yearTo: z.number().int().min(1995).max(2100).default(new Date().getFullYear()),
});

export const discoverInpsCorpus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (data.yearTo < data.yearFrom) throw new Error("yearTo < yearFrom");
    const discovered = new Set<string>();
    const errors: string[] = [];

    for (let year = data.yearTo; year >= data.yearFrom; year--) {
      for (const term of [`circolare numero del ${year}`, `messaggio numero del ${year}`]) {
        try {
          const links = await firecrawlMap("https://www.inps.it", term, 500);
          for (const l of links) {
            if (/inps\.it\/.+(circolare|messaggio).*\d/i.test(l)) {
              const clean = l.split("#")[0].split("?")[0];
              const meta = parseInpsUrl(clean);
              // tieni solo URL il cui anno parsato corrisponde (filtra rumore)
              if (meta.year === year) discovered.add(clean);
            }
          }
        } catch (e) {
          errors.push(`${term}: ${(e as Error).message}`);
        }
      }
    }

    // Bulk upsert in coda (ignora duplicati grazie all'unique constraint).
    const rows = Array.from(discovered).map((url) => ({ url, status: "pending" }));
    let inserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data: ins, error } = await (supabaseAdmin as any).from(QUEUE_TABLE)
        .upsert(chunk, { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) {
        errors.push(`enqueue chunk ${i}: ${error.message}`);
      } else {
        inserted += (ins as unknown as Array<unknown> | null)?.length ?? 0;
      }
    }

    return {
      discovered: discovered.size,
      enqueued: inserted,
      yearFrom: data.yearFrom,
      yearTo: data.yearTo,
      errors: errors.slice(0, 10),
    };
  });

const ProcessBatchInput = z.object({
  limit: z.number().int().min(1).max(500).default(200),
});

export const processInpsQueueBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ProcessBatchInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    // Prendi i prossimi N pending; ordiniamo per discovered_at asc così
    // ogni run consuma sempre dalla "testa" della coda.
    const { data: pending, error } = await (supabaseAdmin as any).from(QUEUE_TABLE)
      .select("id, url")
      .eq("status", "pending")
      .order("discovered_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const rows = (pending as QueueRow[] | null) ?? [];

    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const r = await ingestSingleInps(row.url);
        if (r.ok) {
          await (supabaseAdmin as any).from(QUEUE_TABLE)
            .update({
              status: r.created ? "done" : "skipped",
              external_id: r.external_id,
              processed_at: new Date().toISOString(),
              error: null,
            })
            .eq("id", row.id);
          if (r.created) created++; else skipped++;
        } else {
          failed++;
          await (supabaseAdmin as any).from(QUEUE_TABLE)
            .update({
              status: "error",
              error: r.reason.slice(0, 500),
              processed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      } catch (e) {
        failed++;
        await (supabaseAdmin as any).from(QUEUE_TABLE)
          .update({
            status: "error",
            error: (e as Error).message.slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }
    return { processed: rows.length, created, skipped, failed };
  });

export const getInpsQueueStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const counts: Record<string, number> = { pending: 0, done: 0, skipped: 0, error: 0 };
    for (const status of Object.keys(counts)) {
      const { count } = await (supabaseAdmin as any).from(QUEUE_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count ?? 0;
    }
    const total = counts.pending + counts.done + counts.skipped + counts.error;
    const { count: sourcesCount } = await supabaseAdmin
      .from("sources")
      .select("id", { count: "exact", head: true })
      .in("source_type", ["circolare", "messaggio"]);
    return {
      queue: counts,
      queueTotal: total,
      sourcesInpsTotal: sourcesCount ?? 0,
    };
  });
