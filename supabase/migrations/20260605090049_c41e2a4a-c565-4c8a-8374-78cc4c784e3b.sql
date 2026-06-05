
CREATE TABLE public.inps_ingest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  error text,
  attempts int NOT NULL DEFAULT 0,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.inps_ingest_queue TO authenticated;
GRANT ALL ON public.inps_ingest_queue TO service_role;

ALTER TABLE public.inps_ingest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ingest queue"
ON public.inps_ingest_queue FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_inps_ingest_queue_status ON public.inps_ingest_queue(status);
CREATE INDEX idx_inps_ingest_queue_discovered ON public.inps_ingest_queue(discovered_at DESC);
