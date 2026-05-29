import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("notes")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workspaceId: string;
      title: string;
      body?: string;
      tags?: string[];
      linkedSourceId?: string | null;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          title: z.string().min(1).max(200),
          body: z.string().max(20000).optional(),
          tags: z.array(z.string().min(1).max(40)).max(15).optional(),
          linkedSourceId: z.string().uuid().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("notes")
      .insert({
        workspace_id: data.workspaceId,
        author_id: userId,
        title: data.title,
        body: data.body ?? null,
        tags: data.tags ?? [],
        linked_source_id: data.linkedSourceId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
