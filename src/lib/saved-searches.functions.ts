import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { query: string; workspaceId?: string | null; resultsCount?: number }) =>
      z
        .object({
          query: z.string().min(1).max(500),
          workspaceId: z.string().uuid().nullable().optional(),
          resultsCount: z.number().int().min(0).max(10000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: userId,
        workspace_id: data.workspaceId ?? null,
        query: data.query,
        results_count: data.resultsCount ?? null,
        filters: {},
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("saved_searches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
