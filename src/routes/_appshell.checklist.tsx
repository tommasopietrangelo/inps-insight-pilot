import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileUp,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
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
import { listPractices, savePractice, deletePractice } from "@/lib/practices.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_appshell/checklist")({
  head: () => ({ meta: [{ title: "Crea checklist pratica · INPS Copilot" }] }),
  component: ChecklistPage,
});

type LoadedFile = { name: string; text: string; chars: number };

const SECTION_LABELS: Record<ChecklistSection, string> = {
  requisiti: "Requisiti da verificare",
  documenti: "Documenti presenti o mancanti",
  controlli: "Controlli e anomalie da verificare",
  passi_successivi: "Passi successivi",
};

const STATUS_META: Record<
  ChecklistStatus,
  { label: string; className: string }
> = {
  presente: {
    label: "Presente",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  },
  mancante: {
    label: "Mancante",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  da_verificare: {
    label: "Da verificare",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
};

const STORAGE_KEY = "inpscopilot.savedPratiche";

type SavedPratica = {
  id: string;
  savedAt: string;
  query: string;
  fileNames: string[];
  result: ChecklistResult;
  checked: string[];
};

function loadSaved(): SavedPratica[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function ChecklistPage() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedPratica[]>(() => loadSaved());

  const callGenerate = useServerFn(generateChecklist);
  const generate = useMutation({
    mutationFn: (input: { query: string; documentText: string; documentTitle: string }) =>
      callGenerate({ data: input }),
    onSuccess: (res) => {
      setResult(res);
      setChecked(new Set());
    },
  });

  const documentText = useMemo(
    () =>
      files
        .map((f) => `=== ${f.name} ===\n${f.text}`)
        .join("\n\n"),
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

  const canGenerate =
    !generate.isPending && !extracting && (query.trim().length > 3 || documentText.length > 30);

  const runGenerate = () => {
    if (!canGenerate) return;
    generate.mutate({
      query: query.trim(),
      documentText,
      documentTitle,
    });
  };

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const savePratica = () => {
    if (!result) return;
    const entry: SavedPratica = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      query: query.trim(),
      fileNames: files.map((f) => f.name),
      result,
      checked: Array.from(checked),
    };
    const next = [entry, ...saved].slice(0, 50);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast.success("Pratica salvata localmente");
  };

  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const loadSavedPratica = (s: SavedPratica) => {
    setQuery(s.query);
    setFiles([]);
    setResult(s.result);
    setChecked(new Set(s.checked));
    toast.info("Pratica caricata");
  };

  const exportRiepilogo = async () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`CHECKLIST PRATICA — ${result.practiceType}`);
    lines.push(`Generata il ${new Date().toLocaleString("it-IT")}`);
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
        lines.push(`    ${it.explanation}`);
        if (it.citations.length) {
          lines.push(`    Fonti: ${it.citations.map((c) => c.label).join("; ")}`);
        }
      }
    }
    if (result.usedSources.length) {
      lines.push(`\n— FONTI INPS UTILIZZATE —`);
      for (const s of result.usedSources) {
        lines.push(`• ${s.source_type.toUpperCase()} ${s.document_number ?? ""} — ${s.title} (${s.publication_date})`);
      }
    }
    await downloadAsPdf(lines.join("\n"), `checklist-${slug(result.practiceType)}`);
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Cruscotto
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assistente operativo
          </p>
          <h1 className="font-display text-2xl font-semibold">Crea checklist pratica</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Descrivi la pratica o carica i documenti del fascicolo. Generiamo una checklist
            operativa con riferimenti puntuali alle circolari e ai messaggi INPS.
          </p>
        </div>
        <Button onClick={runGenerate} disabled={!canGenerate} className="gap-1.5">
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4" />
          )}
          Crea checklist pratica
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">1 · Descrivi la pratica</div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Esempi: «checklist per domanda NASpI», «documenti da controllare per pensione di
            vecchiaia», «istruttoria Assegno Unico per nucleo con minori».
          </p>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descrivi la pratica o la verifica che vuoi impostare…"
            className="mt-3 min-h-[120px]"
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">2 · Allega documenti (opzionale)</div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX o TXT del fascicolo. Estraiamo il testo lato client e lo confrontiamo
            con le fonti INPS pertinenti.
          </p>
          <Input
            type="file"
            multiple
            className="mt-3"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
            onChange={(e) => onFilesAdded(e.target.files)}
          />
          {extracting && (
            <p className="mt-2 text-xs text-muted-foreground">Estrazione testo in corso…</p>
          )}
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
                    <div className="text-muted-foreground">{f.chars.toLocaleString("it-IT")} caratteri estratti</div>
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

      {generate.error && (
        <Card className="p-4 text-sm text-destructive">
          Errore: {(generate.error as Error).message}
        </Card>
      )}

      {result && (
        <ChecklistResultView
          result={result}
          checked={checked}
          onToggle={toggle}
          onRegenerate={runGenerate}
          onSave={savePratica}
          onExport={exportRiepilogo}
          isRegenerating={generate.isPending}
        />
      )}

      {saved.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold">Pratiche salvate</div>
              <p className="text-xs text-muted-foreground">
                Salvate localmente in questo dispositivo.
              </p>
            </div>
          </div>
          <ul className="divide-y">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <button
                  onClick={() => loadSavedPratica(s)}
                  className="min-w-0 flex-1 text-left hover:underline"
                >
                  <div className="truncate text-sm font-medium">{s.result.practiceType}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(s.savedAt).toLocaleString("it-IT")} · {s.result.items.length} voci ·{" "}
                    {s.fileNames.length} doc.
                  </div>
                </button>
                <Button size="icon" variant="ghost" onClick={() => deleteSaved(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "pratica";
}

function ChecklistResultView({
  result,
  checked,
  onToggle,
  onRegenerate,
  onSave,
  onExport,
  isRegenerating,
}: {
  result: ChecklistResult;
  checked: Set<string>;
  onToggle: (id: string) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onExport: () => void;
  isRegenerating: boolean;
}) {
  const total = result.items.length;
  const done = result.items.filter((it) => checked.has(it.id)).length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="rounded-sm">
              {result.practiceType}
            </Badge>
            <h2 className="mt-2 font-display text-lg font-semibold">
              Checklist operativa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {done}/{total} completate
            </Badge>
            <Button size="sm" variant="outline" onClick={onSave} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salva pratica
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="gap-1.5"
            >
              {isRegenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Rigenera checklist
            </Button>
            <Button size="sm" onClick={onExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Esporta riepilogo
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
            <Card key={section} className="p-5">
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
                <p className="text-sm text-muted-foreground">Nessuna voce in questa sezione.</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((it) => (
                    <ChecklistRow
                      key={it.id}
                      item={it}
                      checked={checked.has(it.id)}
                      onToggle={() => onToggle(it.id)}
                    />
                  ))}
                </ul>
              )}
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
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[item.status];
  return (
    <li className="rounded-md border bg-surface p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-0.5"
          aria-label={`Segna come fatto: ${item.title}`}
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
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.explanation}
          </p>
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
      </div>
    </li>
  );
}
