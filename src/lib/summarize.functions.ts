import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const Input = z.object({
  sourceId: z.string().uuid().optional(),
  rawText: z.string().min(50).max(60000).optional(),
  title: z.string().max(300).optional(),
}).refine((d) => !!d.sourceId || !!d.rawText, {
  message: "Fornisci un atto dal corpus oppure incolla il testo del documento.",
});

export type SummaryResult = {
  title: string;
  tldr: string;
  keyPoints: string[];
  obligations: string[];
  deadlines: string[];
  whoIsAffected: string[];
  operationalNotes: string[];
};

export const summarizeSource = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<SummaryResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    let title = data.title ?? "Documento caricato";
    let body = data.rawText ?? "";
    let meta = "";

    if (data.sourceId) {
      const { data: row, error } = await supabaseAdmin
        .from("sources")
        .select("title, source_type, document_number, publication_date, summary, full_text, excerpt, topic_tags")
        .eq("id", data.sourceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Atto non trovato nel corpus.");
      title = row.title;
      body = (row.full_text || row.excerpt || row.summary || "").slice(0, 18000);
      meta =
        `Tipo: ${row.source_type}\nNumero: ${row.document_number ?? "-"}\n` +
        `Data: ${row.publication_date}\nTopic: ${(row.topic_tags ?? []).join(", ")}\n\n`;
    } else {
      body = body.slice(0, 18000);
    }

    const system =
      "Sei un esperto di previdenza e welfare italiano per CAF e patronati. " +
      "Riassumi atti INPS, normative e messaggi in italiano in modo operativo. " +
      "Cita SEMPRE numeri di articolo, paragrafo o sezione quando esistono. " +
      "Restituisci SOLO JSON valido secondo lo schema indicato, senza testo extra.";

    const user =
      `TITOLO: ${title}\n${meta}TESTO:\n${body}\n\n` +
      `Produci JSON con questa forma:\n` +
      `{\n` +
      `  "title": "titolo sintetico (max 120 caratteri)",\n` +
      `  "tldr": "3-4 frasi che riassumono lo scopo dell'atto",\n` +
      `  "keyPoints": ["punto chiave con riferimento"],\n` +
      `  "obligations": ["obblighi o adempimenti introdotti"],\n` +
      `  "deadlines": ["scadenze o date rilevanti"],\n` +
      `  "whoIsAffected": ["destinatari / categorie interessate"],\n` +
      `  "operationalNotes": ["note operative per CAF/patronato"]\n` +
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
    let parsed: Partial<SummaryResult>;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }
    return {
      title: parsed.title ?? title,
      tldr: parsed.tldr ?? "",
      keyPoints: parsed.keyPoints ?? [],
      obligations: parsed.obligations ?? [],
      deadlines: parsed.deadlines ?? [],
      whoIsAffected: parsed.whoIsAffected ?? [],
      operationalNotes: parsed.operationalNotes ?? [],
    };
  });
