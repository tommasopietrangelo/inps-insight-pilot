
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS corpus_layer text NOT NULL DEFAULT 'normativo';

UPDATE public.sources
   SET corpus_layer = 'operativo'
 WHERE source_type = 'pagina_servizio' AND corpus_layer <> 'operativo';

CREATE INDEX IF NOT EXISTS sources_corpus_layer_idx ON public.sources (corpus_layer);

CREATE TABLE IF NOT EXISTS public.inps_operational_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  kind text,
  external_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.inps_operational_queue TO authenticated;
GRANT ALL ON public.inps_operational_queue TO service_role;

ALTER TABLE public.inps_operational_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read operational queue" ON public.inps_operational_queue;
CREATE POLICY "Authenticated can read operational queue"
  ON public.inps_operational_queue FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inps_op_queue_status ON public.inps_operational_queue (status);
CREATE INDEX IF NOT EXISTS idx_inps_op_queue_discovered ON public.inps_operational_queue (discovered_at DESC);
