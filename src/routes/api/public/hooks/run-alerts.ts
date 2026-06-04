import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Esegue il matching degli alert attivi contro i nuovi sources e scrive in alert_deliveries.
// Chiamato da pg_cron ogni ora. Idempotente: salta alert già eseguiti nella finestra
// di frequenza e dedup deliveries per (alert_id, source_id).
//
// Logica:
// - immediata    → finestra 1h, esegue ogni ora
// - giornaliera  → finestra 24h, esegue se last_run_at > 23h fa (o null)
// - settimanale  → finestra 7g,  esegue se last_run_at > 6.5 giorni fa (o null)

type Freq = "immediata" | "giornaliera" | "settimanale";

const WINDOW_HOURS: Record<Freq, number> = {
  immediata: 1,
  giornaliera: 24,
  settimanale: 24 * 7,
};
const MIN_INTERVAL_HOURS: Record<Freq, number> = {
  immediata: 1,
  giornaliera: 23,
  settimanale: 24 * 6.5,
};

async function runAlerts(force: boolean) {
  const { data: alerts, error } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const results: Array<{ alert_id: string; matched: number; inserted: number; skipped?: string }> = [];

  for (const a of alerts ?? []) {
    const freq = a.frequency as Freq;
    const minInterval = MIN_INTERVAL_HOURS[freq] * 3600 * 1000;
    if (!force && a.last_run_at && now - new Date(a.last_run_at).getTime() < minInterval) {
      results.push({ alert_id: a.id, matched: 0, inserted: 0, skipped: "interval" });
      continue;
    }

    const windowMs = WINDOW_HOURS[freq] * 3600 * 1000;
    const since = new Date(now - windowMs).toISOString().slice(0, 10);

    // Match topic_tags (overlap, case-sensitive come storato) + optional source_types
    const tagsLower = (a.topic_tags ?? []).map((t: string) => t.toLowerCase());

    let q = supabaseAdmin
      .from("sources")
      .select("id, title, full_text, source_type, publication_date, topic_tags")
      .gte("publication_date", since)
      .order("publication_date", { ascending: false })
      .limit(200);

    if (a.source_types && a.source_types.length > 0) {
      q = q.in("source_type", a.source_types);
    }

    const { data: candidates, error: cErr } = await q;
    if (cErr) {
      results.push({ alert_id: a.id, matched: 0, inserted: 0, skipped: cErr.message });
      continue;
    }

    const kw = (a.keyword_query ?? "").trim().toLowerCase();

    const matched = (candidates ?? []).filter((s) => {
      const sTags = (s.topic_tags ?? []).map((t: string) => t.toLowerCase());
      const tagHit = tagsLower.length === 0 || sTags.some((t) => tagsLower.includes(t));
      if (!tagHit) return false;
      if (kw) {
        const hay = `${s.title ?? ""} ${s.full_text ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    let inserted = 0;
    if (matched.length > 0) {
      // Dedup: prendi deliveries già esistenti per questo alert
      const { data: existing } = await supabaseAdmin
        .from("alert_deliveries")
        .select("source_id")
        .eq("alert_id", a.id)
        .in("source_id", matched.map((m) => m.id));
      const seen = new Set((existing ?? []).map((e) => e.source_id));
      const toInsert = matched
        .filter((m) => !seen.has(m.id))
        .map((m) => ({ alert_id: a.id, source_id: m.id, channel: "in_app" }));
      if (toInsert.length > 0) {
        const { error: insErr, count } = await supabaseAdmin
          .from("alert_deliveries")
          .insert(toInsert, { count: "exact" });
        if (insErr) {
          results.push({ alert_id: a.id, matched: matched.length, inserted: 0, skipped: insErr.message });
          continue;
        }
        inserted = count ?? toInsert.length;
      }
    }

    await supabaseAdmin
      .from("alerts")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", a.id);

    results.push({ alert_id: a.id, matched: matched.length, inserted });
  }

  return { ok: true, total: alerts?.length ?? 0, results };
}

export const Route = createFileRoute("/api/public/hooks/run-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const force = url.searchParams.get("force") === "1";
          const out = await runAlerts(force);
          return Response.json(out);
        } catch (e) {
          console.error("run-alerts failed", e);
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST per eseguire matching alert → deliveries" }),
    },
  },
});
