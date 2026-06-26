import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

async function embed(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurata");
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-embedding-001", input: text }),
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

function vecLit(v: number[]) {
  return `[${v.join(",")}]`;
}

async function fallbackKeywordMatches(query: string, limit: number, topicFilters?: string[]) {
  let request = supabaseAdmin
    .from("sources")
    .select("id, title, source_type, document_number, publication_date, official_url, full_text, excerpt, corpus_layer")
    .textSearch("fts", query, {
      type: "websearch",
      config: "italian",
    });

  if (topicFilters && topicFilters.length > 0) {
    request = request.overlaps("topic_tags", topicFilters);
  }

  const { data, error } = await request
    .order("publication_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`fallback text search: ${error.message}`);

  return (data ?? []).map((row, i) => ({
    chunk_id: `fts-${row.id}`,
    source_id: row.id,
    content: row.full_text || row.excerpt || "",
    source_title: row.title,
    source_type: row.source_type,
    document_number: row.document_number,
    publication_date: row.publication_date,
    official_url: row.official_url,
    corpus_layer: (row as any).corpus_layer ?? "normativo",
    similarity: Math.max(0.5, 0.99 - i * 0.05),
  }));
}



async function specializedPatternMatches(limit: number, topicFilters?: string[]) {
  let request = supabaseAdmin
    .from("sources")
    .select("id, title, source_type, document_number, publication_date, official_url, full_text, excerpt, corpus_layer")
    .or([
      "title.ilike.%ADI-Com%",
      "excerpt.ilike.%ADI-Com%",
      "full_text.ilike.%ADI-Com%",
      "full_text.ilike.%sentenz%",
      "full_text.ilike.%giudicat%",
      "full_text.ilike.%condann%",
      "full_text.ilike.%comunicazioni obbligatorie%",
      "full_text.ilike.%ogni componente maggiorenne%",
    ].join(","));

  if (topicFilters && topicFilters.length > 0) {
    request = request.overlaps("topic_tags", topicFilters);
  }

  const { data, error } = await request
    .order("publication_date", { ascending: false })
    .limit(Math.max(limit * 6, 40));

  if (error) throw new Error(`specialized pattern search: ${error.message}`);

  return (data ?? []).map((row, i) => ({
    chunk_id: `special-${row.id}`,
    source_id: row.id,
    content: row.full_text || row.excerpt || "",
    source_title: row.title,
    source_type: row.source_type,
    document_number: row.document_number,
    publication_date: row.publication_date,
    official_url: row.official_url,
    corpus_layer: (row as any).corpus_layer ?? "normativo",
    similarity: Math.max(0.6, 1.05 - i * 0.01),
  }));
}


const SEARCH_STOPWORDS = new Set([
  "a", "ad", "al", "alla", "allo", "ai", "agli", "all", "alle",
  "anche", "che", "chi", "ci", "coi", "col", "con", "come", "cui",
  "da", "dal", "dalla", "dallo", "dei", "del", "della", "delle", "dello",
  "di", "e", "ed", "è", "ha", "ho", "i", "il", "in", "io", "la", "le",
  "lei", "li", "lo", "loro", "ma", "mi", "mia", "mie", "mio", "nei", "nel",
  "nella", "noi", "non", "o", "per", "perche", "perché", "piu", "più", "poi",
  "puo", "può", "qui", "se", "si", "sia", "sono", "su", "sua", "sue", "sul",
  "sulla", "sulle", "sullo", "tra", "un", "una", "uno", "vi", "visto",
]);

const DOMAIN_ALIASES = [
  {
    topic: "ADI",
    label: "Assegno di Inclusione",
    aliases: ["adi", "assegno di inclusione"],
    keywordAliases: ["adi", "adi-com", "adi com", "adi-com esteso", "adi com esteso", "assegno di inclusione"],
  },
  {
    topic: "SFL",
    label: "Supporto per la Formazione e il Lavoro",
    aliases: ["sfl", "supporto per la formazione e il lavoro"],
    keywordAliases: ["sfl", "supporto formazione lavoro"],
  },
  {
    topic: "NASpI",
    label: "NASpI",
    aliases: ["naspi"],
    keywordAliases: ["naspi"],
  },
  {
    topic: "Assegno Unico",
    label: "Assegno Unico",
    aliases: ["assegno unico", "auu"],
    keywordAliases: ["assegno unico", "auu"],
  },
] as const;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/\bpassata\s+ingiudicato\b/g, "giudicato")
    .replace(/\badi\s*[- ]\s*com\b/g, "adi-com")
    .replace(/[^a-z0-9/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function formatWebsearchTerm(term: string) {
  return /[\s/-]/.test(term) ? `"${term}"` : term;
}

function extractSearchSignals(query: string) {
  const normalized = normalizeSearchText(query);
  const detectedAliases = DOMAIN_ALIASES.filter((entry) =>
    entry.aliases.some((alias) => normalized.includes(normalizeSearchText(alias))),
  );

  const tokens = uniq(
    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token) => !SEARCH_STOPWORDS.has(token))
      .map((token) => {
        if (token.startsWith("ingiudicat")) return "giudicato";
        if (token.startsWith("condann")) return "condanna";
        if (token.startsWith("sentenz")) return "sentenza";
        if (token.startsWith("richiedent")) return "richiedente";
        if (token.startsWith("comunica")) return "comunicazione";
        if (token.startsWith("modul")) return "modello";
        return token;
      }),
  );

  const boostedTerms = [
    /adi-com/.test(normalized) ? "adi-com esteso" : null,
    /(sentenza|giudicat|condanna|reat)/.test(normalized) ? "sentenza" : null,
    /(sentenza|giudicat|condanna|reat)/.test(normalized) ? "giudicato" : null,
    /(richiedent|richiede)/.test(normalized) ? "richiedente" : null,
    /(compagna|coniuge|nucleo|percettore|componente)/.test(normalized) ? "componente" : null,
    /(modello|modulo|comunic)/.test(normalized) ? "comunicazione" : null,
    /(modello|modulo|adi-com)/.test(normalized) ? "modello" : null,
    normalized.includes("inps") ? "inps" : null,
  ].filter(Boolean) as string[];

  const aliasKeywordTerms = detectedAliases.flatMap((entry) => entry.keywordAliases);
  const keywordTerms = uniq([...aliasKeywordTerms, ...boostedTerms, ...tokens]).slice(0, 14);

  const keywordQueries = uniq([
    aliasKeywordTerms.length > 0 ? uniq(aliasKeywordTerms).map(formatWebsearchTerm).join(" OR ") : "",
    keywordTerms.slice(0, 8).map(formatWebsearchTerm).join(" OR "),
    keywordTerms.slice(0, 5).join(" "),
    normalized.length <= 180 ? normalized : "",
  ].filter(Boolean)).slice(0, 4);

  const semanticQuery =
    query.trim().length <= 240
      ? query.trim()
      : uniq([
          ...detectedAliases.map((entry) => entry.label),
          ...keywordTerms,
        ]).join("; ");

  return {
    normalized,
    topicFilters: uniq(detectedAliases.map((entry) => entry.topic)),
    keywordTerms,
    keywordQueries,
    semanticQuery,
  };
}

function scoreMatchAgainstTerms(match: any, terms: string[]) {
  const hay = normalizeSearchText([
    match.source_title,
    match.document_number,
    match.content,
  ].filter(Boolean).join(" "));

  let score = match.similarity ?? 0;
  for (const term of terms) {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) continue;
    if (hay.includes(normalizedTerm)) {
      score += normalizedTerm.includes("adi-com") ? 0.2 : 0.06;
    }
  }

  if (hay.includes("adi-com esteso")) score += 0.35;
  else if (hay.includes("adi-com")) score += 0.28;
  if (hay.includes("sentenze definitive di condanna")) score += 0.22;
  if (hay.includes("sentenza") && hay.includes("giudicato")) score += 0.16;
  if (hay.includes("ogni componente maggiorenne")) score += 0.1;
  if (hay.includes("comunicazioni obbligatorie")) score += 0.08;
  if (hay.includes("dettaglio di circolari messaggi e normativa")) score -= 0.12;

  return score;
}

async function fallbackKeywordMatchesVariants(queries: string[], limit: number, terms: string[], topicFilters?: string[]) {
  const candidateLimit = Math.max(limit * 6, 40);
  const merged = new Map<string, {
    chunk_id: string;
    source_id: string;
    content: string;
    source_title: string;
    source_type: string;
    document_number: string | null;
    publication_date: string;
    official_url: string;
    similarity: number;
  }>();

  for (const [queryIndex, query] of queries.entries()) {
    const rows = await fallbackKeywordMatches(query, candidateLimit, topicFilters);
    rows.forEach((row, rowIndex) => {
      const existing = merged.get(row.source_id);
      const boostedSimilarity = Math.max(0.55, row.similarity - queryIndex * 0.02 - rowIndex * 0.01);
      if (!existing || boostedSimilarity > existing.similarity) {
        merged.set(row.source_id, { ...row, similarity: boostedSimilarity });
      }
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => scoreMatchAgainstTerms(b, terms) - scoreMatchAgainstTerms(a, terms))
    .slice(0, limit);
}

function mergeRetrievalMatches(semanticMatches: any[], keywordMatches: any[], limit: number, terms: string[]) {
  const merged = new Map<string, any>();

  semanticMatches.forEach((row, index) => {
    merged.set(row.source_id, { ...row, similarity: row.similarity ?? Math.max(0.6, 0.95 - index * 0.04) });
  });

  keywordMatches.forEach((row, index) => {
    const existing = merged.get(row.source_id);
    const candidate = { ...row, similarity: row.similarity ?? Math.max(0.55, 0.88 - index * 0.04) };
    if (!existing || candidate.similarity > existing.similarity) {
      merged.set(row.source_id, existing ? { ...existing, ...candidate } : candidate);
    }
  });

  return Array.from(merged.values())
    .sort((a, b) => scoreMatchAgainstTerms(b, terms) - scoreMatchAgainstTerms(a, terms))
    .slice(0, limit);
}

// Massimo numero di atti elaborati per singola chiamata: serve a stare entro
// il timeout del worker. La UI richiama la funzione finché `remaining` > 0.
const INGEST_BATCH = 40;
const PAGE = 1000;

async function fetchAllPaged<T>(
  loader: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE - 1;
    const { data, error } = await loader(from, to);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export const ingestEmbeddings = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1) Tutti i source_id già indicizzati (paginati per superare il limite 1000 di PostgREST)
    const existing = await fetchAllPaged<{ source_id: string }>(async (from, to) => {
      const res = await supabaseAdmin.from("chunks").select("source_id").range(from, to);
      return { data: res.data, error: res.error };
    });
    const hasChunks = new Set(existing.map((r) => r.source_id));

    // 2) Conteggio totale per reporting
    const { count: total } = await supabaseAdmin
      .from("sources")
      .select("*", { count: "exact", head: true });

    // 3) Scorri le sources a pagine finché non hai raccolto INGEST_BATCH da indicizzare
    type Src = {
      id: string;
      title: string | null;
      summary: string | null;
      excerpt: string | null;
      full_text: string | null;
      document_number: string | null;
      topic_tags: string[] | null;
    };
    const todo: Src[] = [];
    let scanned = 0;
    let remainingTotal = 0;
    let from = 0;
    for (;;) {
      const to = from + PAGE - 1;
      const { data, error } = await supabaseAdmin
        .from("sources")
        .select("id, title, summary, excerpt, full_text, document_number, topic_tags")
        .order("publication_date", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Src[];
      if (rows.length === 0) break;
      scanned += rows.length;
      for (const s of rows) {
        if (hasChunks.has(s.id)) continue;
        remainingTotal++;
        if (todo.length < INGEST_BATCH) todo.push(s);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    let processed = 0;
    for (const s of todo) {
      const text = [
        s.title,
        s.document_number,
        (s.topic_tags ?? []).join(", "),
        s.summary,
        s.excerpt,
        s.full_text,
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        const emb = await embed(text);
        const { error: insErr } = await supabaseAdmin.from("chunks").insert({
          source_id: s.id,
          chunk_index: 0,
          content: text,
          section_ref: null,
          token_count: Math.ceil(text.length / 4),
          embedding: vecLit(emb) as unknown as string,
          model_version: "google/gemini-embedding-001",
        });
        if (insErr) throw new Error(insErr.message);
        processed++;
      } catch (e) {
        console.error("ingest failed for", s.id, e);
      }
    }

    const remaining = Math.max(0, remainingTotal - processed);
    return {
      processed,
      total: total ?? scanned,
      skipped: hasChunks.size,
      remaining,
    };
  });

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20000),
});
const SearchInput = z.object({
  query: z.string().min(2).max(8000),
  history: z.array(ChatTurnSchema).max(40).optional(),
});

export const groundedSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SearchInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const history = data.history ?? [];
    // For follow-ups, augment retrieval query with recent user turns so
    // pronouns/anaphora ("ok ma per i minori?") still pull relevant chunks.
    const priorUserTurns = history.filter((t) => t.role === "user").slice(-2).map((t) => t.content);
    const retrievalQuery = priorUserTurns.length > 0
      ? `${priorUserTurns.join(" \n ")} \n ${data.query}`
      : data.query;
    const signals = extractSearchSignals(retrievalQuery);
    const isProceduralAdiQuery =
      signals.topicFilters.includes("ADI") &&
      /(adi-com|sentenza|giudicato|condanna|comunicazione|modello)/.test(signals.normalized);
    const keywordPromise = fallbackKeywordMatchesVariants(
      signals.keywordQueries,
      8,
      signals.keywordTerms,
      signals.topicFilters.length > 0 ? [...signals.topicFilters] : undefined,
    );
    const specializedPromise = isProceduralAdiQuery
      ? specializedPatternMatches(8, signals.topicFilters.length > 0 ? [...signals.topicFilters] : undefined)
      : Promise.resolve([] as any[]);
    const queryEmb = await embed(signals.semanticQuery);

    let matches: any[] | null = null;
    let retrievalMode: "semantic" | "hybrid" | "fts-fallback" = "semantic";

    const { data: semanticMatches, error } = await supabaseAdmin.rpc("match_chunks", {
      query_embedding: vecLit(queryEmb) as unknown as string,
      match_count: 8,
      filter_topics: signals.topicFilters.length > 0 ? [...signals.topicFilters] : undefined,
    });

    const [keywordMatches, specializedMatches] = await Promise.all([keywordPromise, specializedPromise]);
    const boostedKeywordMatches = specializedMatches.length > 0
      ? mergeRetrievalMatches(specializedMatches, keywordMatches, 8, signals.keywordTerms)
      : keywordMatches;

    if (error) {
      const message = error.message ?? "";
      const isTimeout = /statement timeout|canceling statement due to statement timeout/i.test(message);
      if (!isTimeout) throw new Error(`match_chunks: ${message}`);
      retrievalMode = "fts-fallback";
      matches = boostedKeywordMatches;
    } else {
      const semanticRows = semanticMatches ?? [];
      const topSimilarity = semanticRows[0]?.similarity ?? 0;
      const shouldBlend =
        boostedKeywordMatches.length > 0 && (
          semanticRows.length === 0 ||
          isProceduralAdiQuery ||
          data.query.trim().length > 160 ||
          topSimilarity < 0.72
        );

      matches = shouldBlend
        ? mergeRetrievalMatches(semanticRows, boostedKeywordMatches, 8, signals.keywordTerms)
        : semanticRows.slice(0, 8);
      if (shouldBlend) retrievalMode = "hybrid";
      if ((matches?.length ?? 0) === 0 && boostedKeywordMatches.length > 0) {
        matches = boostedKeywordMatches;
        retrievalMode = "fts-fallback";
      }
    }

    // Arricchisci con corpus_layer (il match_chunks RPC non lo restituisce;
    // i match keyword/specialized invece sì → preferisci quello)
    const sourceIds = Array.from(new Set((matches ?? []).map((m: any) => m.source_id)));
    const layerById = new Map<string, string>();
    for (const m of matches ?? []) {
      if (m.corpus_layer) layerById.set(m.source_id, m.corpus_layer);
    }
    const missing = sourceIds.filter((id) => !layerById.has(id));
    if (missing.length > 0) {
      const { data: layerRows } = await supabaseAdmin
        .from("sources")
        .select("id, corpus_layer" as any)
        .in("id", missing);
      for (const r of ((layerRows ?? []) as unknown) as Array<{ id: string; corpus_layer: string }>) {
        layerById.set(r.id, r.corpus_layer ?? "normativo");
      }

    }

    const sources = (matches ?? []).map((m: any, i: number) => ({
      n: i + 1,
      chunk_id: m.chunk_id,
      source_id: m.source_id,
      title: m.source_title,
      source_type: m.source_type,
      document_number: m.document_number,
      publication_date: m.publication_date,
      official_url: m.official_url,
      corpus_layer: layerById.get(m.source_id) ?? "normativo",
      excerpt: (m.content ?? "").slice(0, 1800),
      similarity: m.similarity,
    }));

    if (sources.length === 0) {
      return { answer: "Nessuna fonte rilevante trovata nel corpus per questa ricerca.", sources: [] };
    }

    const context = sources
      .map((s) => {
        const layerLabel = s.corpus_layer === "operativo" ? "OPERATIVO" : "NORMATIVO";
        return `[${s.n}] (${layerLabel}) ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title}\n${s.excerpt}`;
      })
      .join("\n\n");

    const system =
      "Sei un assistente esperto di previdenza e welfare italiano per CAF, patronati e consulenti del lavoro. " +
      "Rispondi in italiano professionale, sintetico e operativo. " +
      "Ogni affermazione fattuale DEVE essere supportata da una citazione nel formato [n] riferita alle fonti fornite. " +
      "Le fonti sono etichettate come (NORMATIVO) = circolari/messaggi/leggi ad alta affidabilità giuridica, oppure (OPERATIVO) = schede servizio, FAQ, notizie INPS utili per istruzioni pratiche. " +
      "Quando citi, mantieni implicito quale layer stai usando: se rispondi con istruzioni pratiche (come fare domanda, scadenze, modulistica) appoggiati al layer OPERATIVO; se rispondi su requisiti normativi, importi o procedure formali appoggiati al layer NORMATIVO. " +
      "Alla fine della risposta, in una riga, dichiara: 'Layer usati: NORMATIVO [elenco n]; OPERATIVO [elenco n]' (ometti il layer non usato). " +
      "Non inventare normative. Se le fonti non bastano dillo esplicitamente. " +
      "Quando la domanda descrive un caso pratico, individua i sotto-problemi operativi (adempimento, soggetto obbligato, canale o modulo, rischio da omissione, azione immediata per il CAF) e rispondi in modo utile per chi deve gestire la pratica. " +
      "Se una fonte cita espressamente il modulo o la comunicazione richiesta, valorizzala chiaramente. " +
      "Struttura la risposta con: Sintesi, Cosa fare, Chi è coinvolto, Rischi o attenzioni, Note operative per il CAF.";

    const user = `Domanda: ${data.query}\n\nFonti disponibili:\n${context}`;


    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite di richieste raggiunto, riprova fra poco.");
      if (res.status === 402) throw new Error("Crediti AI esauriti per il workspace.");
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const answer = json.choices?.[0]?.message?.content ?? "";

    // Log
    await supabaseAdmin
      .from("search_logs")
      .insert({ query: data.query, results_count: sources.length })
      .then(() => undefined, () => undefined);

    return { answer, sources, retrievalMode };
  });
