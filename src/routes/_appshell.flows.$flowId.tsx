import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  listOperationalFlows,
  type OperationalFlow,
} from "@/lib/operational-flows.functions";
import { listFlowRuns, createFlowRun } from "@/lib/flow-runs.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_appshell/flows/$flowId")({
  head: () => ({ meta: [{ title: "Flusso operativo · INPS Copilot" }] }),
  component: FlowDetailPage,
});

function FlowDetailPage() {
  const { flowId } = Route.useParams();
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const listFlowsFn = useServerFn(listOperationalFlows);
  const listRunsFn = useServerFn(listFlowRuns);
  const createRunFn = useServerFn(createFlowRun);

  const flowsQuery = useQuery({
    queryKey: ["operational-flows", wsId],
    queryFn: () => listFlowsFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  const flow: OperationalFlow | undefined = (flowsQuery.data ?? []).find(
    (f) => f.id === flowId,
  );

  const runsQuery = useQuery({
    queryKey: ["flow-runs", wsId, flowId],
    queryFn: () => listRunsFn({ data: { workspaceId: wsId, flowId } }),
    enabled: !!wsId,
  });
  const runs = runsQuery.data ?? [];

  const [label, setLabel] = useState("");
  const createRun = useMutation({
    mutationFn: () =>
      createRunFn({
        data: { workspaceId: wsId, flowId, label: label.trim() || undefined },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["flow-runs", wsId, flowId] });
      setLabel("");
      toast.success(`Nuova sotto-pratica creata`);
      navigate({
        to: "/flows/$flowId/$runId",
        params: { flowId, runId: (row as { id: string }).id },
      });
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  if (flowsQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carico flusso…</div>;
  }
  if (!flow) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/flows">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Flussi operativi
          </Link>
        </Button>
        <Card className="p-6 text-sm text-muted-foreground">Flusso non trovato.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/flows">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Flussi operativi
        </Link>
      </Button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" /> Utilizza flusso
              {flow.is_default && (
                <Badge variant="outline" className="text-[10px]">Standard</Badge>
              )}
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold">{flow.title}</h1>
            {flow.description && (
              <p className="mt-1 text-sm text-muted-foreground">{flow.description}</p>
            )}
            <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              {flow.checklist_items.length} voci checklist preimpostate
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:min-w-[280px]">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Etichetta (es. Rossi Mario)"
              maxLength={120}
              className="text-sm"
            />
            <Button
              onClick={() => createRun.mutate()}
              disabled={!wsId || createRun.isPending}
              className="gap-1.5"
            >
              {createRun.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Nuova sotto-pratica
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Sotto-pratiche del flusso</h2>
            <p className="text-xs text-muted-foreground">
              Ogni pratica riceve un codice progressivo (es. ADI-001) ed è riconsultabile.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {runs.length}
          </Badge>
        </div>

        {runsQuery.isLoading ? (
          <Card className="p-5 text-sm text-muted-foreground">Carico…</Card>
        ) : runs.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nessuna sotto-pratica ancora. Clicca «Nuova sotto-pratica» per iniziare.
          </Card>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {runs.map((r) => {
              const row = r as unknown as {
                id: string;
                title: string;
                practice_code: string | null;
                updated_at: string;
                checked: string[] | null;
                result: { items?: unknown[] } | null;
              };
              const items = row.result?.items?.length ?? 0;
              const done = row.checked?.length ?? 0;
              return (
                <li key={row.id}>
                  <Link
                    to="/flows/$flowId/$runId"
                    params={{ flowId, runId: row.id }}
                    className="group flex items-center justify-between gap-3 rounded-lg border bg-surface p-4 transition hover:border-primary/40 hover:shadow-card"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {row.practice_code && (
                          <Badge variant="outline" className="rounded-sm font-mono text-[10px]">
                            {row.practice_code}
                          </Badge>
                        )}
                        <span className="truncate text-sm font-medium">{row.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(row.updated_at).toLocaleString("it-IT")} · {done}/{items}{" "}
                        completate
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
