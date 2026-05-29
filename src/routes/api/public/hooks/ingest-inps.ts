import { createFileRoute } from "@tanstack/react-router";
import { ingestInpsDaily } from "@/lib/inps-firecrawl.functions";

// Endpoint pubblico chiamato da pg_cron una volta al giorno.
// Nessuna autenticazione utente: idempotente (dedup su external_id) e non
// scrive dati arbitrari dal client.
export const Route = createFileRoute("/api/public/hooks/ingest-inps")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await ingestInpsDaily();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("ingest-inps failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST per eseguire ingest INPS" }),
    },
  },
});
