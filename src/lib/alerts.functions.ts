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

export const listAlertDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; limit?: number }) =>
    z.object({ workspaceId: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: alertRows } = await supabase
      .from("alerts")
      .select("id, name, priority")
      .eq("workspace_id", data.workspaceId);
    const ids = (alertRows ?? []).map((a) => a.id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await supabase
      .from("alert_deliveries")
      .select("id, alert_id, source_id, delivered_at, read_at, sources(id, external_id, title, source_type, publication_date)")
      .in("alert_id", ids)
      .order("delivered_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    const byId = new Map(alertRows!.map((a) => [a.id, a]));
    return (rows ?? []).map((r) => ({ ...r, alert: byId.get(r.alert_id) ?? null }));
  });

export const markDeliveryRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("alert_deliveries")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Esegue il matching adesso (manual trigger dalla UI). Chiama l'endpoint pubblico
// con ?force=1 così bypassa l'intervallo minimo per ogni frequenza.
export const runAlertsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const base =
      process.env.PUBLIC_APP_URL ||
      "https://project--a1e945c3-ebbe-431d-a805-2a88f4b444cc.lovable.app";
    const res = await fetch(`${base}/api/public/hooks/run-alerts?force=1`, { method: "POST" });
    if (!res.ok) throw new Error(`run-alerts http ${res.status}`);
    return (await res.json()) as { ok: boolean; total: number; results: unknown[] };
  });
