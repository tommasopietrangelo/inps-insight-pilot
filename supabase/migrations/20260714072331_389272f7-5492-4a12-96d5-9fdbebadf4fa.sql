
-- 1) Source view tracking (auto memoria normativa)
CREATE TABLE public.memory_source_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_memory_source_views_ws_src ON public.memory_source_views(workspace_id, source_id);
CREATE INDEX idx_memory_source_views_viewed_at ON public.memory_source_views(viewed_at DESC);
GRANT SELECT, INSERT ON public.memory_source_views TO authenticated;
GRANT ALL ON public.memory_source_views TO service_role;
ALTER TABLE public.memory_source_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members can read source views" ON public.memory_source_views FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws members can insert source views" ON public.memory_source_views FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);

-- 2) Casi particolari
CREATE TABLE public.memory_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  category text,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  source_ref text,
  situation text NOT NULL,
  solution text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_shared boolean NOT NULL DEFAULT false,
  reuses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_memory_cases_ws ON public.memory_cases(workspace_id, updated_at DESC);
CREATE INDEX idx_memory_cases_author ON public.memory_cases(author_id);
CREATE INDEX idx_memory_cases_shared ON public.memory_cases(workspace_id, is_shared) WHERE is_shared = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_cases TO authenticated;
GRANT ALL ON public.memory_cases TO service_role;
ALTER TABLE public.memory_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or shared cases in ws" ON public.memory_cases FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id)
    AND (author_id = auth.uid() OR is_shared = true));
CREATE POLICY "insert own cases in ws" ON public.memory_cases FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND author_id = auth.uid());
CREATE POLICY "update own cases" ON public.memory_cases FOR UPDATE
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "delete own cases" ON public.memory_cases FOR DELETE
  USING (author_id = auth.uid());
CREATE TRIGGER trg_memory_cases_updated BEFORE UPDATE ON public.memory_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Preferenze operatore (per user per workspace)
CREATE TABLE public.memory_operator_prefs (
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  response_style text NOT NULL DEFAULT 'sintetico',
  detail_level text NOT NULL DEFAULT 'medio',
  preferred_sources text[] NOT NULL DEFAULT '{}',
  preferred_topics text[] NOT NULL DEFAULT '{}',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_operator_prefs TO authenticated;
GRANT ALL ON public.memory_operator_prefs TO service_role;
ALTER TABLE public.memory_operator_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own operator prefs" ON public.memory_operator_prefs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_memory_operator_prefs_updated BEFORE UPDATE ON public.memory_operator_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
