import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Workflow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPractice } from "@/lib/flow-runs.functions";
import {
  listOperationalFlows,
  type OperationalFlow,
} from "@/lib/operational-flows.functions";
import { PracticeWorkbench } from "@/components/practice-workbench";
import type { ChecklistResult } from "@/lib/checklist.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_appshell/flows/$flowId/$runId")({
  head: () => ({ meta: [{ title: "Sotto-pratica · INPS Copilot" }] }),
  component: FlowRunPage,
});

function FlowRunPage() {
  const { flowId, runId } = Route.useParams();
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";

  const getFn = useServerFn(getPractice);
  const listFlowsFn = useServerFn(listOperationalFlows);

  const practiceQuery = useQuery({
    queryKey: ["practice", runId],
    queryFn: () => getFn({ data: { id: runId } }),
    enabled: !!runId,
  });
  const flowsQuery = useQuery({
    queryKey: ["operational-flows", wsId],
    queryFn: () => listFlowsFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  const flow: OperationalFlow | undefined = (flowsQuery.data ?? []).find(
    (f) => f.id === flowId,
  );

  if (practiceQuery.isLoading || !practiceQuery.data) {
    return <div className="p-6 text-sm text-muted-foreground">Carico sotto-pratica…</div>;
  }
  const row = practiceQuery.data as unknown as {
    id: string;
    title: string;
    practice_code: string | null;
    workspace_id: string;
    input: { query?: string; pinnedReminders?: import("@/lib/reminders.functions").Reminder[] } | null;
    result: ChecklistResult | null;
    checked: string[] | null;
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/flows/$flowId" params={{ flowId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {flow?.title ?? "Flusso"}
        </Link>
      </Button>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" /> Utilizza flusso «{flow?.title ?? "…"}»
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {row.practice_code && (
            <Badge variant="outline" className="rounded-sm font-mono text-[11px]">
              {row.practice_code}
            </Badge>
          )}
          <h1 className="font-display text-2xl font-semibold">{row.title}</h1>
        </div>
      </Card>

      <PracticeWorkbench
        workspaceId={row.workspace_id}
        kind="flow_run"
        practiceId={row.id}
        initialTitle={row.title}
        initialQuery={row.input?.query ?? ""}
        initialResult={row.result}
        initialChecked={row.checked ?? []}
        initialPinnedReminders={row.input?.pinnedReminders ?? []}
        invalidateKeys={[
          ["flow-runs", wsId, flowId],
          ["practice", runId],
        ]}
      />
    </div>
  );
}
