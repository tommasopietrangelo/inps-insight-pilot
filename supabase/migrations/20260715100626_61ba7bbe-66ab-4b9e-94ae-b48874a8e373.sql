-- Pinned flows per workspace
CREATE TABLE public.workspace_pinned_flows (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.operational_flows(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid,
  PRIMARY KEY (workspace_id, flow_id)
);
GRANT SELECT, INSERT, DELETE ON public.workspace_pinned_flows TO authenticated;
GRANT ALL ON public.workspace_pinned_flows TO service_role;
ALTER TABLE public.workspace_pinned_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pinned_select" ON public.workspace_pinned_flows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_pinned_flows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "pinned_insert" ON public.workspace_pinned_flows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_pinned_flows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "pinned_delete" ON public.workspace_pinned_flows FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_pinned_flows.workspace_id AND wm.user_id = auth.uid()));
