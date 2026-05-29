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

export const ingestEmbeddings = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data: sources, error } = await supabaseAdmin
      .from("sources")
      .select("id, title, summary, excerpt, full_text, document_number, topic_tags");
    if (error) throw new Error(error.message);

    // Find sources without chunks
    const { data: existing } = await supabaseAdmin.from("chunks").select("source_id");
    const hasChunks = new Set((existing ?? []).map((r) => r.source_id));
    const todo = (sources ?? []).filter((s) => !hasChunks.has(s.id));

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
    return { processed, total: sources?.length ?? 0, skipped: hasChunks.size };
  });

const SearchInput = z.object({ query: z.string().min(2).max(500) });

export const groundedSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SearchInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const queryEmb = await embed(data.query);

    const { data: matches, error } = await supabaseAdmin.rpc("match_chunks", {
      query_embedding: vecLit(queryEmb) as unknown as string,
      match_count: 6,
    });
    if (error) throw new Error(`match_chunks: ${error.message}`);

    const sources = (matches ?? []).map((m: any, i: number) => ({
      n: i + 1,
      chunk_id: m.chunk_id,
      source_id: m.source_id,
      title: m.source_title,
      source_type: m.source_type,
      document_number: m.document_number,
      publication_date: m.publication_date,
      official_url: m.official_url,
      excerpt: (m.content ?? "").slice(0, 1800),
      similarity: m.similarity,
    }));

    if (sources.length === 0) {
      return { answer: "Nessuna fonte rilevante trovata nel corpus per questa ricerca.", sources: [] };
    }

    const context = sources
      .map((s) => `[${s.n}] ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title}\n${s.excerpt}`)
      .join("\n\n");

    const system =
      "Sei un assistente esperto di previdenza e welfare italiano per CAF, patronati e consulenti del lavoro. " +
      "Rispondi in italiano professionale, sintetico e operativo. " +
      "Ogni affermazione fattuale DEVE essere supportata da una citazione nel formato [n] riferita alle fonti fornite. " +
      "Non inventare normative. Se le fonti non bastano dillo esplicitamente. " +
      "Struttura la risposta con: Sintesi, Cosa è cambiato, Chi è coinvolto, Note operative per il CAF.";

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

    return { answer, sources };
  });
