import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Loader2, GitCompareArrows, Landmark, FileStack, Search, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSources, type UISource } from "@/lib/data";

export const Route = createFileRoute("/_appshell/sources")({
  head: () => ({ meta: [{ title: "Fonti · INPS Copilot" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SourcesPage,
});

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function filterSources(items: UISource[], query: string): UISource[] {
  const q = normalize(query.trim());
  if (!q) return items;
  // Numeric search: match document_number like "23", "23/2022", "n. 23"
  const numMatch = q.match(/\d+/);
  const numToken = numMatch?.[0];
  return items.filter((s) => {
    const hay = normalize(
      [s.title, s.document_number, s.source_type, s.summary, s.excerpt, ...(s.topic_tags ?? [])]
        .filter(Boolean)
        .join(" "),
    );
    if (hay.includes(q)) return true;
    if (numToken && s.document_number && normalize(s.document_number).includes(numToken)) return true;
    return false;
  });
}

function SourcesPage() {
  const { q: urlQ } = Route.useSearch();
  const navigate = useNavigate();
  const { data: sources, isLoading, error } = useSources();
  const [query, setQuery] = useState(urlQ ?? "");

  useEffect(() => {
    setQuery(urlQ ?? "");
  }, [urlQ]);

  const filtered = useMemo(() => filterSources(sources ?? [], query), [sources, query]);
  const inps = filtered.filter((s) => s.source_type !== "Normativa");
  const normative = filtered.filter((s) => s.source_type === "Normativa");

  const submit = (value: string) => {
    const v = value.trim();
    navigate({ to: "/sources", search: v ? { q: v } : {} });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fonti</p>
          <h1 className="font-display text-2xl font-semibold">Archivio circolari, messaggi e normativa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sources?.length ?? 0} atti ufficiali indicizzati · aggiornato il{" "}
            {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to="/compare" search={{}}>
            <GitCompareArrows className="h-3.5 w-3.5" /> Confronta due atti
          </Link>
        </Button>
      </div>

      <Card className="p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(query);
          }}
          className="flex items-center gap-2"
        >
          <Search className="ml-3 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per tema (es. ADI, Assegno Unico) o per numero (es. 23/2022)"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                setQuery("");
                navigate({ to: "/sources", search: {} });
              }}
            >
              <X className="h-3.5 w-3.5" /> Pulisci
            </Button>
          )}
          <Button type="submit" size="sm">Cerca</Button>
        </form>
      </Card>

      {urlQ && (
        <div className="text-xs text-muted-foreground">
          {filtered.length} risultat{filtered.length === 1 ? "o" : "i"} per <strong className="text-foreground">"{urlQ}"</strong>
          {" · "}
          <Link to="/search" search={{ q: urlQ }} className="text-primary hover:underline">
            Chiedi all'AI invece
          </Link>
        </div>
      )}

      {isLoading && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento corpus…
        </Card>
      )}
      {error && (
        <Card className="p-6 text-sm text-destructive">Errore nel caricamento delle fonti.</Card>
      )}

      {sources && sources.length > 0 && (
        <Tabs defaultValue="inps" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="inps" className="gap-1.5">
              <FileStack className="h-3.5 w-3.5" /> Atti INPS ({inps.length})
            </TabsTrigger>
            <TabsTrigger value="normativa" className="gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Normativa cardine ({normative.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inps" className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Circolari, messaggi, decreti e pagine servizio INPS in ordine cronologico (più recenti in alto).
            </p>
            <SourceList items={inps} empty={urlQ ? `Nessun atto INPS corrisponde a "${urlQ}".` : "Nessun atto INPS nel corpus."} />
          </TabsContent>

          <TabsContent value="normativa" className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Solo normativa cardine (leggi, decreti legge, decreti legislativi) per data di pubblicazione.
            </p>
            <SourceList items={normative} empty={urlQ ? `Nessuna normativa corrisponde a "${urlQ}".` : "Nessuna normativa cardine indicizzata."} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SourceList({ items, empty }: { items: UISource[]; empty: string }) {
  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">{empty}</Card>
    );
  }
  return (
    <Card className="divide-y p-0">
      {items.map((s) => (
        <Link
          key={s.id}
          to="/source/$id"
          params={{ id: s.id }}
          className="flex items-start gap-4 px-5 py-4 hover:bg-surface-muted/50"
        >
          <FileText className="mt-1 h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
              <span className="font-mono text-muted-foreground">{s.document_number}</span>
              <span className="text-muted-foreground">
                {new Date(s.publication_date).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {s.topic_tags.map((t) => (
                <Badge key={t} variant="outline" className="rounded-sm font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="mt-1 font-medium text-foreground">{s.title}</div>
            <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{s.summary}</div>
          </div>
        </Link>
      ))}
    </Card>
  );
}
