import { createFileRoute } from "@tanstack/react-router";
import { ingestNewsDaily } from "@/lib/inps-news.functions";
import { ingestEmbeddings } from "@/lib/search.functions";

// Endpoint pubblico chiamato da pg_cron per il retrieval giornaliero delle
// notizie INPS (/inps-comunica/notizie/...). Stessa logica del cron circolari:
// scheduliamo a 04:00 e 05:00 UTC (coprono CEST/CET) e lasciamo passare solo
// l'esecuzione in cui a Roma sono effettivamente le 06:00. Bypass con ?force=1.
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
          const result = await ingestNewsDaily({ data: { scrapeLimit: 30, concurrency: 3 } });
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
          return Response.json({ ok: true, ...result, index, indexError });
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
