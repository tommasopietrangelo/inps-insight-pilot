
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_member_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid
);

CREATE INDEX idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations(lower(email));
CREATE UNIQUE INDEX uq_workspace_invitations_pending
  ON public.workspace_invitations(workspace_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins manage invitations"
ON public.workspace_invitations
FOR ALL
TO authenticated
USING (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::workspace_member_role, 'admin'::workspace_member_role]))
WITH CHECK (public.workspace_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::workspace_member_role, 'admin'::workspace_member_role]));

CREATE POLICY "Invitees view their invitations"
ON public.workspace_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')));

CREATE TRIGGER trg_workspace_invitations_updated
BEFORE UPDATE ON public.workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Accept invitation by token
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv public.workspace_invitations;
  ws public.workspaces;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO inv FROM public.workspace_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation no longer valid';
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE public.workspace_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'invitation expired';
  END IF;

  IF lower(inv.email) <> uemail THEN
    RAISE EXCEPTION 'invitation email does not match the current user';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, uid, inv.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.workspace_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = uid
  WHERE id = inv.id;

  SELECT * INTO ws FROM public.workspaces WHERE id = inv.workspace_id;
  RETURN ws;
END;
$$;

-- Need unique constraint for ON CONFLICT above
ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_workspace_user_unique UNIQUE (workspace_id, user_id);
