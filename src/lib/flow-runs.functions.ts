import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STOPWORDS = new Set([
  "nuova","nuovo","domanda","valutazione","rinnovo","dopo","per","di","del","della",
  "la","il","con","gli","le","dei","al","alla","un","una","in","da","e",
]);

function derivePrefixFromTitle(title: string): string {
  const words = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  const pick = words.find((w) => w.length >= 3) ?? words[0] ?? "PRAT";
  return pick.slice(0, 6).toUpperCase();
}

export const listFlowRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; flowId: string }) =>
    z.object({ workspaceId: z.string().uuid(), flowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("practices" as never)
      .select("*")
      .eq("workspace_id" as never, data.workspaceId)
      .eq("flow_id" as never, data.flowId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<Record<string, unknown>>;
  });

export const createFlowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; flowId: string; label?: string }) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        flowId: z.string().uuid(),
        label: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: flow, error: fErr } = await supabase
      .from("operational_flows" as never)
      .select("*")
      .eq("id", data.flowId)
      .single();
    if (fErr || !flow) throw new Error(fErr?.message ?? "Flusso non trovato");
    const f = flow as unknown as {
      id: string;
      title: string;
      description: string | null;
      query: string;
      checklist_items: string[];
      code_prefix: string | null;
    };

    const prefix = (f.code_prefix?.trim() || derivePrefixFromTitle(f.title)).toUpperCase();

    const { count, error: cErr } = await supabase
      .from("practices")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", data.workspaceId)
      .eq("flow_id", data.flowId);
    if (cErr) throw new Error(cErr.message);
    const seq = (count ?? 0) + 1;
    const code = `${prefix}-${String(seq).padStart(3, "0")}`;

    const items = (f.checklist_items ?? []).map((title, idx) => ({
      id: `flow-${f.id}-${idx}`,
      section: "documenti",
      title,
      status: "da_verificare",
      explanation: "",
      citations: [],
    }));

    const seededResult = {
      practiceType: f.title,
      summary:
        f.description ??
        "Sotto-pratica creata dal flusso operativo. Genera l'analisi AI per arricchirla con riferimenti INPS.",
      disclaimer:
        "Preset da flusso ricorrente — verifica sempre con le fonti INPS più recenti.",
      items,
      usedSources: [],
    };

    const title = data.label?.trim()
      ? `${code} · ${data.label.trim()}`
      : `${code} · ${f.title}`;

    const { data: row, error } = await supabase
      .from("practices")
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        kind: "flow_run" as never,
        flow_id: f.id,
        practice_code: code,
        title,
        input: { query: f.query, flowTitle: f.title, label: data.label ?? null } as never,
        result: seededResult as never,
        checked: [],
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getPractice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("practices")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
