import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FrequencyEnum = z.enum(["immediata", "giornaliera", "settimanale"]);
const PriorityEnum = z.enum(["alta", "media", "bassa"]);
const SourceTypeEnum = z.enum([
  "circolare",
  "decreto",
  "messaggio",
  "normativa",
  "pagina_servizio",
]);
type SourceTypeValue = z.infer<typeof SourceTypeEnum>;

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workspaceId: string;
      name: string;
      topicTags: string[];
      sourceTypes?: SourceTypeValue[];
      frequency: "immediata" | "giornaliera" | "settimanale";
      priority: "alta" | "media" | "bassa";
      channels: string[];
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          name: z.string().min(1).max(120),
          topicTags: z.array(z.string().min(1).max(60)).min(1).max(10),
          sourceTypes: z.array(SourceTypeEnum).max(10).optional(),
          frequency: FrequencyEnum,
          priority: PriorityEnum,
          channels: z.array(z.string().min(1).max(20)).min(1).max(5),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("alerts")
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        name: data.name,
        topic_tags: data.topicTags,
        source_types: data.sourceTypes ?? null,
        frequency: data.frequency,
        priority: data.priority,
        channels: data.channels,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("alerts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
