import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Funzioni per il dettaglio di un atto (Circolare / Messaggio / Decreto):
//   - getSourceKeyPoints: estrae dal full_text i "punti chiave" e le
//     "scadenze" usando Lovable AI (Gemini Flash) con output JSON.
//   - getRelatedSources: cerca gli atti tematicamente collegati nel corpus
//     usando l'embedding di titolo + summary + estratto, con fallback su
//     overlap di topic_tags.
// ---------------------------------------------------------------------------

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function requireLovableKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurata");
  return key;
}

async function embed(text: string): Promise<number[]> {
  const key = requireLovableKey();
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 6000) }),
  });
  if (!res.ok) throw new Error(`Embedding ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Punti chiave + scadenze
// ---------------------------------------------------------------------------

export type KeyPoint = { label: string; detail?: string };
export type Deadline = { date: string; label: string };

const KeyPointsInput = z.object({ sourceId: z.string().min(1) });

export const getSourceKeyPoints = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => KeyPointsInput.parse(data ?? {}))
  .handler(
    async ({
      data,
    }): Promise<{
      points: KeyPoint[];
      deadlines: Deadline[];
      source: string;
    }> => {
      // Risolvi UUID o external_id
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.sourceId,
      );
      const filter = isUuid
        ? `id.eq.${data.sourceId},external_id.eq.${data.sourceId}`
        : `external_id.eq.${data.sourceId}`;
      const { data: src, error } = await supabaseAdmin
        .from("sources")
        .select("id, title, summary, full_text, excerpt, source_type, document_number, publication_date")
        .or(filter)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!src) throw new Error("Atto non trovato");

      const text = (src.full_text || src.excerpt || src.summary || "").trim();
      if (text.length < 200) {
        return { points: [], deadlines: [], source: "empty" };
      }

      const key = requireLovableKey();
      const system =
        "Sei un esperto di previdenza e welfare italiano. Estrai dal testo di un atto INPS i PUNTI CHIAVE " +
        "(le novità o regole fondamentali introdotte) e le SCADENZE esplicite (date precise menzionate). " +
        "Rispondi SOLO in italiano e SOLO con JSON valido nella forma richiesta. " +
        "Non inventare nulla: usa solo informazioni presenti nel testo. " +
        "Le scadenze devono avere date concrete (gg/mm/aaaa o mese/anno) realmente presenti nel testo.";
      const user =
        `Atto: ${src.source_type} ${src.document_number ?? ""} del ${src.publication_date}\n` +
        `Titolo: ${src.title}\n\n` +
        `Testo (potenzialmente troncato):\n${text.slice(0, 18000)}\n\n` +
        `Restituisci JSON in questa forma esatta:\n` +
        `{\n` +
        `  "points": [ {"label":"titolo breve del punto","detail":"1-2 frasi di dettaglio"} ],\n` +
        `  "deadlines": [ {"date":"gg/mm/aaaa","label":"cosa scade"} ]\n` +
        `}\n` +
        `Linee guida: 4-8 punti chiave, ordina per importanza. Se non ci sono scadenze esplicite, restituisci "deadlines": [].`;

      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429) throw new Error("Limite di richieste AI raggiunto, riprova fra poco.");
        if (res.status === 402) throw new Error("Crediti AI esauriti.");
        throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: { points?: KeyPoint[]; deadlines?: Deadline[] } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : {};
      }
      const points = (parsed.points ?? [])
        .filter((p): p is KeyPoint => !!p && typeof p.label === "string")
        .slice(0, 12);
      const deadlines = (parsed.deadlines ?? [])
        .filter((d): d is Deadline => !!d && typeof d.date === "string" && typeof d.label === "string")
        .slice(0, 12);
      return { points, deadlines, source: "ai" };
    },
  );

// ---------------------------------------------------------------------------
// Atti collegati (semantic search nel corpus + fallback su topic_tags)
// ---------------------------------------------------------------------------

const RelatedInput = z.object({
  sourceId: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(8),
});

export type RelatedSource = {
  id: string;
  external_id: string;
  title: string;
  source_type: string;
  document_number: string | null;
  publication_date: string;
  topic_tags: string[];
  score: number;
  reason: "semantic" | "tags";
};

export const getRelatedSources = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RelatedInput.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ related: RelatedSource[] }> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.sourceId,
    );
    const filter = isUuid
      ? `id.eq.${data.sourceId},external_id.eq.${data.sourceId}`
      : `external_id.eq.${data.sourceId}`;
    const { data: src, error } = await supabaseAdmin
      .from("sources")
      .select("id, title, summary, excerpt, topic_tags")
      .or(filter)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Atto non trovato");

    const seed = [src.title, src.summary, (src.excerpt ?? "").slice(0, 1500)]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    // 1) Strada principale: embedding + match_chunks RPC, raggruppa per source.
    const scoreBySource = new Map<string, number>();
    if (seed.length > 50) {
      try {
        const vec = await embed(seed);
        const { data: matches, error: mErr } = await supabaseAdmin.rpc("match_chunks", {
          query_embedding: vec as unknown as string,
          match_count: Math.max(data.limit * 6, 40),
          filter_topics: undefined,
        });
        if (!mErr && matches) {
          for (const m of matches as Array<{ source_id: string; similarity: number }>) {
            if (m.source_id === src.id) continue;
            const prev = scoreBySource.get(m.source_id) ?? 0;
            // tieni il punteggio max tra i chunk dello stesso atto
            if (m.similarity > prev) scoreBySource.set(m.source_id, m.similarity);
          }
        }
      } catch {
        // si scende al fallback su topic_tags
      }
    }

    let related: RelatedSource[] = [];
    if (scoreBySource.size > 0) {
      const ids = Array.from(scoreBySource.keys());
      const { data: srows } = await supabaseAdmin
        .from("sources")
        .select("id, external_id, title, source_type, document_number, publication_date, topic_tags")
        .in("id", ids);
      related = (srows ?? [])
        .map((r) => ({
          id: r.id,
          external_id: r.external_id ?? r.id,
          title: r.title,
          source_type: r.source_type as string,
          document_number: r.document_number,
          publication_date: r.publication_date,
          topic_tags: r.topic_tags ?? [],
          score: scoreBySource.get(r.id) ?? 0,
          reason: "semantic" as const,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, data.limit);
    }

    // 2) Fallback: overlap di topic_tags.
    if (related.length === 0 && (src.topic_tags ?? []).length > 0) {
      const { data: srows } = await supabaseAdmin
        .from("sources")
        .select("id, external_id, title, source_type, document_number, publication_date, topic_tags")
        .overlaps("topic_tags", src.topic_tags ?? [])
        .neq("id", src.id)
        .order("publication_date", { ascending: false })
        .limit(data.limit);
      related = (srows ?? []).map((r) => {
        const overlap = (r.topic_tags ?? []).filter((t) => (src.topic_tags ?? []).includes(t));
        return {
          id: r.id,
          external_id: r.external_id ?? r.id,
          title: r.title,
          source_type: r.source_type as string,
          document_number: r.document_number,
          publication_date: r.publication_date,
          topic_tags: r.topic_tags ?? [],
          score: overlap.length / Math.max((src.topic_tags ?? []).length, 1),
          reason: "tags" as const,
        };
      });
    }

    return { related };
  });
