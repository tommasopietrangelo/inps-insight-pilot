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
  Pin,
  PinOff,
  Star,
  Search,
  Settings2,
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
  listPinnedFlows,
  pinFlow,
  unpinFlow,
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

function FlowCard({
  flow,
  isPinned,
  onTogglePin,
  onDelete,
  pinBusy,
}: {
  flow: OperationalFlow;
  isPinned: boolean;
  onTogglePin: () => void;
  onDelete?: () => void;
  pinBusy?: boolean;
}) {
  return (
    <div className="group relative flex flex-col rounded-xl border bg-surface p-5 shadow-card transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-elevated">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-surface-muted">
          <FlowIcon name={flow.icon} />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            disabled={pinBusy}
            title={isPinned ? "Rimuovi dai ricorrenti" : "Aggiungi ai ricorrenti"}
            className={`rounded p-1 transition-colors ${
              isPinned
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground hover:text-primary"
            }`}
            aria-label={isPinned ? "Rimuovi dai ricorrenti" : "Aggiungi ai ricorrenti"}
          >
            {isPinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          {flow.is_default ? (
            <Badge variant="outline" className="text-[10px]">
              Standard
            </Badge>
          ) : onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label="Elimina flusso"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <h3 className="mb-1 font-display text-[15px] font-semibold leading-snug tracking-tight">
        {flow.title}
      </h3>
      {flow.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {flow.description}
        </p>
      )}
      <div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        {flow.checklist_items.length} voci checklist
      </div>
      <Link
        to="/flows/$flowId"
        params={{ flowId: flow.id }}
        className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        Apri flusso <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function RecurringFlowsSection() {
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";
  const qc = useQueryClient();

  const listFn = useServerFn(listOperationalFlows);
  const createFn = useServerFn(createOperationalFlow);
  const deleteFn = useServerFn(deleteOperationalFlow);
  const listPinnedFn = useServerFn(listPinnedFlows);
  const pinFn = useServerFn(pinFlow);
  const unpinFn = useServerFn(unpinFlow);
  const listSavedFn = useServerFn(listSavedSearches);

  const flowsQuery = useQuery({
    queryKey: ["operational-flows", wsId],
    queryFn: () => listFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  const pinnedQuery = useQuery({
    queryKey: ["pinned-flows", wsId],
    queryFn: () => listPinnedFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  const flows = flowsQuery.data ?? [];
  const pinnedIds = useMemo(() => new Set(pinnedQuery.data ?? []), [pinnedQuery.data]);
  const pinnedFlows = useMemo(() => flows.filter((f) => pinnedIds.has(f.id)), [flows, pinnedIds]);

  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [allFilter, setAllFilter] = useState("");

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

  const togglePin = useMutation({
    mutationFn: async ({ flowId, pin }: { flowId: string; pin: boolean }) => {
      if (pin) return pinFn({ data: { workspaceId: wsId, flowId } });
      return unpinFn({ data: { workspaceId: wsId, flowId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pinned-flows", wsId] });
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

  const filteredAll = useMemo(() => {
    const q = allFilter.trim().toLowerCase();
    if (!q) return flows;
    return flows.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q),
    );
  }, [flows, allFilter]);

  const filteredManage = useMemo(() => {
    const q = manageFilter.trim().toLowerCase();
    if (!q) return flows;
    return flows.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q),
    );
  }, [flows, manageFilter]);

  const renderCard = (f: OperationalFlow) => (
    <FlowCard
      key={f.id}
      flow={f}
      isPinned={pinnedIds.has(f.id)}
      pinBusy={togglePin.isPending}
      onTogglePin={() =>
        togglePin.mutate({ flowId: f.id, pin: !pinnedIds.has(f.id) })
      }
      onDelete={
        f.is_default
          ? undefined
          : () => {
              if (confirm(`Eliminare il flusso "${f.title}"?`)) remove.mutate(f.id);
            }
      }
    />
  );

  return (
    <div className="space-y-10">
      {/* PINNED / RICORRENTI */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Flussi operativi ricorrenti
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              I flussi che usi più spesso: aggiungili qui per averli a portata di mano.
            </p>
          </div>
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!wsId}>
                <Settings2 className="h-3.5 w-3.5" /> Gestisci ricorrenti
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Gestisci flussi ricorrenti</DialogTitle>
                <DialogDescription>
                  Scegli quali flussi mostrare nella sezione ricorrenti. Le modifiche sono
                  condivise con il tuo workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Cerca flusso…"
                    value={manageFilter}
                    onChange={(e) => setManageFilter(e.target.value)}
                  />
                </div>
                <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                  {filteredManage.map((f) => {
                    const pinned = pinnedIds.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          togglePin.mutate({ flowId: f.id, pin: !pinned })
                        }
                        disabled={togglePin.isPending}
                        className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          pinned
                            ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-500/5"
                            : "hover:border-primary/40 hover:bg-surface-muted"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FlowIcon name={f.icon} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{f.title}</div>
                            {f.description && (
                              <div className="truncate text-[11px] text-muted-foreground">
                                {f.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {pinned ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <Pin className="h-3 w-3 fill-current" /> Ricorrente
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <PinOff className="h-3 w-3" /> Aggiungi
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {filteredManage.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground">Nessun flusso trovato.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setManageOpen(false)}>Chiudi</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {pinnedQuery.isLoading || flowsQuery.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Carico flussi…</Card>
        ) : pinnedFlows.length === 0 ? (
          <Card className="border-dashed p-6 text-sm text-muted-foreground">
            Nessun flusso ricorrente. Usa <b>Gestisci ricorrenti</b> o il pin sulle card qui
            sotto per aggiungere i flussi che usi più spesso.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedFlows.map(renderCard)}
          </div>
        )}
      </section>

      {/* ALL FLOWS */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Tutti i flussi operativi
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Libreria completa di flussi standard basati sul corpus INPS e sulle prestazioni
              CAF/patronato più richieste. Aggiungi i tuoi flussi personalizzati.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 w-56 pl-8 text-xs"
                placeholder="Cerca flusso…"
                value={allFilter}
                onChange={(e) => setAllFilter(e.target.value)}
              />
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
                    Definisci un flusso ricorrente: query di ricerca preimpostata + checklist.
                    Sarà condiviso con il tuo workspace.
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
                    <Label htmlFor="flow-query">
                      Query preimpostata (interroga il corpus INPS)
                    </Label>
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
                      placeholder={
                        "Verifica ISEE in corso di validità\nControllo composizione nucleo familiare\n..."
                      }
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
                    {create.isPending && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Crea flusso
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {flowsQuery.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Carico flussi…</Card>
        ) : filteredAll.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nessun flusso trovato per «{allFilter}».
          </Card>
        ) : (
          <>
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              {filteredAll.length} flussi
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAll.map(renderCard)}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
