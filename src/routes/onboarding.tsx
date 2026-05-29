import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { createWorkspace, listMyWorkspaces } from "@/lib/workspace.functions";

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

  const listFn = useServerFn(listMyWorkspaces);
  const createFn = useServerFn(createWorkspace);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg p-8">
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
              Potrai invitare colleghi in seguito dalle impostazioni.
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
