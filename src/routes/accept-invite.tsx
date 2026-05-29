import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { acceptInvitation } from "@/lib/invitations.functions";
import { listMyWorkspaces } from "@/lib/workspace.functions";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accetta invito · INPS Copilot" }] }),
  validateSearch: searchSchema,
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setWorkspaces, setCurrent } = useWorkspace();
  const acceptFn = useServerFn(acceptInvitation);
  const listFn = useServerFn(listMyWorkspaces);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/login",
        search: { redirect: `/accept-invite?token=${token ?? ""}` },
        replace: true,
      });
    }
  }, [loading, user, navigate, token]);

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const ws = await acceptFn({ data: { token } });
      const all = await listFn({});
      setWorkspaces(all);
      const id = (ws as { id?: string } | null)?.id ?? all[0]?.id;
      if (id) setCurrent(id);
      toast.success("Invito accettato");
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 600);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Invito al workspace</h1>
            <p className="text-sm text-muted-foreground">
              Sei stato invitato a collaborare in un workspace di INPS Copilot.
            </p>
          </div>
        </div>
        {!token ? (
          <p className="text-sm text-destructive">Link invito non valido.</p>
        ) : (
          <Button onClick={accept} disabled={busy || done} className="w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {done ? "Accesso al workspace…" : "Accetta invito"}
          </Button>
        )}
      </Card>
    </div>
  );
}
