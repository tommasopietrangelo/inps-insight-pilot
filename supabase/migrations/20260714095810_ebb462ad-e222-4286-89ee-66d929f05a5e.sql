-- Add flow_run kind and link columns to practices
ALTER TYPE public.practice_kind ADD VALUE IF NOT EXISTS 'flow_run';

ALTER TABLE public.operational_flows
  ADD COLUMN IF NOT EXISTS code_prefix text;

ALTER TABLE public.practices
  ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES public.operational_flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_code text;

CREATE INDEX IF NOT EXISTS practices_flow_id_idx ON public.practices(flow_id);
CREATE INDEX IF NOT EXISTS practices_workspace_kind_idx ON public.practices(workspace_id, kind);

-- Seed sensible prefixes for the default flows
UPDATE public.operational_flows SET code_prefix = 'ADI'   WHERE code_prefix IS NULL AND title ILIKE '%ADI%';
UPDATE public.operational_flows SET code_prefix = 'AUU'   WHERE code_prefix IS NULL AND title ILIKE '%Assegno Unico%';
UPDATE public.operational_flows SET code_prefix = 'NASPI' WHERE code_prefix IS NULL AND title ILIKE '%NASpI%';
UPDATE public.operational_flows SET code_prefix = 'PENS'  WHERE code_prefix IS NULL AND title ILIKE '%pension%';
UPDATE public.operational_flows SET code_prefix = 'CONG'  WHERE code_prefix IS NULL AND title ILIKE '%congedo%';
