import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Trash2,
  Loader2,
  Workflow,
  FileText,
  RefreshCw,
  Briefcase,
  Clock,
  Heart,
  ClipboardCheck,
  ArrowRight,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listOperationalFlows,
  createOperationalFlow,
  deleteOperationalFlow,
  type OperationalFlow,
} from "@/lib/operational-flows.functions";
import { listSavedSearches } from "@/lib/saved-searches.functions";
import { useWorkspace } from "@/hooks/use-workspace";

const ICON_MAP: Record<string, typeof FileText> = {
  FileText,
  RefreshCw,
  Briefcase,
  Clock,
  Heart,
  ClipboardCheck,
  Workflow,
};

function FlowIcon({ name }: { name: string | null }) {
  const Icon = (name && ICON_MAP[name]) || Workflow;
  return <Icon className="h-4 w-4 text-primary" />;
}

export function RecurringFlowsSection() {
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";
  const qc = useQueryClient();

  const listFn = useServerFn(listOperationalFlows);
  const createFn = useServerFn(createOperationalFlow);
  const deleteFn = useServerFn(deleteOperationalFlow);
  const listSavedFn = useServerFn(listSavedSearches);

  const flowsQuery = useQuery({
    queryKey: ["operational-flows", wsId],
    queryFn: () => listFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  const flows = flowsQuery.data ?? [];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [itemsText, setItemsText] = useState("");

  const savedSearchesQuery = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () => listSavedFn({}),
    enabled: open,
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setQuery("");
    setItemsText("");
  };

  const create = useMutation({
    mutationFn: () => {
      const checklistItems = itemsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return createFn({
        data: {
          workspaceId: wsId,
          title: title.trim(),
          description: description.trim() || undefined,
          query: query.trim(),
          checklistItems,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational-flows", wsId] });
      toast.success("Flusso creato");
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational-flows", wsId] });
      toast.success("Flusso eliminato");
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const canSubmit = useMemo(
    () => title.trim().length > 1 && query.trim().length > 1 && !create.isPending,
    [title, query, create.isPending],
  );

  const useSavedSearch = (q: string) => {
    setQuery(q);
    if (!title.trim()) setTitle(q.slice(0, 80));
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Flussi operativi ricorrenti
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Apri una pratica standard con query e checklist già preimpostate. Puoi crearne di nuove
            in base alle tue ricerche.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!wsId}>
              <Plus className="h-3.5 w-3.5" /> Nuovo flusso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuovo flusso operativo</DialogTitle>
              <DialogDescription>
                Definisci un flusso ricorrente: query di ricerca preimpostata + checklist. Sarà
                condiviso con il tuo workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="flow-title">Titolo</Label>
                <Input
                  id="flow-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Verifica requisiti Naspi apprendisti"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flow-desc">Descrizione (opzionale)</Label>
                <Input
                  id="flow-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve promemoria del flusso"
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flow-query">Query preimpostata (interroga il corpus INPS)</Label>
                <Textarea
                  id="flow-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Es. Naspi apprendisti requisiti contributivi 2026"
                  rows={2}
                />
                {(savedSearchesQuery.data ?? []).length > 0 && (
                  <div className="mt-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Bookmark className="mr-1 inline h-3 w-3" /> Usa una ricerca salvata
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(savedSearchesQuery.data ?? []).slice(0, 8).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => useSavedSearch(s.query)}
                          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
                        >
                          {s.query.length > 50 ? s.query.slice(0, 49) + "…" : s.query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flow-items">Checklist (una voce per riga)</Label>
                <Textarea
                  id="flow-items"
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  placeholder={"Verifica ISEE in corso di validità\nControllo composizione nucleo familiare\n..."}
                  rows={6}
                />
                <p className="text-[11px] text-muted-foreground">
                  {itemsText.split("\n").filter((l) => l.trim()).length} voci
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button onClick={() => create.mutate()} disabled={!canSubmit}>
                {create.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Crea flusso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {flowsQuery.isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carico flussi…</Card>
      ) : flows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nessun flusso disponibile. Crea il primo con il pulsante qui sopra.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((f: OperationalFlow) => (
            <div
              key={f.id}
              className="group relative flex flex-col rounded-xl border bg-surface p-5 shadow-card transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-surface-muted">
                  <FlowIcon name={f.icon} />
                </div>
                {f.is_default ? (
                  <Badge variant="outline" className="text-[10px]">
                    Standard
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Eliminare il flusso "${f.title}"?`)) remove.mutate(f.id);
                    }}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Elimina flusso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <h3 className="mb-1 font-display text-[15px] font-semibold leading-snug tracking-tight">
                {f.title}
              </h3>
              {f.description && (
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              )}
              <div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                {f.checklist_items.length} voci checklist
              </div>
              <Link
                to="/checklist"
                search={{ flowId: f.id }}
                className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Apri flusso <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
