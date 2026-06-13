import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Layer OPERATIVO del corpus INPS
//
// A differenza del layer normativo (circolari/messaggi), qui raccogliamo
// pagine pratiche dal sito inps.it organizzate in tre "famiglie":
//   - schede servizio    (catalogo prestazioni: come fare domanda, requisiti)
//   - faq                (FAQ ufficiali)
//   - notizie            (news + portali tematici)
//
// Stesso modello Discovery → Batch → Indicizzazione del layer normativo:
//  1) Discovery: Firecrawl `map` sui 5 entry-point ufficiali → coda DB.
//  2) Batch: scrape + upsert in `sources` con `corpus_layer='operativo'`.
//  3) "Aggiorna indice" già esistente fa partire gli embedding.
// ---------------------------------------------------------------------------

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

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

async function firecrawlScrape(
  url: string,
  opts?: { onlyMainContent?: boolean; withLinks?: boolean },
): Promise<ScrapeResult> {
  const key = requireFirecrawlKey();
  const formats: string[] = ["markdown"];
  if (opts?.withLinks) formats.push("links");
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats,
      onlyMainContent: opts?.onlyMainContent ?? true,
      parsers: ["pdf"],
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { success?: boolean; data?: ScrapeResult; error?: string };
  if (!json.success || !json.data) throw new Error(`Firecrawl scrape failed: ${json.error ?? "unknown"}`);
  return json.data;
}

async function firecrawlMap(url: string, search: string | undefined, limit = 500): Promise<string[]> {
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
    const json = (await res.json()) as { success?: boolean; links?: Array<string | { url: string }>; data?: { links?: Array<string | { url: string }> } };
    const raw = json.links ?? json.data?.links ?? [];
    return raw.map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean);
  }
  throw new Error("Firecrawl map: rate limit persistente");
}

// ---------------------------------------------------------------------------
// Entry-point e classificazione
// ---------------------------------------------------------------------------

type OpLayer = "scheda" | "faq" | "notizia" | "portale";

type EntryPoint = {
  layer: OpLayer;
  url: string;
  search?: string;
  includePattern: RegExp;
};

// NB: mappare un sotto-URL profondo (es. /tutti-i-servizi.html) restituisce
// 1 solo link — Firecrawl avvisa "try mapping the base domain". Quindi tutti
// gli entry-point operativi partono da `https://www.inps.it` con `search`
// dedicate; il pattern di inclusione filtra poi sul tipo di pagina.
const BASE = "https://www.inps.it";

const ENTRY_POINTS: EntryPoint[] = [
  // 1) Schede servizio: /it/it/dettaglio-scheda.it.schede-servizio-strumento.*.html
  { layer: "scheda", url: BASE, search: "scheda servizio prestazione",
    includePattern: /www\.inps\.it\/it\/it\/dettaglio-scheda\.it\..+\.html$/i },
  { layer: "scheda", url: BASE, search: "come fare domanda prestazione inps",
    includePattern: /www\.inps\.it\/it\/it\/dettaglio-scheda\.it\..+\.html$/i },
  { layer: "scheda", url: BASE, search: "naspi assegno inclusione bonus requisiti",
    includePattern: /www\.inps\.it\/it\/it\/dettaglio-scheda\.it\..+\.html$/i },

  // 2) FAQ: pagine HTML in /it/it/... che contengono "faq" o "domande-frequenti"
  { layer: "faq", url: BASE, search: "faq domande frequenti",
    includePattern: /www\.inps\.it\/it\/it\/.*(faq|domande-frequenti).*\.html$/i },
  { layer: "faq", url: BASE, search: "faq inps assistenza",
    includePattern: /www\.inps\.it\/it\/it\/.*(faq|domande-frequenti).*\.html$/i },

  // 3) Notizie: /it/it/inps-comunica/notizie/dettaglio-news-page.news.YYYY.MM.slug.html
  { layer: "notizia", url: BASE, search: "notizia inps comunica",
    includePattern: /www\.inps\.it\/it\/it\/inps-comunica\/notizie\/dettaglio-news-page\..+\.html$/i },
  { layer: "notizia", url: BASE, search: "novità inps prestazioni famiglie lavoratori",
    includePattern: /www\.inps\.it\/it\/it\/inps-comunica\/notizie\/dettaglio-news-page\..+\.html$/i },
  { layer: "notizia", url: BASE, search: "messaggio circolare scadenza domanda",
    includePattern: /www\.inps\.it\/it\/it\/inps-comunica\/notizie\/dettaglio-news-page\..+\.html$/i },

  // 4) Portale famiglia + dossier tematici + sostegni-sussidi-indennita + giovani
  { layer: "portale", url: BASE, search: "portale famiglia genitorialità",
    includePattern: /www\.inps\.it\/it\/it\/portale-della-famiglia-e-della-genitorialita.*\.html$/i },
  { layer: "portale", url: BASE, search: "dossier inps",
    includePattern: /www\.inps\.it\/it\/it\/inps-comunica\/dossier\/.+\.html$/i },
  { layer: "portale", url: BASE, search: "sostegni sussidi indennità famiglia disabilità lavoro",
    includePattern: /www\.inps\.it\/it\/it\/sostegni-sussidi-indennita\/.+\.html$/i },
  { layer: "portale", url: BASE, search: "inps per i giovani lavoro studio",
    includePattern: /www\.inps\.it\/it\/it\/inps-per-i-giovani.*\.html$/i },
];

const CLASSIFY_PATTERNS: Array<{ layer: OpLayer; re: RegExp }> = [
  { layer: "scheda",  re: /www\.inps\.it\/it\/it\/dettaglio-scheda\.it\./i },
  { layer: "notizia", re: /www\.inps\.it\/it\/it\/inps-comunica\/notizie\/dettaglio-news-page\./i },
  { layer: "faq",     re: /www\.inps\.it\/it\/it\/.*(faq|domande-frequenti)/i },
  { layer: "portale", re: /www\.inps\.it\/it\/it\/(portale-della-famiglia-e-della-genitorialita|inps-per-i-giovani|inps-comunica\/dossier|sostegni-sussidi-indennita)/i },
];

function classifyOperationalUrl(url: string): OpLayer {
  for (const c of CLASSIFY_PATTERNS) if (c.re.test(url)) return c.layer;
  return "scheda";
}

function buildOperationalExternalId(url: string, layer: OpLayer): string {
  const hash = Buffer.from(url).toString("base64url").slice(0, 18);
  return `inps-op-${layer}-${hash}`;
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
  };
  for (const [tag, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) out.push(tag);
  }
  return out;
}

const QUEUE = "inps_operational_queue" as const;

// ---------- ingest singolo URL operativo ----------

async function ingestSingleOperational(url: string): Promise<
  | { ok: true; created: boolean; external_id: string; title: string }
  | { ok: false; url: string; reason: string }
> {
  const layer = classifyOperationalUrl(url);
  const external_id = buildOperationalExternalId(url, layer);

  // Dedup PRIMA dello scrape (zero crediti Firecrawl per già noti)
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id, title")
    .eq("external_id", external_id)
    .maybeSingle();
  if (existing) return { ok: true, created: false, external_id, title: existing.title };

  const page = await firecrawlScrape(url, { onlyMainContent: true });
  const md = (page.markdown ?? "").trim();
  if (md.length < 250) return { ok: false, url, reason: `markdown vuoto (${md.length} chars)` };

  const title = page.metadata?.title?.replace(/\s+\|\s+INPS.*$/i, "").trim()
    || `INPS — ${layer}`;
  const fullText = md.slice(0, 60000);
  const description = page.metadata?.description?.slice(0, 500) ?? "";
  const topics = guessTopicTags(`${title} ${md.slice(0, 4000)}`);

  const { data: upserted, error } = await supabaseAdmin
    .from("sources")
    .upsert(
      {
        external_id,
        title,
        source_type: "pagina_servizio",
        document_number: null,
        publication_date: new Date().toISOString().slice(0, 10),
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

// ---------- Discovery ----------

const DiscoverInput = z.object({
  layers: z.array(z.enum(["scheda", "faq", "notizia", "portale"])).default(["scheda", "faq", "notizia", "portale"]),
  limit: z.number().int().min(50).max(2000).default(500),
});

export const discoverInpsOperational = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const discovered = new Set<string>();
    const perLayer: Record<string, number> = { scheda: 0, faq: 0, notizia: 0, portale: 0 };
    const errors: string[] = [];

    const targets = ENTRY_POINTS.filter((ep) => data.layers.includes(ep.layer));
    for (const ep of targets) {
      try {
        const links = await firecrawlMap(ep.url, ep.search, data.limit);
        for (const raw of links) {
          const clean = raw.split("#")[0].split("?")[0];
          if (!ep.includePattern.test(clean)) continue;
          if (!discovered.has(clean)) {
            discovered.add(clean);
            perLayer[ep.layer] = (perLayer[ep.layer] ?? 0) + 1;
          }
        }
      } catch (e) {
        errors.push(`${ep.layer} ${ep.url}: ${(e as Error).message}`);
      }
    }

    // Upsert idempotente sulla coda
    const rows = Array.from(discovered).map((url) => ({
      url,
      status: "pending",
      kind: classifyOperationalUrl(url),
    }));
    let enqueued = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { data: ins, error } = await (supabaseAdmin as any).from(QUEUE)
        .upsert(slice, { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) errors.push(`enqueue ${i}: ${error.message}`);
      else enqueued += (ins as unknown[] | null)?.length ?? 0;
    }

    return { discovered: discovered.size, enqueued, perLayer, errors: errors.slice(0, 10) };
  });

// ---------- Batch ----------

const ProcessBatchInput = z.object({
  limit: z.number().int().min(1).max(25).default(15),
  concurrency: z.number().int().min(1).max(6).default(4),
});

export const processInpsOperationalBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ProcessBatchInput.parse(data ?? {}))
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
          const r = await ingestSingleOperational(row.url);
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

    return { processed: rows.length, created, skipped, failed };
  });

// ---------- Stats ----------

export const getInpsOperationalQueueStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const counts: Record<string, number> = { pending: 0, done: 0, skipped: 0, error: 0 };
    for (const status of Object.keys(counts)) {
      const { count } = await (supabaseAdmin as any).from(QUEUE)
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count ?? 0;
    }
    const total = counts.pending + counts.done + counts.skipped + counts.error;
    const { count: opCount } = await supabaseAdmin
      .from("sources")
      .select("id", { count: "exact", head: true } as any)
      .eq("corpus_layer" as any, "operativo");
    return { queue: counts, queueTotal: total, sourcesOpTotal: opCount ?? 0 };
  });

// ---------- Cron giornaliero: rediscovery + processing ----------

export const ingestInpsOperationalDaily = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1) Rediscovery leggera (limite ridotto per stare entro il timeout cron)
    const disc = await discoverInpsOperational({ data: { layers: ["scheda", "faq", "notizia", "portale"], limit: 200 } } as any);
    // 2) Processa i primi 15 in coda
    const batch = await processInpsOperationalBatch({ data: { limit: 15, concurrency: 4 } } as any);
    return { discovery: disc, batch };
  });
