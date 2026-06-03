import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type ChecklistStatus = "presente" | "mancante" | "da_verificare";
export type ChecklistSection =
  | "requisiti"
  | "documenti"
  | "controlli"
  | "passi_successivi";

export type ChecklistItem = {
  id: string;
  section: ChecklistSection;
  title: string;
  status: ChecklistStatus;
  explanation: string;
  citations: {
    sourceId?: string;
    label: string;
    document_number?: string | null;
    source_type?: string | null;
  }[];
};

export type ChecklistResult = {
  practiceType: string;
  summary: string;
  disclaimer: string;
  items: ChecklistItem[];
  usedSources: {
    id: string;
    title: string;
    source_type: string;
    document_number: string | null;
    publication_date: string;
    official_url: string | null;
  }[];
};

async function embed(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurata");
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 6000) }),
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

function vecLit(v: number[]) {
  return `[${v.join(",")}]`;
}

const Input = z.object({
  query: z.string().max(2000).optional().default(""),
  documentText: z.string().max(60000).optional().default(""),
  documentTitle: z.string().max(300).optional().default(""),
});

export const generateChecklist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ChecklistResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const query = (data.query ?? "").trim();
    const docText = (data.documentText ?? "").trim();
    if (!query && docText.length < 30) {
      throw new Error("Inserisci una descrizione della pratica o carica un documento.");
    }

    // Build retrieval query from user query + first portion of document text
    const retrievalText = [query, docText.slice(0, 3000)].filter(Boolean).join("\n\n");
    const queryEmb = await embed(retrievalText);

    const { data: matches, error } = await supabaseAdmin.rpc("match_chunks", {
      query_embedding: vecLit(queryEmb) as unknown as string,
      match_count: 8,
    });
    if (error) throw new Error(`match_chunks: ${error.message}`);

    const sources = (matches ?? []).map((m: any, i: number) => ({
      n: i + 1,
      source_id: m.source_id as string,
      title: m.source_title as string,
      source_type: m.source_type as string,
      document_number: (m.document_number ?? null) as string | null,
      publication_date: m.publication_date as string,
      official_url: (m.official_url ?? null) as string | null,
      excerpt: ((m.content ?? "") as string).slice(0, 1600),
    }));

    const corpusBlock = sources
      .map(
        (s) =>
          `[${s.n}] ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title} (${s.publication_date})\n${s.excerpt}`,
      )
      .join("\n\n");

    const system =
      "Sei un assistente operativo per CAF e patronati che gestiscono pratiche INPS. " +
      "Devi produrre una checklist operativa per una pratica, basandoti SOLO sulle fonti del corpus fornite. " +
      "Non fornire certezze legali e non dichiarare che la checklist è definitiva o esaustiva. " +
      "Se un'informazione non è ricavabile dalle fonti o dal documento, imposta lo status a \"da_verificare\". " +
      "Ogni voce della checklist DEVE essere accompagnata da almeno una citazione [n] alle fonti fornite. " +
      "Non inventare riferimenti normativi. Rispondi SOLO in JSON valido secondo lo schema indicato.";

    const userParts: string[] = [];
    if (query) userParts.push(`RICHIESTA DELL'OPERATORE:\n${query}`);
    if (docText) {
      userParts.push(
        `DOCUMENTI CARICATI (${data.documentTitle || "senza titolo"}):\n${docText.slice(0, 22000)}`,
      );
    }
    userParts.push(`FONTI INPS DISPONIBILI:\n${corpusBlock || "(nessuna fonte trovata)"}`);
    userParts.push(
      `Produci JSON con questa forma esatta:\n` +
        `{\n` +
        `  "practiceType": "es. Domanda NASpI, Assegno Unico, Pensione di vecchiaia",\n` +
        `  "summary": "1-2 frasi: cosa stiamo verificando e con quali fonti",\n` +
        `  "items": [{\n` +
        `    "section": "requisiti|documenti|controlli|passi_successivi",\n` +
        `    "title": "voce breve (max 90 caratteri)",\n` +
        `    "status": "presente|mancante|da_verificare",\n` +
        `    "explanation": "spiegazione pratica in 1-3 frasi, riferita al contesto operativo INPS",\n` +
        `    "citations": [{"ref": 1, "label": "Circ. 12/2024 art. 3"}]\n` +
        `  }]\n` +
        `}\n\n` +
        `Regole:\n` +
        `- Includi voci in TUTTE e 4 le sezioni quando possibile.\n` +
        `- "presente" SOLO se l'evidenza è chiara nei documenti caricati.\n` +
        `- "mancante" se la fonte richiede qualcosa che non risulta nei documenti.\n` +
        `- "da_verificare" se l'informazione è incompleta o ambigua.\n` +
        `- Se non ci sono documenti caricati, marca i documenti come "da_verificare".`,
    );

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userParts.join("\n\n") },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite di richieste raggiunto, riprova fra poco.");
      if (res.status === 402) throw new Error("Crediti AI esauriti per il workspace.");
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

    const validSections: ChecklistSection[] = ["requisiti", "documenti", "controlli", "passi_successivi"];
    const validStatus: ChecklistStatus[] = ["presente", "mancante", "da_verificare"];

    const items: ChecklistItem[] = (parsed.items ?? []).map((it: any, idx: number) => {
      const section = validSections.includes(it.section) ? (it.section as ChecklistSection) : "controlli";
      const status = validStatus.includes(it.status) ? (it.status as ChecklistStatus) : "da_verificare";
      const cites = (it.citations ?? []).map((c: any) => {
        const refNum = parseInt(String(c.ref ?? c.sourceRef ?? "").replace(/[^0-9]/g, ""), 10);
        const src = !isNaN(refNum) ? sources[refNum - 1] : undefined;
        return {
          sourceId: src?.source_id,
          label:
            c.label ||
            (src ? `${src.source_type} ${src.document_number ?? ""}`.trim() : "Fonte"),
          document_number: src?.document_number ?? null,
          source_type: src?.source_type ?? null,
        };
      });
      return {
        id: `${section}-${idx}`,
        section,
        title: String(it.title ?? "").slice(0, 200),
        status,
        explanation: String(it.explanation ?? ""),
        citations: cites,
      };
    });

    // Deduplicate sources used
    const usedMap = new Map<string, ChecklistResult["usedSources"][number]>();
    for (const it of items) {
      for (const c of it.citations) {
        if (c.sourceId && !usedMap.has(c.sourceId)) {
          const src = sources.find((s) => s.source_id === c.sourceId);
          if (src) {
            usedMap.set(src.source_id, {
              id: src.source_id,
              title: src.title,
              source_type: src.source_type,
              document_number: src.document_number,
              publication_date: src.publication_date,
              official_url: src.official_url,
            });
          }
        }
      }
    }

    return {
      practiceType: String(parsed.practiceType ?? "Pratica INPS"),
      summary: String(parsed.summary ?? ""),
      disclaimer:
        "Checklist operativa generata automaticamente a partire dal corpus INPS. Non costituisce parere legale e non sostituisce la verifica del professionista.",
      items,
      usedSources: Array.from(usedMap.values()),
    };
  });
