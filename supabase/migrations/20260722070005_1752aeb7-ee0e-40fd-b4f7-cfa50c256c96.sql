
-- Enums
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('free','studio','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- workspace_subscriptions
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  seats_limit int NOT NULL DEFAULT 1,
  queries_limit_monthly int NOT NULL DEFAULT 50,
  sources_limit_monthly int NOT NULL DEFAULT 20,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workspace_subscriptions TO authenticated;
GRANT ALL ON public.workspace_subscriptions TO service_role;

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read subscription"
  ON public.workspace_subscriptions FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_ws_sub_updated
  BEFORE UPDATE ON public.workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- workspace_usage_monthly
CREATE TABLE IF NOT EXISTS public.workspace_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period text NOT NULL, -- 'YYYY-MM'
  queries_count int NOT NULL DEFAULT 0,
  ai_tokens bigint NOT NULL DEFAULT 0,
  firecrawl_calls int NOT NULL DEFAULT 0,
  sources_added int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period)
);

GRANT SELECT ON public.workspace_usage_monthly TO authenticated;
GRANT ALL ON public.workspace_usage_monthly TO service_role;

ALTER TABLE public.workspace_usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read usage"
  ON public.workspace_usage_monthly FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_ws_usage_updated
  BEFORE UPDATE ON public.workspace_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: ensure subscription row exists (called by triggers / fns)
CREATE OR REPLACE FUNCTION public.ensure_workspace_subscription(_ws uuid)
RETURNS public.workspace_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.workspace_subscriptions;
BEGIN
  SELECT * INTO s FROM public.workspace_subscriptions WHERE workspace_id = _ws;
  IF NOT FOUND THEN
    INSERT INTO public.workspace_subscriptions (workspace_id)
    VALUES (_ws)
    RETURNING * INTO s;
  END IF;
  RETURN s;
END $$;

-- Trigger: auto-create subscription when a workspace is created
CREATE OR REPLACE FUNCTION public.on_workspace_created_create_sub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_workspace_subscription(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workspaces_create_sub ON public.workspaces;
CREATE TRIGGER trg_workspaces_create_sub
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.on_workspace_created_create_sub();

-- Backfill: create subscriptions for existing workspaces
INSERT INTO public.workspace_subscriptions (workspace_id)
SELECT w.id FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_subscriptions s WHERE s.workspace_id = w.id);

-- can_add_seat: counts active members + pending invitations vs seats_limit
CREATE OR REPLACE FUNCTION public.can_add_seat(_ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT seats_limit, status FROM public.workspace_subscriptions WHERE workspace_id = _ws),
       used AS (
         SELECT
           (SELECT count(*) FROM public.workspace_members WHERE workspace_id = _ws)
         + (SELECT count(*) FROM public.workspace_invitations WHERE workspace_id = _ws AND status = 'pending')
         AS n
       )
  SELECT COALESCE((SELECT status IN ('trialing','active','past_due') AND used.n < s.seats_limit FROM s, used), false);
$$;

-- can_run_query: checks status + monthly query quota
CREATE OR REPLACE FUNCTION public.can_run_query(_ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT queries_limit_monthly, status FROM public.workspace_subscriptions WHERE workspace_id = _ws),
       u AS (
         SELECT COALESCE(queries_count, 0) AS n
         FROM public.workspace_usage_monthly
         WHERE workspace_id = _ws AND period = to_char(now(),'YYYY-MM')
       )
  SELECT COALESCE(
    (SELECT s.status IN ('trialing','active') AND COALESCE((SELECT n FROM u), 0) < s.queries_limit_monthly FROM s),
    false
  );
$$;

-- increment_usage: atomic upsert of monthly counters
CREATE OR REPLACE FUNCTION public.increment_usage(
  _ws uuid,
  _queries int DEFAULT 0,
  _ai_tokens bigint DEFAULT 0,
  _firecrawl int DEFAULT 0,
  _sources int DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p text := to_char(now(),'YYYY-MM');
BEGIN
  INSERT INTO public.workspace_usage_monthly (workspace_id, period, queries_count, ai_tokens, firecrawl_calls, sources_added)
  VALUES (_ws, p, GREATEST(_queries,0), GREATEST(_ai_tokens,0), GREATEST(_firecrawl,0), GREATEST(_sources,0))
  ON CONFLICT (workspace_id, period) DO UPDATE
    SET queries_count = public.workspace_usage_monthly.queries_count + EXCLUDED.queries_count,
        ai_tokens = public.workspace_usage_monthly.ai_tokens + EXCLUDED.ai_tokens,
        firecrawl_calls = public.workspace_usage_monthly.firecrawl_calls + EXCLUDED.firecrawl_calls,
        sources_added = public.workspace_usage_monthly.sources_added + EXCLUDED.sources_added,
        updated_at = now();
END $$;
