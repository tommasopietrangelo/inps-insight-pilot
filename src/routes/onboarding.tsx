import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Briefcase, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { createWorkspace, listMyWorkspaces } from "@/lib/workspace.functions";
import { acceptInvitation, listMyPendingInvitations } from "@/lib/invitations.functions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Crea workspace · INPS Copilot" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setWorkspaces, setCurrent } = useWorkspace();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const listFn = useServerFn(listMyWorkspaces);
  const createFn = useServerFn(createWorkspace);
  const acceptFn = useServerFn(acceptInvitation);
  const pendingFn = useServerFn(listMyPendingInvitations);

  const pendingQ = useQuery({
    queryKey: ["my-pending-invitations", user?.id],
    queryFn: () => pendingFn(),
    enabled: !!user,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    listFn({}).then((ws) => {
      if (ws.length > 0) {
        setWorkspaces(ws);
        setCurrent(ws[0].id);
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [loading, user, navigate, listFn, setWorkspaces, setCurrent]);

  const onAccept = async (token: string, id: string) => {
    setAcceptingId(id);
    try {
      await acceptFn({ data: { token } });
      const all = await listFn({});
      setWorkspaces(all);
      if (all[0]) setCurrent(all[0].id);
      toast.success("Invito accettato");
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setAcceptingId(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await createFn({ data: { name: name.trim() } });
      const ws = await listFn({});
      setWorkspaces(ws);
      if (ws[0]) setCurrent(ws[0].id);
      toast.success("Workspace creato");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  const hasInvites = (pendingQ.data?.length ?? 0) > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg p-8">
        {hasInvites && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Hai inviti in attesa</h2>
                <p className="text-sm text-muted-foreground">
                  Unisciti a un workspace esistente del tuo team.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingQ.data!.map((inv) => {
                const ws = inv.workspace as { name?: string } | null;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-md border bg-surface px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{ws?.name ?? "Workspace"}</div>
                      <div className="text-xs text-muted-foreground">Ruolo: {inv.role}</div>
                    </div>
                    <Button
                      size="sm"
                      disabled={acceptingId === inv.id}
                      onClick={() => onAccept(inv.token, inv.id)}
                    >
                      {acceptingId === inv.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Accetta
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">oppure crea il tuo</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Crea il tuo workspace</h1>
            <p className="text-sm text-muted-foreground">
              Lo studio o l'ufficio in cui condividerai avvisi, note e ricerche salvate.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ws-name">Nome dello studio / ente</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Studio Rossi · CAF"
              required
              minLength={2}
              maxLength={80}
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Potrai invitare colleghi dopo, dalle impostazioni.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continua
          </Button>
        </form>
      </Card>
    </div>
  );
}
