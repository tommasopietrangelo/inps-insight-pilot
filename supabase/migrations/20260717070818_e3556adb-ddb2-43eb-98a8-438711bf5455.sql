ALTER TABLE public.memory_cases
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_context jsonb;

ALTER TABLE public.memory_cases
  DROP CONSTRAINT IF EXISTS memory_cases_origin_check;

ALTER TABLE public.memory_cases
  ADD CONSTRAINT memory_cases_origin_check CHECK (origin IN ('manual','chat','flow'));

CREATE INDEX IF NOT EXISTS memory_cases_workspace_origin_idx
  ON public.memory_cases (workspace_id, origin);