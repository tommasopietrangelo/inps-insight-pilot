import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileUp,
  GripVertical,
  Info,
  Loader2,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  generateChecklist,
  type ChecklistItem,
  type ChecklistResult,
  type ChecklistSection,
  type ChecklistStatus,
} from "@/lib/checklist.functions";
import { extractTextFromFile, downloadAsPdf } from "@/lib/doc-io";
import { savePractice, type PracticeKind } from "@/lib/practices.functions";
import { unpinReminderFromPractice, type Reminder } from "@/lib/reminders.functions";

type LoadedFile = { name: string; text: string; chars: number };

const SECTION_LABELS: Record<ChecklistSection, string> = {
  requisiti: "Requisiti da verificare",
  documenti: "Documenti presenti o mancanti",
  controlli: "Controlli e anomalie da verificare",
  passi_successivi: "Passi successivi",
};

const STATUS_META: Record<ChecklistStatus, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  mancante: { label: "Mancante", className: "bg-destructive/10 text-destructive border-destructive/30" },
  da_verificare: { label: "Da verificare", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
};

export type PracticeWorkbenchProps = {
  workspaceId: string;
  kind: PracticeKind;
  practiceId: string;
  initialTitle: string;
  initialQuery: string;
  initialResult: ChecklistResult | null;
  initialChecked: string[];
  initialPinnedReminders?: Reminder[];
  invalidateKeys?: readonly unknown[][];
  onMarkException?: (item: ChecklistItem) => void;
};

export function PracticeWorkbench(props: PracticeWorkbenchProps) {
  const {
    workspaceId,
    kind,
    practiceId,
    initialTitle,
    initialQuery,
    initialResult,
    initialChecked,
    initialPinnedReminders = [],
    invalidateKeys = [],
    onMarkException,
  } = props;

  const qc = useQueryClient();
  const [query, setQuery] = useState(initialQuery);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [result, setResult] = useState<ChecklistResult | null>(initialResult);
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  const [pinnedReminders, setPinnedReminders] = useState<Reminder[]>(initialPinnedReminders);
  const [newItemBySection, setNewItemBySection] = useState<Record<string, string>>({});
  const loadedFor = useRef(practiceId);

  useEffect(() => {
    if (loadedFor.current === practiceId) return;
    loadedFor.current = practiceId;
    setQuery(initialQuery);
    setResult(initialResult);
    setChecked(new Set(initialChecked));
    setPinnedReminders(initialPinnedReminders);
    setFiles([]);
  }, [practiceId, initialQuery, initialResult, initialChecked, initialPinnedReminders]);

  const documentText = useMemo(
    () => files.map((f) => `=== ${f.name} ===\n${f.text}`).join("\n\n"),
    [files],
  );
  const documentTitle = useMemo(() => files.map((f) => f.name).join(", "), [files]);

  const onFilesAdded = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setExtractError("");
    setExtracting(true);
    try {
      for (const file of Array.from(list)) {
        try {
          const txt = await extractTextFromFile(file);
          setFiles((prev) => [
            ...prev.filter((p) => p.name !== file.name),
            { name: file.name, text: txt, chars: txt.length },
          ]);
        } catch (e) {
          setExtractError(`${file.name}: ${(e as Error).message}`);
        }
      }
    } finally {
      setExtracting(false);
    }
  };

  const removeFile = (name: string) => setFiles((p) => p.filter((f) => f.name !== name));

  const callGenerate = useServerFn(generateChecklist);
  const generate = useMutation({
    mutationFn: (input: { query: string; documentText: string; documentTitle: string }) =>
      callGenerate({ data: input }),
    onSuccess: (res) => {
      setResult(res);
      setChecked(new Set());
    },
    onError: (e) => toast.error(`Errore generazione: ${(e as Error).message}`),
  });

  const canGenerate =
    !generate.isPending && !extracting && (query.trim().length > 3 || documentText.length > 30);

  const runGenerate = () => {
    if (!canGenerate) return;
    generate.mutate({ query: query.trim(), documentText, documentTitle });
  };

  const saveFn = useServerFn(savePractice);
  const saveMutation = useMutation({
    mutationFn: async (opts: { silent?: boolean } = {}) => {
      if (!result) throw new Error("Nessun risultato da salvare");
      const row = await saveFn({
        data: {
          id: practiceId,
          workspaceId,
          kind,
          title: initialTitle,
          input: {
            query: query.trim(),
            fileNames: files.map((f) => f.name),
            pinnedReminders,
          },
          result,
          checked: Array.from(checked),
        },
      });
      return { row, silent: !!opts.silent };
    },
    onSuccess: ({ silent }) => {
      for (const k of invalidateKeys) qc.invalidateQueries({ queryKey: k });
      if (!silent) toast.success("Pratica salvata");
    },
    onError: (err) => toast.error(`Errore salvataggio: ${(err as Error).message}`),
  });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    saveMutation.mutate({ silent: true });
  };

  const savePratica = () => {
    if (!result?.items?.length) {
      toast.error("Nessuna voce da salvare: genera prima una checklist.");
      return;
    }
    saveMutation.mutate({});
  };

  const persistResult = async (nextResult: ChecklistResult, nextChecked?: Set<string>) => {
    try {
      await saveFn({
        data: {
          id: practiceId,
          workspaceId,
          kind,
          title: initialTitle,
          input: {
            query: query.trim(),
            fileNames: files.map((f) => f.name),
            pinnedReminders,
          },
          result: nextResult,
          checked: Array.from(nextChecked ?? checked),
        },
      });
      for (const k of invalidateKeys) qc.invalidateQueries({ queryKey: k });
    } catch (e) {
      toast.error(`Errore salvataggio: ${(e as Error).message}`);
    }
  };

  const addManualItem = (section: ChecklistSection) => {
    const title = (newItemBySection[section] ?? "").trim();
    if (!title) return;
    const base: ChecklistResult =
      result ?? {
        practiceType: initialTitle,
        summary: "",
        disclaimer:
          "Checklist creata manualmente. Genera l'analisi AI per arricchirla con riferimenti INPS.",
        items: [],
        usedSources: [],
      };
    const newItem: ChecklistItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      section,
      title,
      status: "da_verificare",
      explanation: "",
      citations: [],
    };
    const next = { ...base, items: [...base.items, newItem] };
    setResult(next);
    setNewItemBySection((p) => ({ ...p, [section]: "" }));
    void persistResult(next);
  };

  const removeManualItem = (id: string) => {
    if (!result) return;
    const next = { ...result, items: result.items.filter((it) => it.id !== id) };
    setResult(next);
    const nextChecked = new Set(checked);
    nextChecked.delete(id);
    setChecked(nextChecked);
    void persistResult(next, nextChecked);
  };

  // Drag & drop items across sections
  const [dragId, setDragId] = useState<string | null>(null);
  const moveItem = (id: string, toSection: ChecklistSection, beforeId?: string) => {
    if (!result) return;
    const from = result.items.findIndex((it) => it.id === id);
    if (from < 0) return;
    const next = result.items.slice();
    const [moved] = next.splice(from, 1);
    moved.section = toSection;
    let insertAt = next.length;
    if (beforeId) {
      const idx = next.findIndex((it) => it.id === beforeId);
      if (idx >= 0) insertAt = idx;
    }
    next.splice(insertAt, 0, moved);
    const updated = { ...result, items: next };
    setResult(updated);
    void persistResult(updated);
  };

  const unpinFn = useServerFn(unpinReminderFromPractice);
  const unpinMutation = useMutation({
    mutationFn: (reminderId: string) =>
      unpinFn({ data: { practiceId, reminderId } }),
    onSuccess: (_res, reminderId) => {
      setPinnedReminders((prev) => prev.filter((r) => r.id !== reminderId));
      for (const k of invalidateKeys) qc.invalidateQueries({ queryKey: k });
      toast.success("Reminder rimosso");
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const exportRiepilogo = async () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`PRATICA — ${initialTitle}`);
    lines.push(`Aggiornata il ${new Date().toLocaleString("it-IT")}`);
    if (query) lines.push(`\nRichiesta: ${query}`);
    if (files.length) lines.push(`Documenti analizzati: ${files.map((f) => f.name).join(", ")}`);
    lines.push(`\nSintesi: ${result.summary}`);
    lines.push(`\n${result.disclaimer}\n`);
    for (const section of Object.keys(SECTION_LABELS) as ChecklistSection[]) {
      const items = result.items.filter((it) => it.section === section);
      if (items.length === 0) continue;
      lines.push(`\n— ${SECTION_LABELS[section].toUpperCase()} —`);
      for (const it of items) {
        const mark = checked.has(it.id) ? "[x]" : "[ ]";
        lines.push(`${mark} (${STATUS_META[it.status].label}) ${it.title}`);
        if (it.explanation) lines.push(`    ${it.explanation}`);
        if (it.citations.length) {
          lines.push(`    Fonti: ${it.citations.map((c) => c.label).join("; ")}`);
        }
      }
    }
    await downloadAsPdf(lines.join("\n"), slug(initialTitle));
  };

  const total = result?.items.length ?? 0;
  const done = result?.items.filter((it) => checked.has(it.id)).length ?? 0;

  return (
    <div className="space-y-5">
      {pinnedReminders.length > 0 && (
        <Card className="border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">
              Reminder pinnati ({pinnedReminders.length})
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sintesi operative ricavate dalla chat in linguaggio naturale.
          </p>
          <div className="mt-3 space-y-3">
            {pinnedReminders.map((r) => (
              <div key={r.id} className="rounded-md border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.title}</div>
                    {r.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {r.summary}
                      </p>
                    )}
                    {r.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {r.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.sourceRefs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.sourceRefs.map((s, i) =>
                          s.sourceId ? (
                            <Link
                              key={i}
                              to="/source/$id"
                              params={{ id: s.sourceId }}
                              className="rounded-full border bg-primary/5 px-2 py-0.5 text-[11px] hover:bg-primary/10"
                            >
                              [{s.n}] {s.label}
                            </Link>
                          ) : (
                            <span key={i} className="rounded-full border px-2 py-0.5 text-[11px]">
                              [{s.n}] {s.label}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    title="Rimuovi pin"
                    onClick={() => unpinMutation.mutate(r.id)}
                    disabled={unpinMutation.isPending}
                  >
                    <PinOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">1 · Descrivi la pratica</div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            La query preimpostata dal flusso può essere modificata per raffinare l'analisi.
          </p>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descrivi la pratica o la verifica…"
            className="mt-3 min-h-[120px]"
          />
          <Button onClick={runGenerate} disabled={!canGenerate} className="mt-3 gap-1.5">
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            {result?.items.length ? "Rigenera con AI" : "Genera checklist AI"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">
              2 · Allega documenti (opzionale)
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX o TXT del fascicolo. Il testo viene confrontato con le fonti INPS pertinenti.
          </p>
          <Input
            type="file"
            multiple
            className="mt-3"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
            onChange={(e) => onFilesAdded(e.target.files)}
          />
          {extracting && <p className="mt-2 text-xs text-muted-foreground">Estrazione…</p>}
          {extractError && <p className="mt-2 text-xs text-destructive">{extractError}</p>}
          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between rounded-md border bg-surface px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="text-muted-foreground">
                      {f.chars.toLocaleString("it-IT")} caratteri
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeFile(f.name)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {result && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge variant="secondary" className="rounded-sm">
                  {result.practiceType}
                </Badge>
                <h2 className="mt-2 font-display text-lg font-semibold">Checklist operativa</h2>
                <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {done}/{total} completate
                </Badge>
                <Button size="sm" variant="outline" onClick={savePratica} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Salva
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runGenerate}
                  disabled={generate.isPending}
                  className="gap-1.5"
                >
                  {generate.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Rigenera
                </Button>
                <Button size="sm" onClick={exportRiepilogo} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Esporta
                </Button>
              </div>
            </div>
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle className="text-sm">Avvertenza</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                {result.disclaimer}
              </AlertDescription>
            </Alert>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {(Object.keys(SECTION_LABELS) as ChecklistSection[]).map((section) => {
              const items = result.items.filter((it) => it.section === section);
              return (
                <Card
                  key={section}
                  className="p-5"
                  onDragOver={(e) => {
                    if (dragId) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    moveItem(dragId, section);
                    setDragId(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-semibold">
                      {SECTION_LABELS[section]}
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      {items.length}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {dragId ? "Rilascia qui per spostare la voce." : "Nessuna voce."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((it) => (
                        <Row
                          key={it.id}
                          item={it}
                          checked={checked.has(it.id)}
                          onToggle={() => toggle(it.id)}
                          onRemove={
                            it.id.startsWith("manual-")
                              ? () => removeManualItem(it.id)
                              : undefined
                          }
                          onMarkException={onMarkException ? () => onMarkException(it) : undefined}
                          dragging={dragId === it.id}
                          onDragStart={() => setDragId(it.id)}
                          onDragEnd={() => setDragId(null)}
                          onDropBefore={(e) => {
                            if (!dragId) return;
                            e.preventDefault();
                            e.stopPropagation();
                            moveItem(dragId, section, it.id);
                            setDragId(null);
                          }}
                          canDropTarget={!!dragId}
                        />
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={newItemBySection[section] ?? ""}
                      onChange={(e) =>
                        setNewItemBySection((p) => ({ ...p, [section]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addManualItem(section);
                        }
                      }}
                      placeholder="Aggiungi voce manuale…"
                      maxLength={200}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addManualItem(section)}
                      disabled={!(newItemBySection[section] ?? "").trim()}
                      className="h-8 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>


          {result.usedSources.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <div className="font-display text-base font-semibold">Fonti INPS utilizzate</div>
              </div>
              <Separator className="my-3" />
              <ul className="grid gap-2 md:grid-cols-2">
                {result.usedSources.map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/source/$id"
                      params={{ id: s.id }}
                      className="block rounded-md border bg-surface p-3 text-sm hover:border-primary/40"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="rounded-sm">
                          {s.source_type}
                        </Badge>
                        {s.document_number && (
                          <span className="font-mono">{s.document_number}</span>
                        )}
                        <span>{s.publication_date}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 font-medium">{s.title}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  checked,
  onToggle,
  onRemove,
  onMarkException,
  dragging,
  onDragStart,
  onDragEnd,
  onDropBefore,
  canDropTarget,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onMarkException?: () => void;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropBefore?: (e: DragEvent<HTMLLIElement>) => void;
  canDropTarget?: boolean;
}) {
  const meta = STATUS_META[item.status];
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        if (canDropTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDrop={(e) => onDropBefore?.(e)}
      className={`cursor-grab rounded-md border bg-surface p-3 active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-0.5"
          aria-label={`Segna: ${item.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-medium ${checked ? "text-muted-foreground line-through" : ""}`}
            >
              {item.title}
            </span>
            <Badge variant="outline" className={`rounded-sm text-[10px] ${meta.className}`}>
              {meta.label}
            </Badge>
            {onRemove && (
              <Badge variant="outline" className="rounded-sm text-[10px]">
                manuale
              </Badge>
            )}
          </div>
          {item.explanation && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {item.explanation}
            </p>
          )}
          {item.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.citations.map((c, i) =>
                c.sourceId ? (
                  <Link
                    key={i}
                    to="/source/$id"
                    params={{ id: c.sourceId }}
                    className="inline-flex items-center rounded-full border bg-primary/5 px-2 py-0.5 text-[11px] hover:bg-primary/10"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    key={i}
                    className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {c.label}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onMarkException && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
              title="Segna come eccezione: salva questo step in Memoria AI come caso particolare"
              onClick={onMarkException}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </Button>
          )}
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Rimuovi voce"
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "pratica"
  );
}
