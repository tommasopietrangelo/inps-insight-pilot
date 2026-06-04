import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KindEnum = z.enum(["checklist", "analyze", "summarize", "compare"]);
export type PracticeKind = z.infer<typeof KindEnum>;

export const listPractices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; kind?: PracticeKind }) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        kind: KindEnum.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("practices")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("updated_at", { ascending: false });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const savePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workspaceId: string;
      kind: PracticeKind;
      title: string;
      input?: unknown;
      result: unknown;
      checked?: string[];
      id?: string;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          kind: KindEnum,
          title: z.string().min(1).max(300),
          input: z.unknown().optional(),
          result: z.unknown(),
          checked: z.array(z.string().max(100)).max(500).optional(),
          id: z.string().uuid().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("practices")
        .update({
          title: data.title,
          input: (data.input ?? {}) as never,
          result: data.result as never,
          checked: data.checked ?? [],
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("practices")
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        kind: data.kind,
        title: data.title,
        input: (data.input ?? {}) as never,
        result: data.result as never,
        checked: data.checked ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("practices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
