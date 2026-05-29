import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, slug)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((row) => row.workspace)
      .map((row) => {
        const ws = row.workspace as unknown as { id: string; name: string; slug: string };
        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          role: row.role as "owner" | "admin" | "member" | "viewer",
        };
      });
  });

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || `ws-${Date.now()}`;
}

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; slug?: string }) =>
    z
      .object({
        name: z.string().min(2).max(80),
        slug: z
          .string()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = data.slug ?? slugify(data.name);
    const { data: ws, error } = await supabase.rpc("create_workspace_with_owner", {
      _name: data.name,
      _slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
    });
    if (error) throw new Error(error.message);
    return ws;
  });
