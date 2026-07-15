import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listOperationalFlows,
  updateOperationalFlow,
  normalizeFlowChecklist,
  FLOW_SECTIONS,
  type FlowChecklistItem,
  type FlowSection,
  type OperationalFlow,
} from "@/lib/operational-flows.functions";
import { listFlowRuns, createFlowRun, type FlowRunRow } from "@/lib/flow-runs.functions";
import { useWorkspace } from "@/hooks/use-workspace";

const SECTION_LABELS: Record<FlowSection, string> = {
  requisiti: "Requisiti",
  documenti: "Documenti",
  controlli: "Controlli",
  passi_successivi: "Passi successivi",
};

export const Route = createFileRoute("/_appshell/flows/$flowId/")({
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
  const updateFlowFn = useServerFn(updateOperationalFlow);

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
  const runs: FlowRunRow[] = (runsQuery.data ?? []) as FlowRunRow[];

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

  // ---- Template editor ----
  const normalized = useMemo(
    () => normalizeFlowChecklist(flow?.checklist_items),
    [flow?.checklist_items],
  );
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<FlowChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newSection, setNewSection] = useState<FlowSection>("documenti");

  useEffect(() => {
    if (!editing) setDraftItems(normalized);
  }, [normalized, editing]);

  const addDraft = () => {
    const t = newTitle.trim();
    if (!t) return;
    setDraftItems((prev) => [...prev, { section: newSection, title: t }]);
    setNewTitle("");
  };

  const saveTemplate = useMutation({
    mutationFn: () =>
      updateFlowFn({
        data: { id: flowId, checklistItems: draftItems },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational-flows", wsId] });
      setEditing(false);
      toast.success("Template flusso aggiornato");
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

  const displayItems = editing ? draftItems : normalized;
  const grouped: Record<FlowSection, FlowChecklistItem[]> = {
    requisiti: [],
    documenti: [],
    controlli: [],
    passi_successivi: [],
  };
  displayItems.forEach((it) => grouped[it.section].push(it));

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
              {displayItems.length} voci checklist preimpostate
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

      {/* Template editor */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-base font-semibold">
              Template checklist (pratica-madre)
            </div>
            <p className="text-xs text-muted-foreground">
              Le voci qui saranno riportate automaticamente in ogni nuova sotto-pratica creata da
              questo flusso.
            </p>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setDraftItems(normalized);
                }}
                disabled={saveTemplate.isPending}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={() => saveTemplate.mutate()}
                disabled={saveTemplate.isPending}
                className="gap-1.5"
              >
                {saveTemplate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salva template
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifica template
            </Button>
          )}
        </div>

        <Separator className="my-4" />

        <div className="grid gap-4 md:grid-cols-2">
          {(FLOW_SECTIONS as readonly FlowSection[]).map((sec) => (
            <div key={sec} className="rounded-md border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SECTION_LABELS[sec]}
                </div>
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {grouped[sec].length}
                </Badge>
              </div>
              {grouped[sec].length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna voce.</p>
              ) : (
                <ul className="space-y-1.5">
                  {grouped[sec].map((it, idx) => {
                    const globalIdx = displayItems.indexOf(it);
                    return (
                      <li
                        key={`${sec}-${idx}`}
                        className="flex items-start gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0 flex-1">{it.title}</span>
                        {editing && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() =>
                              setDraftItems((prev) =>
                                prev.filter((_, i) => i !== globalIdx),
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="mt-4 flex flex-col gap-2 rounded-md border border-dashed bg-surface-muted p-3 sm:flex-row">
            <Select value={newSection} onValueChange={(v) => setNewSection(v as FlowSection)}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(FLOW_SECTIONS as readonly FlowSection[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SECTION_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder="Nuova voce…"
              maxLength={500}
              className="flex-1"
            />
            <Button onClick={addDraft} disabled={!newTitle.trim()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>
        )}
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
            {runs.map((row) => {
              const res = row.result as { items?: unknown[] } | null;
              const items = res?.items?.length ?? 0;
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
      {/* Unused imports guard */}
      <span className="hidden">
        <Trash2 />
      </span>
    </div>
  );
}
