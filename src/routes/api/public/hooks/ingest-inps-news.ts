import { createFileRoute } from "@tanstack/react-router";
import { ingestNewsDaily } from "@/lib/inps-news.functions";
import { ingestEmbeddings } from "@/lib/search.functions";

// Endpoint pubblico chiamato da pg_cron per il retrieval giornaliero delle
// notizie INPS (/inps-comunica/notizie/...). Stessa logica del cron circolari:
// scheduliamo a 04:00 e 05:00 UTC (coprono CEST/CET) e lasciamo passare solo
// l'esecuzione in cui a Roma sono effettivamente le 06:00. Bypass con ?force=1.
//
// Modalità catch-up: se non ci sono notizie ingestite negli ultimi 3 giorni
// (es. crediti Firecrawl bloccati o cron fermo), la prima esecuzione utile
// scarica fino a 100 notizie invece delle 30 giornaliere, così da recuperare
// il backlog. Le esecuzioni successive tornano automaticamente a 30.
export const Route = createFileRoute("/api/public/hooks/ingest-inps-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const force = url.searchParams.get("force") === "1";
          const romeHour = Number(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Rome",
              hour: "2-digit",
              hour12: false,
            }).format(new Date()),
          );
          if (!force && romeHour !== 6) {
            return Response.json({ ok: true, skipped: true, romeHour });
          }

          // Rileva catch-up: nessuna notizia nel corpus creata negli ultimi 3 giorni.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
          const { count: recentCount } = await supabaseAdmin
            .from("sources")
            .select("id", { count: "exact", head: true } as any)
            .eq("source_type" as any, "notizia")
            .gte("created_at" as any, threeDaysAgo);
          const catchup = (recentCount ?? 0) === 0;
          const scrapeLimit = catchup ? 100 : 30;
          const concurrency = catchup ? 4 : 3;

          const result = await ingestNewsDaily({ data: { scrapeLimit, concurrency } });
          let index: { processed: number; total: number; skipped: number } | null = null;
          let indexError: string | null = null;
          if ((result.ingest.created ?? 0) > 0) {
            try {
              index = await ingestEmbeddings();
            } catch (e) {
              indexError = (e as Error).message;
              console.error("ingest-inps-news: embedding step failed", e);
            }
          }
          return Response.json({ ok: true, catchup, scrapeLimit, ...result, index, indexError });
        } catch (e) {
          console.error("ingest-inps-news failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST per eseguire ingest giornaliero notizie INPS" }),
    },
  },
});
