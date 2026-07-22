import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanId = "free" | "studio" | "pro" | "enterprise";

export interface PlanCatalogEntry {
  id: PlanId;
  name: string;
  priceEur: number | null; // null = custom
  seats: number;
  queriesMonthly: number;
  sourcesMonthly: number;
  features: string[];
  highlight?: boolean;
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: "free",
    name: "Free / Trial",
    priceEur: 0,
    seats: 1,
    queriesMonthly: 50,
    sourcesMonthly: 20,
    features: ["Lettura corpus INPS", "Ricerca in linguaggio naturale", "1 utente"],
  },
  {
    id: "studio",
    name: "Studio",
    priceEur: 39,
    seats: 3,
    queriesMonthly: 500,
    sourcesMonthly: 200,
    features: [
      "Flussi operativi + sotto-pratiche",
      "Reminder da chat",
      "Memoria AI condivisa",
      "3 utenti",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 99,
    seats: 10,
    queriesMonthly: 2500,
    sourcesMonthly: 1000,
    features: [
      "Tutto di Studio",
      "Avvisi automatici e cron INPS",
      "Batch Firecrawl",
      "Supporto prioritario",
      "10 utenti",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceEur: null,
    seats: 999,
    queriesMonthly: 999999,
    sourcesMonthly: 999999,
    features: ["SSO SAML", "Audit log", "Onboarding dedicato", "DPA", "Utenti illimitati"],
  },
];

export interface SubscriptionInfo {
  plan: PlanId;
  status: "trialing" | "active" | "past_due" | "canceled";
  seats_limit: number;
  queries_limit_monthly: number;
  sources_limit_monthly: number;
  trial_ends_at: string | null;
  current_period_end: string;
  usage: {
    queries: number;
    sources: number;
    firecrawl: number;
    seats_used: number;
  };
}

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SubscriptionInfo> => {
    const { supabase } = context;

    // Ensure row exists (in case of pre-migration workspaces)
    await supabase.rpc("ensure_workspace_subscription" as never, { _ws: data.workspaceId } as never);

    const { data: sub, error } = await supabase
      .from("workspace_subscriptions" as never)
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .single();
    if (error) throw new Error(error.message);

    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: usage } = await supabase
      .from("workspace_usage_monthly" as never)
      .select("queries_count, sources_added, firecrawl_calls")
      .eq("workspace_id", data.workspaceId)
      .eq("period", period)
      .maybeSingle();

    const [{ count: members }, { count: pending }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("workspace_invitations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("status", "pending"),
    ]);

    const s = sub as unknown as {
      plan: PlanId;
      status: SubscriptionInfo["status"];
      seats_limit: number;
      queries_limit_monthly: number;
      sources_limit_monthly: number;
      trial_ends_at: string | null;
      current_period_end: string;
    };
    const u = (usage ?? {}) as {
      queries_count?: number;
      sources_added?: number;
      firecrawl_calls?: number;
    };

    return {
      plan: s.plan,
      status: s.status,
      seats_limit: s.seats_limit,
      queries_limit_monthly: s.queries_limit_monthly,
      sources_limit_monthly: s.sources_limit_monthly,
      trial_ends_at: s.trial_ends_at,
      current_period_end: s.current_period_end,
      usage: {
        queries: u.queries_count ?? 0,
        sources: u.sources_added ?? 0,
        firecrawl: u.firecrawl_calls ?? 0,
        seats_used: (members ?? 0) + (pending ?? 0),
      },
    };
  });

/**
 * Placeholder for plan upgrade. Real billing (Stripe) is not wired yet — this
 * only updates the subscription record locally so quotas apply immediately.
 * Only workspace owner/admin may call it.
 */
export const requestPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; plan: PlanId }) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        plan: z.enum(["free", "studio", "pro", "enterprise"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!role || (role.role !== "owner" && role.role !== "admin")) {
      throw new Error("Solo il proprietario o admin può modificare il piano");
    }

    if (data.plan === "enterprise") {
      throw new Error("Contatta il team commerciale per il piano Enterprise");
    }

    const entry = PLAN_CATALOG.find((p) => p.id === data.plan)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("workspace_subscriptions" as never)
      .update({
        plan: data.plan,
        status: data.plan === "free" ? "trialing" : "active",
        seats_limit: entry.seats,
        queries_limit_monthly: entry.queriesMonthly,
        sources_limit_monthly: entry.sourcesMonthly,
      } as never)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true, note: "Aggiornamento locale · integrazione pagamento non ancora attiva" };
  });
