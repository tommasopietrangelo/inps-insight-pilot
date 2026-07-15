import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FLOW_SECTIONS = ["requisiti", "documenti", "controlli", "passi_successivi"] as const;
export type FlowSection = (typeof FLOW_SECTIONS)[number];

export type FlowChecklistItem = { section: FlowSection; title: string };

export type OperationalFlow = {
  id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  query: string;
  // Legacy rows may still contain string[]; UI must normalize with normalizeFlowChecklist().
  checklist_items: Array<FlowChecklistItem | string>;
  icon: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const ChecklistItemSchema = z.object({
  section: z.enum(FLOW_SECTIONS),
  title: z.string().min(1).max(500),
});

export function normalizeFlowChecklist(
  items: Array<FlowChecklistItem | string> | null | undefined,
): FlowChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) =>
      typeof it === "string"
        ? { section: "documenti" as FlowSection, title: it }
        : {
            section: (FLOW_SECTIONS as readonly string[]).includes(it.section)
              ? (it.section as FlowSection)
              : ("documenti" as FlowSection),
            title: String(it.title ?? ""),
          },
    )
    .filter((it) => it.title.trim().length > 0);
}

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
      checklistItems: Array<FlowChecklistItem | string>;
      icon?: string;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          title: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
          query: z.string().max(2000),
          checklistItems: z
            .array(z.union([z.string().min(1).max(500), ChecklistItemSchema]))
            .max(100),
          icon: z.string().max(50).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const normalized = normalizeFlowChecklist(data.checklistItems);
    const { data: row, error } = await supabase
      .from("operational_flows" as never)
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        title: data.title,
        description: data.description ?? null,
        query: data.query,
        checklist_items: normalized as never,
        icon: data.icon ?? null,
        is_default: false,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as OperationalFlow;
  });

export const updateOperationalFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      title?: string;
      description?: string | null;
      query?: string;
      checklistItems?: Array<FlowChecklistItem | string>;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(500).nullable().optional(),
          query: z.string().max(2000).optional(),
          checklistItems: z
            .array(z.union([z.string().min(1).max(500), ChecklistItemSchema]))
            .max(100)
            .optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.query !== undefined) patch.query = data.query;
    if (data.checklistItems !== undefined)
      patch.checklist_items = normalizeFlowChecklist(data.checklistItems);
    const { data: row, error } = await supabase
      .from("operational_flows" as never)
      .update(patch as never)
      .eq("id", data.id)
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
