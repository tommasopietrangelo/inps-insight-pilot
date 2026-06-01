import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type AnalysisIssue = {
  severity: "alta" | "media" | "bassa";
  category: string;
  excerpt: string;
  problem: string;
  suggestion: string;
  citations: { sourceId?: string; label: string }[];
};

export type AnalysisResult = {
  summary: string;
  overallScore: number; // 0-100
  issues: AnalysisIssue[];
  correctedText: string;
  usedSources: { id: string; title: string; source_type: string; document_number: string | null; publication_date: string }[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function pickRelevantSources(text: string, limit = 8) {
  // naive keyword-based retrieval over corpus
  const lower = text.toLowerCase();
  const tokens = Array.from(
    new Set(
      lower
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    ),
  ).slice(0, 40);

  const { data, error } = await supabaseAdmin
    .from("sources")
    .select("id, title, source_type, document_number, publication_date, summary, excerpt, full_text, topic_tags")
    .order("publication_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const scored = (data ?? []).map((s) => {
    const hay = `${s.title} ${s.summary ?? ""} ${(s.topic_tags ?? []).join(" ")} ${(s.excerpt ?? "").slice(0, 400)}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((x) => x.score > 0).slice(0, limit).map((x) => x.s);
}

const AnalyzeInput = z.object({
  text: z.string().min(50).max(60000),
  title: z.string().max(300).optional(),
});

export const analyzeDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const text = data.text.slice(0, 24000);
    const candidates = await pickRelevantSources(text, 8);
    const corpusBlock = candidates
      .map(
        (s, i) =>
          `[S${i + 1}] (${s.id}) ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title} (${s.publication_date})\n${(s.summary ?? s.excerpt ?? "").slice(0, 900)}`,
      )
      .join("\n\n");

    const system =
      "Sei un revisore esperto INPS per CAF e patronati. Analizzi documenti professionali confrontandoli con il corpus normativo fornito. " +
      "Identifica errori, riferimenti normativi superati, importi/aliquote non corretti, requisiti mancanti, terminologia errata. " +
      "Per ogni problema cita le fonti del corpus con il loro id [S#]. Produci anche una versione corretta del testo che mantenga lo stile originale. " +
      "Restituisci SOLO JSON valido secondo lo schema indicato.";

    const user =
      `TITOLO: ${data.title ?? "Documento"}\n\n` +
      `CORPUS DI RIFERIMENTO:\n${corpusBlock || "(nessuna fonte rilevante trovata)"}\n\n` +
      `DOCUMENTO DA ANALIZZARE:\n${text}\n\n` +
      `Produci JSON con questa forma:\n` +
      `{\n` +
      `  "summary": "panoramica in 3-4 frasi della correttezza complessiva",\n` +
      `  "overallScore": 0-100,\n` +
      `  "issues": [{\n` +
      `    "severity": "alta|media|bassa",\n` +
      `    "category": "es. Riferimento normativo, Importo, Procedura, Terminologia",\n` +
      `    "excerpt": "frammento esatto dal documento (max 200 caratteri)",\n` +
      `    "problem": "perché è un problema",\n` +
      `    "suggestion": "come correggere",\n` +
      `    "citations": [{"sourceRef": "S1", "label": "Circ. 12/2024 art. 3"}]\n` +
      `  }],\n` +
      `  "correctedText": "versione corretta integrale del documento"\n` +
      `}`;

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
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const issues: AnalysisIssue[] = (parsed.issues ?? []).map((it: any) => {
      const cites = (it.citations ?? []).map((c: any) => {
        const ref = String(c.sourceRef ?? c.ref ?? "").replace(/[^0-9]/g, "");
        const idx = ref ? parseInt(ref, 10) - 1 : -1;
        const src = idx >= 0 ? candidates[idx] : undefined;
        return { sourceId: src?.id, label: c.label ?? (src ? `${src.source_type} ${src.document_number ?? ""}`.trim() : "") };
      });
      return {
        severity: (it.severity ?? "media") as AnalysisIssue["severity"],
        category: it.category ?? "Generale",
        excerpt: it.excerpt ?? "",
        problem: it.problem ?? "",
        suggestion: it.suggestion ?? "",
        citations: cites,
      };
    });

    return {
      summary: parsed.summary ?? "",
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 70,
      issues,
      correctedText: parsed.correctedText ?? text,
      usedSources: candidates.map((s) => ({
        id: s.id,
        title: s.title,
        source_type: s.source_type,
        document_number: s.document_number,
        publication_date: s.publication_date,
      })),
    };
  });

const ChatInput = z.object({
  documentText: z.string().min(20).max(60000),
  documentTitle: z.string().max(300).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(40)
    .default([]),
  question: z.string().min(2).max(2000),
});

export const chatAboutDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data }): Promise<{ answer: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const system =
      "Sei un assistente esperto INPS. Rispondi SOLO usando il documento fornito dall'utente. " +
      "Se l'informazione non è presente nel documento, dichiaralo esplicitamente e non inventare. " +
      "Rispondi in italiano, in modo conciso e operativo. Cita tra virgolette i passaggi pertinenti.";

    const docBlock = `TITOLO: ${data.documentTitle ?? "Documento"}\n\nCONTENUTO:\n${data.documentText.slice(0, 24000)}`;

    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: docBlock },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.question },
    ];

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite di richieste raggiunto, riprova fra poco.");
      if (res.status === 402) throw new Error("Crediti AI esauriti.");
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const json = await res.json();
    return { answer: json.choices?.[0]?.message?.content ?? "" };
  });
