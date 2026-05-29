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
      // @ts-expect-error - join type
      .map((row) => ({
        id: row.workspace.id as string,
        name: row.workspace.name as string,
        slug: row.workspace.slug as string,
        role: row.role as "owner" | "admin" | "member" | "viewer",
      }));
  });

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
    const slug =
      data.slug ??
      data.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || `ws-${Date.now()}`;
    const { data: ws, error } = await supabase.rpc("create_workspace_with_owner", {
      _name: data.name,
      _slug: slug,
    });
    if (error) throw new Error(error.message);
    return ws;
  });
