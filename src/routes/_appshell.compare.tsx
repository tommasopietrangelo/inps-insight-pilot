import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronsUpDown,
  ExternalLink,
  HelpCircle,
  Loader2,
  Search,
  Sparkles,
  XCircle,
  PlusCircle,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useSources, type UISource } from "@/lib/data";
import { compareSources, type CompareDiff } from "@/lib/compare.functions";
import { SavePracticeButton } from "@/components/save-practice-button";

const SearchSchema = z.object({
  a: z.string().optional(),
  b: z.string().optional(),
});

export const Route = createFileRoute("/_appshell/compare")({
  head: () => ({ meta: [{ title: "Confronta atti · INPS Copilot" }] }),
  validateSearch: SearchSchema,
  component: ComparePage,
});

function ComparePage() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const { data: sources = [], isLoading } = useSources();

  const aSrc = useMemo(() => sources.find((s) => s.id === a), [sources, a]);
  const bSrc = useMemo(() => sources.find((s) => s.id === b), [sources, b]);

  const setA = (id: string) => navigate({ search: { a: id, b } });
  const setB = (id: string) => navigate({ search: { a, b: id } });
  const swap = () => navigate({ search: { a: b, b: a } });

  const callCompare = useServerFn(compareSources);
  const diffQuery = useQuery({
    queryKey: ["compare", aSrc?.uuid, bSrc?.uuid],
    enabled: !!aSrc && !!bSrc && aSrc.uuid !== bSrc.uuid,
    queryFn: () => callCompare({ data: { aId: aSrc!.uuid, bId: bSrc!.uuid } }),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sources"><ArrowLeft className="mr-1.5 h-4 w-4" /> Archivio fonti</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={swap} disabled={!aSrc || !bSrc} className="gap-1.5">
          <ArrowLeftRight className="h-3.5 w-3.5" /> Inverti
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confronto atti</p>
        <h1 className="font-display text-2xl font-semibold">Affianca due atti e vedi cosa cambia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scegli un atto precedente e uno più recente. L'analisi AI evidenzia regole superate, ancora valide e nuove.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PickerCard
          label="Atto A"
          selectedId={a}
          onChange={setA}
          sources={sources}
          loading={isLoading}
          excludeId={b}
        />
        <PickerCard
          label="Atto B"
          selectedId={b}
          onChange={setB}
          sources={sources}
          loading={isLoading}
          excludeId={a}
        />
      </div>

      {aSrc && bSrc && aSrc.uuid === bSrc.uuid && (
        <Card className="p-4 text-sm text-muted-foreground">Seleziona due atti diversi.</Card>
      )}

      {aSrc && bSrc && aSrc.uuid !== bSrc.uuid && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <SourcePane src={aSrc} side="A" />
            <SourcePane src={bSrc} side="B" />
          </div>

          <DiffPanel
            query={diffQuery}
            older={aSrc.publication_date <= bSrc.publication_date ? aSrc : bSrc}
            newer={aSrc.publication_date <= bSrc.publication_date ? bSrc : aSrc}
          />
        </>
      )}
    </div>
  );
}

function PickerCard({
  label,
  selectedId,
  onChange,
  sources,
  loading,
  excludeId,
}: {
  label: string;
  selectedId?: string;
  onChange: (id: string) => void;
  sources: UISource[];
  loading: boolean;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = sources.find((s) => s.id === selectedId);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const options = useMemo(() => {
    const base = sources.filter((s) => s.id !== excludeId);
    const q = norm(query.trim());
    if (!q) return base.slice(0, 100);
    const numToken = q.match(/\d+/)?.[0];
    return base
      .filter((s) => {
        const hay = norm(
          [s.title, s.document_number, s.source_type, s.summary, ...(s.topic_tags ?? [])]
            .filter(Boolean)
            .join(" "),
        );
        if (hay.includes(q)) return true;
        if (numToken && s.document_number && norm(s.document_number).includes(numToken)) return true;
        return false;
      })
      .slice(0, 100);
  }, [sources, excludeId, query]);

  return (
    <Card className="p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={loading}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
              {loading
                ? "Caricamento…"
                : selected
                  ? `${selected.source_type} ${selected.document_number} — ${selected.title}`
                  : "Cerca o scegli un atto…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per tema o numero (es. ADI, 23/2022)"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nessun atto trovato.
              </div>
            ) : (
              options.map((s) => {
                const isSel = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted/60",
                      isSel && "bg-surface-muted/40",
                    )}
                  >
                    <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isSel ? "opacity-100 text-primary" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">
                          {s.source_type}
                        </Badge>
                        <span className="font-mono">{s.document_number}</span>
                        <span>·</span>
                        <span>{s.publication_date.slice(0, 10)}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-sm leading-snug">{s.title}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {options.length} risultat{options.length === 1 ? "o" : "i"}
            {options.length === 100 ? " (primi 100)" : ""}
          </div>
        </PopoverContent>
      </Popover>
    </Card>
  );
}

function SourcePane({ src, side }: { src: UISource; side: "A" | "B" }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-2 text-xs">
        <Badge className="rounded-sm bg-primary text-primary-foreground">{side}</Badge>
        <Badge variant="secondary" className="rounded-sm">{src.source_type}</Badge>
        <span className="font-mono text-muted-foreground">{src.document_number}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {new Date(src.publication_date).toLocaleDateString("it-IT", {
          day: "2-digit", month: "long", year: "numeric",
        })}
      </div>
      <h2 className="mt-2 font-display text-base font-semibold leading-snug">{src.title}</h2>
      <div className="mt-2 flex flex-wrap gap-1">
        {src.topic_tags.map((t) => (
          <Badge key={t} variant="outline" className="rounded-sm font-normal">{t}</Badge>
        ))}
      </div>
      <Separator className="my-3" />
      <p className="text-sm text-foreground/90">{src.summary}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-primary">Mostra testo integrale</summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-surface-muted/40 p-3 font-sans text-xs leading-relaxed">
          {src.full_text || src.excerpt}
        </pre>
      </details>
      <div className="mt-auto pt-3">
        <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
          <a href={src.official_url} target="_blank" rel="noreferrer">
            Apri su INPS.it <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </Card>
  );
}

function DiffPanel({
  query,
  older,
  newer,
}: {
  query: UseQueryResult<CompareDiff, Error>;
  older: UISource;
  newer: UISource;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Analisi delle differenze</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Più recente: <span className="font-medium text-foreground">{newer.source_type} {newer.document_number}</span>
        {" · "}Precedente: <span className="font-medium text-foreground">{older.source_type} {older.document_number}</span>
      </p>
      <Separator className="my-4" />

      {query.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisi in corso…
        </div>
      )}
      {query.error && (
        <div className="text-sm text-destructive">Errore: {(query.error as Error).message}</div>
      )}
      {query.data && (
        <div className="space-y-5 text-sm">
          {query.data.summary && (
            <p className="rounded-md border bg-surface-muted/40 p-3 leading-relaxed">{query.data.summary}</p>
          )}
          <DiffList
            icon={<PlusCircle className="h-4 w-4 text-emerald-600" />}
            title="Nuove regole introdotte"
            items={query.data.newRules}
            empty="Nessuna nuova regola rilevata."
          />
          <DiffList
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            title="Regole superate o sovrascritte"
            items={query.data.superseded}
            empty="Nessuna regola dell'atto precedente risulta superata."
          />
          <DiffList
            icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
            title="Ancora valide dall'atto precedente"
            items={query.data.stillValid}
            empty="Non sono state individuate regole confermate."
          />
          <DiffList
            icon={<HelpCircle className="h-4 w-4 text-amber-600" />}
            title="Punti aperti / da chiarire"
            items={query.data.openQuestions}
            empty="Nessun punto aperto rilevato."
          />
        </div>
      )}
    </Card>
  );
}

function DiffList({
  icon, title, items, empty,
}: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="rounded-md border bg-surface p-2.5 leading-relaxed">{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
