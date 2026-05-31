import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const Input = z.object({
  aId: z.string().uuid(),
  bId: z.string().uuid(),
});

export type CompareDiff = {
  summary: string;
  superseded: string[];
  stillValid: string[];
  newRules: string[];
  openQuestions: string[];
};

export const compareSources = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<CompareDiff> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const { data: rows, error } = await supabaseAdmin
      .from("sources")
      .select("id, title, source_type, document_number, publication_date, summary, full_text, excerpt, topic_tags")
      .in("id", [data.aId, data.bId]);
    if (error) throw new Error(error.message);
    if (!rows || rows.length < 2) throw new Error("Atti non trovati");

    const byId = new Map(rows.map((r) => [r.id, r]));
    const a = byId.get(data.aId)!;
    const b = byId.get(data.bId)!;
    // older first, newer second for clarity
    const [older, newer] = a.publication_date <= b.publication_date ? [a, b] : [b, a];

    const fmt = (s: typeof a) =>
      `${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title}\n` +
      `Data: ${s.publication_date}\nTopic: ${(s.topic_tags ?? []).join(", ")}\n\n` +
      `${(s.full_text || s.excerpt || s.summary || "").slice(0, 14000)}`;

    const system =
      "Sei un esperto di previdenza e welfare italiano per CAF e patronati. " +
      "Confronta due atti INPS o normativi e produci un'analisi precisa in italiano. " +
      "Cita SEMPRE i numeri o le sezioni quando indichi una regola. " +
      "Restituisci SOLO JSON valido senza testo aggiuntivo, secondo lo schema richiesto.";

    const user =
      `ATTO PRECEDENTE\n==============\n${fmt(older)}\n\n` +
      `ATTO PIÙ RECENTE\n================\n${fmt(newer)}\n\n` +
      `Produci JSON con questa forma:\n` +
      `{\n` +
      `  "summary": "2-3 frasi sulle differenze chiave",\n` +
      `  "superseded": ["regola dell'atto precedente superata o abrogata dall'atto recente, con riferimento"],\n` +
      `  "stillValid": ["regola dell'atto precedente ancora applicabile, con riferimento"],\n` +
      `  "newRules": ["nuova regola introdotta dall'atto recente, con riferimento"],\n` +
      `  "openQuestions": ["punti ambigui o che richiedono ulteriore istruzione operativa"]\n` +
      `}\n`;

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
      if (res.status === 429) throw new Error("Limite di richieste raggiunto, riprova fra poco.");
      if (res.status === 402) throw new Error("Crediti AI esauriti.");
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: CompareDiff;
    try {
      parsed = JSON.parse(content);
    } catch {
      // try to extract json
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { summary: content, superseded: [], stillValid: [], newRules: [], openQuestions: [] };
    }
    return {
      summary: parsed.summary ?? "",
      superseded: parsed.superseded ?? [],
      stillValid: parsed.stillValid ?? [],
      newRules: parsed.newRules ?? [],
      openQuestions: parsed.openQuestions ?? [],
    };
  });
