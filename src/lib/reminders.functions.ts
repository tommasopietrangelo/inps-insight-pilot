import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type ReminderSourceRef = {
  n: number;
  label: string;
  sourceId: string;
};

export type Reminder = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  sourceRefs: ReminderSourceRef[];
  question: string;
  createdAt: string;
};

const SourceIn = z.object({
  n: z.number(),
  source_id: z.string().uuid(),
  title: z.string(),
  source_type: z.string(),
  document_number: z.string().nullable().optional(),
});

const GenInput = z.object({
  question: z.string().min(2).max(4000),
  answer: z.string().min(2).max(20000),
  sources: z.array(SourceIn).max(30).default([]),
});

export const generateReminder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY non configurata");

    const srcBlock = data.sources
      .map(
        (s) =>
          `[${s.n}] ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title}`,
      )
      .join("\n");

    const system =
      "Sei un assistente operativo per CAF e patronati che gestiscono pratiche INPS. " +
      "Il tuo compito è trasformare una risposta di chat in un reminder operativo sintetico e chiaro, " +
      "utile a guidare l'operatore durante il lavoro sulla pratica. " +
      "Rispondi SOLO in JSON valido secondo lo schema indicato.";

    const user =
      `DOMANDA DELL'OPERATORE:\n${data.question}\n\n` +
      `RISPOSTA GENERATA (con citazioni [n]):\n${data.answer.slice(0, 12000)}\n\n` +
      (srcBlock ? `FONTI INPS CITATE:\n${srcBlock}\n\n` : "") +
      `Produci JSON con questa forma esatta:\n` +
      `{\n` +
      `  "title": "titolo breve del reminder (max 90 char)",\n` +
      `  "summary": "riassunto operativo in 2-3 frasi, in italiano, che guidi il lavoro dell'operatore",\n` +
      `  "bullets": ["punto operativo 1", "punto 2", "..."]\n` +
      `}\n\n` +
      `Regole: 4-8 bullet, ognuno max 160 caratteri, imperativi/operativi (Verifica…, Controlla…, Allega…). ` +
      `Mantieni i riferimenti [n] tra parentesi quadre dove pertinenti.`;

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
      if (res.status === 429) throw new Error("Limite richieste raggiunto.");
      if (res.status === 402) throw new Error("Crediti AI esauriti.");
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; summary?: string; bullets?: unknown } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
          .map((b) => String(b ?? "").trim())
          .filter((b) => b.length > 2)
          .slice(0, 10)
      : [];

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      title: String(parsed.title ?? "Reminder operativo").slice(0, 120),
      summary: String(parsed.summary ?? "").slice(0, 1200),
      bullets,
      sourceRefs: data.sources.map((s) => ({
        n: s.n,
        label: `${s.source_type}${s.document_number ? " " + s.document_number : ""}`,
        sourceId: s.source_id,
      })),
      question: data.question,
      createdAt: new Date().toISOString(),
    };
    return reminder;
  });

const ReminderShape = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()),
  sourceRefs: z.array(
    z.object({ n: z.number(), label: z.string(), sourceId: z.string().uuid() }),
  ),
  question: z.string(),
  createdAt: z.string(),
});

export const pinReminderToPractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { practiceId: string; reminder: Reminder }) =>
    z
      .object({
        practiceId: z.string().uuid(),
        reminder: ReminderShape,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("practices")
      .select("input")
      .eq("id", data.practiceId)
      .single();
    if (error) throw new Error(error.message);
    const input = (row?.input ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(
      (input as { pinnedReminders?: unknown }).pinnedReminders,
    )
      ? ((input as { pinnedReminders: Reminder[] }).pinnedReminders)
      : [];
    const nextInput = { ...input, pinnedReminders: [data.reminder, ...existing].slice(0, 20) };
    const { error: uErr } = await supabase
      .from("practices")
      .update({ input: nextInput as never })
      .eq("id", data.practiceId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const unpinReminderFromPractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { practiceId: string; reminderId: string }) =>
    z
      .object({ practiceId: z.string().uuid(), reminderId: z.string() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("practices")
      .select("input")
      .eq("id", data.practiceId)
      .single();
    if (error) throw new Error(error.message);
    const input = (row?.input ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(
      (input as { pinnedReminders?: unknown }).pinnedReminders,
    )
      ? ((input as { pinnedReminders: Reminder[] }).pinnedReminders)
      : [];
    const nextInput = {
      ...input,
      pinnedReminders: existing.filter((r) => r.id !== data.reminderId),
    };
    const { error: uErr } = await supabase
      .from("practices")
      .update({ input: nextInput as never })
      .eq("id", data.practiceId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

/** Serializes a reminder into a note body for the workspace. */
export function reminderToNoteBody(r: Reminder): string {
  const lines: string[] = [];
  if (r.summary) lines.push(r.summary);
  if (r.bullets.length) {
    lines.push("");
    for (const b of r.bullets) lines.push(`• ${b}`);
  }
  if (r.sourceRefs.length) {
    lines.push("", "Fonti INPS:");
    for (const s of r.sourceRefs) lines.push(`[${s.n}] ${s.label}`);
  }
  lines.push("", `— Da chat: ${r.question}`);
  return lines.join("\n");
}
