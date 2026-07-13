import { createFileRoute } from "@tanstack/react-router";
import { ingestInpsOperationalDaily } from "@/lib/inps-operational.functions";
import { ingestEmbeddings } from "@/lib/search.functions";

// Endpoint pubblico chiamato da pg_cron 1 volta al mese (1° del mese, 07:00 Rome).
// Fa rediscovery + processing di eventuali NUOVE URL per ogni sezione operativa
// (le URL già in corpus vengono deduplicate lato queue/sources, quindi non
// vengono riscarate). Gate: romeHour === 7. Bypass con ?force=1.
export const Route = createFileRoute("/api/public/hooks/rediscover-inps-operational")({
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
          if (!force && romeHour !== 7) {
            return Response.json({ ok: true, skipped: true, romeHour });
          }
          const result = await ingestInpsOperationalDaily();
          let index: { processed: number; total: number; skipped: number } | null = null;
          let indexError: string | null = null;
          if ((result.created ?? 0) > 0) {
            try {
              index = await ingestEmbeddings();
            } catch (e) {
              indexError = (e as Error).message;
              console.error("rediscover-inps-operational: embedding step failed", e);
            }
          }
          return Response.json({ ok: true, ...result, index, indexError });
        } catch (e) {
          console.error("rediscover-inps-operational failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          hint: "POST per rediscovery mensile layer operativo INPS",
        }),
    },
  },
});
