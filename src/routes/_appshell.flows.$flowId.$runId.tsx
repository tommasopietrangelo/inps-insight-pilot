import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Workflow, Lightbulb, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getPractice } from "@/lib/flow-runs.functions";
import { createMemoryCase } from "@/lib/memory.functions";
import {
  listOperationalFlows,
  type OperationalFlow,
} from "@/lib/operational-flows.functions";
import { PracticeWorkbench } from "@/components/practice-workbench";
import type { ChecklistResult, ChecklistItem } from "@/lib/checklist.functions";
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
  const createCaseFn = useServerFn(createMemoryCase);

  const [exceptionFor, setExceptionFor] = useState<ChecklistItem | null>(null);

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

  const saveCase = useMutation({
    mutationFn: (v: {
      title: string; situation: string; solution: string; category: string | null; tags: string[]; isShared: boolean;
      sourceContext: Record<string, unknown>;
    }) => createCaseFn({ data: { workspaceId: wsId, origin: "flow", ...v } }),
    onSuccess: () => { toast.success("Eccezione salvata in Memoria AI"); setExceptionFor(null); },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Usa il pulsante <AlertTriangle className="inline h-3 w-3 text-amber-600" /> su un qualsiasi step della checklist per <strong className="text-foreground">segnalarlo come eccezione</strong>: verrà salvato in Memoria AI come "caso particolare da flusso", con il riferimento a questa sotto-pratica.
          </span>
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
        onMarkException={(item) => setExceptionFor(item)}
        invalidateKeys={[
          ["flow-runs", wsId, flowId],
          ["practice", runId],
        ]}
      />

      {exceptionFor && (
        <ExceptionDialog
          item={exceptionFor}
          flow={flow}
          practice={row}
          pending={saveCase.isPending}
          onClose={() => setExceptionFor(null)}
          onSubmit={(v) => saveCase.mutate({
            ...v,
            sourceContext: {
              flow_id: flowId,
              flow_title: flow?.title ?? null,
              flow_run_id: runId,
              practice_id: row.id,
              practice_code: row.practice_code,
              item_id: exceptionFor.id,
              item_title: exceptionFor.title,
              item_section: exceptionFor.section,
              item_status: exceptionFor.status,
              saved_at: new Date().toISOString(),
            },
          })}
        />
      )}
    </div>
  );
}

function ExceptionDialog({
  item, flow, practice, pending, onClose, onSubmit,
}: {
  item: ChecklistItem;
  flow: OperationalFlow | undefined;
  practice: { title: string; practice_code: string | null };
  pending: boolean;
  onClose: () => void;
  onSubmit: (v: { title: string; situation: string; solution: string; category: string | null; tags: string[]; isShared: boolean }) => void;
}) {
  const [title, setTitle] = useState(`Eccezione · ${item.title}`.slice(0, 190));
  const [category, setCategory] = useState(flow?.title ?? "");
  const [situation, setSituation] = useState(
    `Nel flusso "${flow?.title ?? "—"}" (pratica ${practice.practice_code ?? practice.title}), lo step "${item.title}" è risultato non-standard.\n\n${item.explanation ?? ""}`.trim(),
  );
  const [solution, setSolution] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [isShared, setIsShared] = useState(false);
  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Segna step come eccezione
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div><span className="font-medium text-foreground">Flusso:</span> {flow?.title ?? "—"}</div>
            <div><span className="font-medium text-foreground">Step:</span> {item.title}</div>
            <div><span className="font-medium text-foreground">Sezione:</span> {item.section}</div>
          </div>
          <div><Label>Titolo del caso</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><Label>Situazione (perché è un'eccezione)</Label><Textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={4} /></div>
          <div><Label>Soluzione adottata / esito</Label><Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={4} placeholder="Come è stata gestita, riferimento normativo, esito…" /></div>
          <div><Label>Tag (virgola)</Label><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Condividi con lo studio</div>
              <div className="text-xs text-muted-foreground">Visibile a tutto il workspace</div>
            </div>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !title.trim() || !situation.trim() || !solution.trim()}
            onClick={() => onSubmit({
              title: title.trim().slice(0, 200),
              situation: situation.trim(),
              solution: solution.trim(),
              category: category.trim() || null,
              tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
              isShared,
            })}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva eccezione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
