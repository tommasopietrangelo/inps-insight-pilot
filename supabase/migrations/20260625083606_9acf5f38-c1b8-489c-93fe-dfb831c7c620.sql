-- Add 'notizia' to source_type enum + create inps_news_queue
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'notizia';

CREATE TABLE IF NOT EXISTS public.inps_news_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.inps_news_queue TO authenticated;
GRANT ALL ON public.inps_news_queue TO service_role;

ALTER TABLE public.inps_news_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read news queue"
  ON public.inps_news_queue FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inps_news_queue_status ON public.inps_news_queue(status);
CREATE INDEX IF NOT EXISTS idx_inps_news_queue_discovered ON public.inps_news_queue(discovered_at DESC);