
CREATE TYPE public.practice_kind AS ENUM ('checklist','analyze','summarize','compare');

CREATE TABLE public.practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.practice_kind NOT NULL,
  title text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX practices_workspace_idx ON public.practices(workspace_id, kind, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practices TO authenticated;
GRANT ALL ON public.practices TO service_role;

ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workspace practices"
  ON public.practices FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members create practices"
  ON public.practices FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);

CREATE POLICY "Authors update own practices"
  ON public.practices FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::workspace_member_role,'admin'::workspace_member_role])
  );

CREATE POLICY "Authors delete own practices"
  ON public.practices FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::workspace_member_role,'admin'::workspace_member_role])
  );

CREATE TRIGGER practices_set_updated_at
  BEFORE UPDATE ON public.practices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
