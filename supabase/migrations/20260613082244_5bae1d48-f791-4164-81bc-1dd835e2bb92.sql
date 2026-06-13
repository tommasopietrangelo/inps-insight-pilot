ALTER TABLE public.inps_operational_queue ADD COLUMN IF NOT EXISTS section text;
CREATE INDEX IF NOT EXISTS idx_inps_op_queue_section ON public.inps_operational_queue (section);