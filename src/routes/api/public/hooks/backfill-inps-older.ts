import { createFileRoute } from "@tanstack/react-router";
import { backfillInpsOlder } from "@/lib/inps-firecrawl.functions";
import { ingestEmbeddings } from "@/lib/search.functions";

// Cron giornaliero: aggiunge ~5 atti INPS "più vecchi" di quelli già nel
// corpus, procedendo a ritroso. Idempotente (dedup via external_id).
// Schedulato a 03:00 e 04:00 UTC (06:00 Roma con/senza ora legale);
// internamente esegue solo quando a Roma sono effettivamente le 5
// del mattino, per non confliggere col cron forward delle 6.
export const Route = createFileRoute("/api/public/hooks/backfill-inps-older")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const force = url.searchParams.get("force") === "1";
          const target = Number(url.searchParams.get("target") ?? "5");
          const romeHour = Number(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Rome",
              hour: "2-digit",
              hour12: false,
            }).format(new Date()),
          );
          if (!force && romeHour !== 5) {
            return Response.json({ ok: true, skipped: true, romeHour });
          }
          const backfill = await backfillInpsOlder({
            data: { target: Math.max(1, Math.min(20, target)) },
          });
          let index: { processed: number; total: number; skipped: number } | null = null;
          let indexError: string | null = null;
          if (backfill.created > 0) {
            try {
              index = await ingestEmbeddings();
            } catch (e) {
              indexError = (e as Error).message;
              console.error("backfill-inps-older: embedding step failed", e);
            }
          }
          return Response.json({ ok: true, backfill, index, indexError });
        } catch (e) {
          console.error("backfill-inps-older failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          hint: "POST per eseguire backfill a ritroso (5 atti/giorno). Query: ?force=1&target=5",
        }),
    },
  },
});
