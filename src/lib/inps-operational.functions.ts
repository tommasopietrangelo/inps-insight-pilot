import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Layer OPERATIVO INPS — modello a SEZIONI
//
// Ogni "sezione" è uno dei landing top-level del sito INPS che raggruppa
// schede servizio, dossier e contenuti pratici per categoria di utenza:
//
//   - nucleo-familiare      /sostegni-sussidi-indennita/per-nucleo-familiare.html
//   - disoccupati           /sostegni-sussidi-indennita/per-disoccupati.html
//   - basso-reddito         /sostegni-sussidi-indennita/per-persone-a-basso-reddito.html
//   - disabili              /sostegni-sussidi-indennita/per-disabili-invalidi-inabili.html
//   - previdenza            /previdenza.html
//   - lavoro                /lavoro.html
//   - imprese               /imprese-e-liberi-professionisti.html
//   - sostegni-root         /sostegni-sussidi-indennita.html
//
// Per ogni sezione l'utente lancia, dalle Impostazioni, due step indipendenti:
//   1) Discovery → Firecrawl `map` (entry-point + BASE con `search`) →
//      filtra link nel path della sezione → accoda con `section=<id>`.
//   2) Batch → scrape Firecrawl + upsert in `sources` (corpus_layer='operativo').
//
// In questo modo il CAF tiene sotto controllo, per ogni sezione, quante
// sottosezioni Firecrawl è riuscito a scoprire e indicizzare.
// La funzione cron giornaliera resta come hook futuro ma NON è attiva.
// ---------------------------------------------------------------------------

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";
const BASE = "https://www.inps.it";

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

async function firecrawlScrape(url: string, opts?: { onlyMainContent?: boolean }): Promise<ScrapeResult> {
  const key = requireFirecrawlKey();
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
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

// ---------------------------------------------------------------------------
// Definizione sezioni
// ---------------------------------------------------------------------------

export type SectionId =
  | "nucleo-familiare"
  | "disoccupati"
  | "basso-reddito"
  | "disabili"
  | "previdenza"
  | "lavoro"
  | "imprese"
  | "sostegni-root";

type SectionDef = {
  id: SectionId;
  label: string;
  entryUrl: string;
  pathPrefix: string; // filtra i link discovered
  search: string;     // query per il map su BASE
};

export const SECTIONS: SectionDef[] = [
  {
    id: "nucleo-familiare",
    label: "Sostegni · Nucleo familiare",
    entryUrl: `${BASE}/it/it/sostegni-sussidi-indennita/per-nucleo-familiare.html`,
    pathPrefix: "/it/it/sostegni-sussidi-indennita/per-nucleo-familiare",
    search: "assegno unico maternità congedo parentale bonus asilo nido famiglia",
  },
  {
    id: "disoccupati",
    label: "Sostegni · Disoccupati",
    entryUrl: `${BASE}/it/it/sostegni-sussidi-indennita/per-disoccupati.html`,
    pathPrefix: "/it/it/sostegni-sussidi-indennita/per-disoccupati",
    search: "naspi dis-coll discoll disoccupazione sostegno lavoro",
  },
  {
    id: "basso-reddito",
    label: "Sostegni · Basso reddito",
    entryUrl: `${BASE}/it/it/sostegni-sussidi-indennita/per-persone-a-basso-reddito.html`,
    pathPrefix: "/it/it/sostegni-sussidi-indennita/per-persone-a-basso-reddito",
    search: "assegno inclusione adi supporto formazione lavoro sfl carta acquisti",
  },
  {
    id: "disabili",
    label: "Sostegni · Disabili / Invalidi",
    entryUrl: `${BASE}/it/it/sostegni-sussidi-indennita/per-disabili-invalidi-inabili.html`,
    pathPrefix: "/it/it/sostegni-sussidi-indennita/per-disabili-invalidi-inabili",
    search: "invalidità civile legge 104 indennità accompagnamento disabilità",
  },
  {
    id: "previdenza",
    label: "Previdenza",
    entryUrl: `${BASE}/it/it/previdenza.html`,
    pathPrefix: "/it/it/previdenza",
    search: "pensione vecchiaia anticipata ape opzione donna quota contributi",
  },
  {
    id: "lavoro",
    label: "Lavoro",
    entryUrl: `${BASE}/it/it/lavoro.html`,
    pathPrefix: "/it/it/lavoro",
    search: "lavoro contratto cassa integrazione cig domestico colf badante",
  },
  {
    id: "imprese",
    label: "Imprese e liberi professionisti",
    entryUrl: `${BASE}/it/it/imprese-e-liberi-professionisti.html`,
    pathPrefix: "/it/it/imprese-e-liberi-professionisti",
    search: "azienda artigiani commercianti gestione separata uniemens contributi",
  },
  {
    id: "sostegni-root",
    label: "Sostegni · Indice generale",
    entryUrl: `${BASE}/it/it/sostegni-sussidi-indennita.html`,
    pathPrefix: "/it/it/sostegni-sussidi-indennita",
    search: "sostegni sussidi indennità prestazioni inps",
  },
];

function getSection(id: string): SectionDef {
  const s = SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error(`Sezione sconosciuta: ${id}`);
  return s;
}

// ---------- helpers ----------

function buildExternalId(url: string): string {
  const hash = Buffer.from(url).toString("base64url").slice(0, 18);
  return `inps-op-${hash}`;
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

  const page = await firecrawlScrape(url, { onlyMainContent: true });
  const md = (page.markdown ?? "").trim();
  if (md.length < 250) return { ok: false, url, reason: `markdown vuoto (${md.length} chars)` };

  const title =
    page.metadata?.title?.replace(/\s+\|\s+INPS.*$/i, "").trim() || "INPS — pagina servizio";
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

// ---------------------------------------------------------------------------
// Discovery di una singola sezione
// ---------------------------------------------------------------------------

const DiscoverInput = z.object({
  section: z.string().min(1),
  limit: z.number().int().min(50).max(2000).default(500),
});

export const discoverInpsSection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const sec = getSection(data.section);
    const errors: string[] = [];
    const found = new Set<string>();

    // Strategia: due chiamate map per massimizzare la copertura.
    //   a) map sull'entry-point della sezione (Firecrawl può restituire pochi
    //      link su URL profondi, ma quando funziona dà i figli diretti)
    //   b) map su BASE con `search` calibrata sulla sezione (più recall)
    // Poi filtra per path-prefix della sezione.
    const calls: Array<{ url: string; search?: string; label: string }> = [
      { url: sec.entryUrl, search: undefined, label: "entry" },
      { url: BASE, search: sec.search, label: "base+search" },
    ];

    for (const c of calls) {
      try {
        const links = await firecrawlMap(c.url, c.search, data.limit);
        for (const raw of links) {
          const clean = raw.split("#")[0].split("?")[0];
          // filtro: deve essere sul dominio inps.it e dentro al path della sezione
          if (!/^https?:\/\/(www\.)?inps\.it\//i.test(clean)) continue;
          const path = clean.replace(/^https?:\/\/(www\.)?inps\.it/i, "");
          if (!path.toLowerCase().startsWith(sec.pathPrefix.toLowerCase())) continue;
          // escludi l'entry-point stesso
          if (clean.replace(/\/$/, "") === sec.entryUrl.replace(/\/$/, "")) continue;
          found.add(clean);
        }
      } catch (e) {
        errors.push(`${c.label}: ${(e as Error).message}`);
      }
    }

    // Upsert idempotente con section
    const rows = Array.from(found).map((url) => ({
      url,
      status: "pending",
      kind: "section",
      section: sec.id,
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

    return {
      section: sec.id,
      label: sec.label,
      discovered: found.size,
      enqueued,
      errors: errors.slice(0, 10),
    };
  });

// ---------------------------------------------------------------------------
// Batch di una singola sezione
// ---------------------------------------------------------------------------

const ProcessBatchInput = z.object({
  section: z.string().min(1),
  limit: z.number().int().min(1).max(25).default(15),
  concurrency: z.number().int().min(1).max(6).default(4),
});

export const processInpsSectionBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ProcessBatchInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const sec = getSection(data.section);
    const { data: pending, error } = await (supabaseAdmin as any).from(QUEUE)
      .select("id, url")
      .eq("status", "pending")
      .eq("section", sec.id)
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

    return { section: sec.id, processed: rows.length, created, skipped, failed };
  });

// ---------------------------------------------------------------------------
// Stats per-sezione
// ---------------------------------------------------------------------------

export const getInpsSectionsStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any).from(QUEUE)
      .select("section, status");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ section: string | null; status: string }>;

    const perSection: Record<string, { pending: number; done: number; skipped: number; error: number; total: number }> = {};
    for (const s of SECTIONS) perSection[s.id] = { pending: 0, done: 0, skipped: 0, error: 0, total: 0 };
    for (const r of rows) {
      const id = r.section ?? "";
      if (!perSection[id]) continue;
      const slot = perSection[id];
      if (r.status === "pending") slot.pending++;
      else if (r.status === "done") slot.done++;
      else if (r.status === "skipped") slot.skipped++;
      else if (r.status === "error") slot.error++;
      slot.total++;
    }

    const { count: opCount } = await supabaseAdmin
      .from("sources")
      .select("id", { count: "exact", head: true } as any)
      .eq("corpus_layer" as any, "operativo");

    return {
      sections: SECTIONS.map((s) => ({ id: s.id, label: s.label, entryUrl: s.entryUrl })),
      perSection,
      sourcesOpTotal: opCount ?? 0,
    };
  });

// ---------------------------------------------------------------------------
// Hook futuro: rediscovery + processing periodico (NON attivo).
// Lasciato per quando vorremo abilitarlo da cron.
// ---------------------------------------------------------------------------

type DailyEntry = {
  section: string;
  discovered?: number;
  enqueued?: number;
  processed?: number;
  created?: number;
  skipped?: number;
  failed?: number;
  error?: string;
};

export const ingestInpsOperationalDaily = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ sections: DailyEntry[]; created: number }> => {
    const out: DailyEntry[] = [];
    let created = 0;
    for (const s of SECTIONS) {
      try {
        const disc = await discoverInpsSection({ data: { section: s.id, limit: 200 } } as any);
        const batch = await processInpsSectionBatch({ data: { section: s.id, limit: 10, concurrency: 3 } } as any);
        created += batch.created;
        out.push({
          section: s.id,
          discovered: disc.discovered,
          enqueued: disc.enqueued,
          processed: batch.processed,
          created: batch.created,
          skipped: batch.skipped,
          failed: batch.failed,
        });
      } catch (e) {
        out.push({ section: s.id, error: (e as Error).message });
      }
    }
    return { sections: out, created };
  });
