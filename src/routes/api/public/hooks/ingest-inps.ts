import { createFileRoute } from "@tanstack/react-router";
import { ingestInpsDaily } from "@/lib/inps-firecrawl.functions";
import { ingestEmbeddings } from "@/lib/search.functions";

// Endpoint pubblico chiamato da pg_cron una volta al giorno.
// Nessuna autenticazione utente: idempotente (dedup su external_id) e non
// scrive dati arbitrari dal client.
// Flusso: 1) scarica nuovi atti INPS via Firecrawl, 2) rigenera embedding
// per i nuovi atti così sono subito cercabili dall'AI senza interventi manuali.
export const Route = createFileRoute("/api/public/hooks/ingest-inps")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const ingest = await ingestInpsDaily();
          let index: { processed: number; total: number; skipped: number } | null = null;
          let indexError: string | null = null;
          if (ingest.created > 0) {
            try {
              index = await ingestEmbeddings();
            } catch (e) {
              indexError = (e as Error).message;
              console.error("ingest-inps: embedding step failed", e);
            }
          }
          return Response.json({ ok: true, ingest, index, indexError });
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
