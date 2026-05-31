import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  Sparkles,
  XCircle,
  PlusCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSources, type UISource } from "@/lib/data";
import { compareSources, type CompareDiff } from "@/lib/compare.functions";

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
  const options = sources.filter((s) => s.id !== excludeId);
  return (
    <Card className="p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <Select value={selectedId} onValueChange={onChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Caricamento…" : "Scegli un atto…"} />
        </SelectTrigger>
        <SelectContent className="max-h-96">
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="font-mono text-xs text-muted-foreground">
                {s.publication_date.slice(0, 10)}
              </span>{" "}
              · {s.source_type} {s.document_number} — {s.title.slice(0, 70)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  query: ReturnType<typeof useQuery<CompareDiff, Error>>;
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
