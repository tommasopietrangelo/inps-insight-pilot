import { createFileRoute } from "@tanstack/react-router";
import { ingestInpsDaily } from "@/lib/inps-firecrawl.functions";
// Operational rediscovery cron è DISATTIVATO (vedi settings UI per controllo manuale per-sezione).
// import { ingestInpsOperationalDaily } from "@/lib/inps-operational.functions";
import { ingestEmbeddings } from "@/lib/search.functions";


// Endpoint pubblico chiamato da pg_cron una volta al giorno.
// Nessuna autenticazione utente: idempotente (dedup su external_id) e non
// scrive dati arbitrari dal client.
// Flusso: 1) scarica nuovi atti INPS via Firecrawl, 2) rigenera embedding
// per i nuovi atti così sono subito cercabili dall'AI senza interventi manuali.
export const Route = createFileRoute("/api/public/hooks/ingest-inps")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Il cron è schedulato a 04:00 e 05:00 UTC per coprire ora legale (CEST=04 UTC)
          // e ora solare (CET=05 UTC) di Roma → in entrambi i casi sono le 06:00 a Roma.
          // Lasciamo passare solo l'esecuzione in cui a Roma sono effettivamente le 6.
          // Bypass via header ?force=1 per esecuzioni manuali.
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
          const ingest = await ingestInpsDaily();
          let operational: Awaited<ReturnType<typeof ingestInpsOperationalDaily>> | null = null;
          let operationalError: string | null = null;
          try {
            operational = await ingestInpsOperationalDaily();
          } catch (e) {
            operationalError = (e as Error).message;
            console.error("ingest-inps: operational step failed", e);
          }
          let index: { processed: number; total: number; skipped: number } | null = null;
          let indexError: string | null = null;
          const createdNew = (ingest.created ?? 0) + (operational?.batch.created ?? 0);
          if (createdNew > 0) {
            try {
              index = await ingestEmbeddings();
            } catch (e) {
              indexError = (e as Error).message;
              console.error("ingest-inps: embedding step failed", e);
            }
          }
          return Response.json({ ok: true, ingest, operational, operationalError, index, indexError });

        } catch (e) {
          console.error("ingest-inps failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST per eseguire ingest + indicizzazione INPS" }),
    },
  },
});
