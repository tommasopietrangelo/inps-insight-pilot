
-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: create a workspace and assign current user as owner atomically.
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(_name text, _slug text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ws  public.workspaces;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.workspaces (name, slug, created_by, plan)
  VALUES (_name, _slug, uid, 'free')
  RETURNING * INTO ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, uid, 'owner');

  RETURN ws;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) TO authenticated;
