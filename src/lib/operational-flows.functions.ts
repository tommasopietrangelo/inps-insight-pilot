import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OperationalFlow = {
  id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  query: string;
  checklist_items: string[];
  icon: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const listOperationalFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("operational_flows" as never)
      .select("*")
      .or(`workspace_id.is.null,workspace_id.eq.${data.workspaceId}`)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as OperationalFlow[];
  });

export const createOperationalFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workspaceId: string;
      title: string;
      description?: string;
      query: string;
      checklistItems: string[];
      icon?: string;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          title: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
          query: z.string().max(2000),
          checklistItems: z.array(z.string().min(1).max(500)).max(50),
          icon: z.string().max(50).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("operational_flows" as never)
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        title: data.title,
        description: data.description ?? null,
        query: data.query,
        checklist_items: data.checklistItems as never,
        icon: data.icon ?? null,
        is_default: false,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as OperationalFlow;
  });

export const deleteOperationalFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("operational_flows" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
