import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  ShieldCheck,
  Bookmark,
  Download,
  PenSquare,
  ExternalLink,
  Sparkles,
  ListFilter,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { groundedSearch } from "@/lib/search.functions";

export const Route = createFileRoute("/_appshell/search")({
  head: () => ({ meta: [{ title: "Ricerca · INPS Copilot" }] }),
  component: SearchPage,
});

const EXAMPLES = [
  "Nuove regole ADI 2026",
  "Messaggi INPS NASpI sospensione",
  "Assegno Unico domanda arretrati",
  "Rivalutazione pensioni 2026",
  "Contributi UniEmens nuovi codici",
];

type SearchResult = Awaited<ReturnType<typeof groundedSearch>>;

function renderAnswer(text: string) {
  // Minimal markdown-ish rendering: bold **x**, citations [n] -> sup, sections "## "
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    if (/^#{2,3}\s/.test(line)) {
      return (
        <div key={i} className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {line.replace(/^#+\s*/, "")}
        </div>
      );
    }
    return (
      <p key={i} className="leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(line: string) {
  // Split by [n] and **bold**
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|\[\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <sup key={k++} className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
          {tok}
        </sup>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function SearchPage() {
  const [q, setQ] = useState("Nuove regole ADI 2026 per nuclei con minori");
  const runSearch = useServerFn(groundedSearch);
  const mutation = useMutation<SearchResult, Error, string>({
    mutationFn: (query: string) => runSearch({ data: { query } }),
  });

  const submit = (query: string) => {
    if (query.trim().length < 2) return;
    mutation.mutate(query);
  };

  const result = mutation.data;
  const sources = result?.sources ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ricerca</p>
        <h1 className="font-display text-2xl font-semibold">Chiedi in linguaggio naturale.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le risposte sono sempre basate su circolari, messaggi e normativa ufficiale INPS.
        </p>
      </div>

      <Card className="p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="flex items-center gap-2"
        >
          <Search className="ml-3 h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="es. requisiti ADI 2026 per nuclei con minori"
            className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="sm" className="gap-1.5" type="button">
            <ListFilter className="h-4 w-4" /> Filtri
          </Button>
          <Button type="submit" className="gap-1.5" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Cerca
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Esempi</span>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => {
              setQ(e);
              submit(e);
            }}
            className="rounded-full border bg-surface px-3 py-1 text-xs hover:border-primary/40 hover:text-foreground"
          >
            {e}
          </button>
        ))}
      </div>

      {mutation.isPending && (
        <Card className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Sto cercando nel corpus INPS e generando una risposta citata…
        </Card>
      )}

      {mutation.isError && (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/5 p-5 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <div className="font-medium text-destructive">Errore di ricerca</div>
            <div className="text-muted-foreground">{mutation.error.message}</div>
            {mutation.error.message.includes("match_chunks") && (
              <div className="mt-2 text-xs">
                Suggerimento: vai in <strong>Impostazioni → Indice AI</strong> ed esegui "Aggiorna indice".
              </div>
            )}
          </div>
        </Card>
      )}

      {result && !mutation.isPending && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Answer */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                  <ShieldCheck className="h-3 w-3" />
                  Basato su {sources.length} font{sources.length === 1 ? "e" : "i"} ufficial{sources.length === 1 ? "e" : "i"} INPS
                </Badge>
                {sources[0]?.similarity != null && (
                  <Badge variant="secondary" className="gap-1">
                    Top match {(sources[0].similarity * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" /> Salva
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Esporta
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PenSquare className="h-3.5 w-3.5" /> A nota
                </Button>
              </div>
            </div>

            <h2 className="mt-5 font-display text-xl font-semibold">Risposta</h2>
            <div className="mt-2 space-y-1">{renderAnswer(result.answer)}</div>

            <div className="mt-6 rounded-md border-l-2 border-primary bg-surface-muted p-4 text-sm">
              <div className="font-medium">Avvertenza</div>
              <p className="mt-1 text-muted-foreground">
                Questa sintesi è generata automaticamente sulla base delle fonti indicate. Verifica sempre il testo
                ufficiale prima di un atto formale.
              </p>
            </div>
          </Card>

          {/* Sources */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-semibold">Fonti citate</div>
                <p className="text-xs text-muted-foreground">{sources.length} atti ufficiali INPS</p>
              </div>
              <Badge variant="outline" className="text-xs">
                Ordine per pertinenza
              </Badge>
            </div>
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.chunk_id} className="rounded-md border bg-surface p-4">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge className="rounded-sm bg-primary text-primary-foreground">[{s.n}]</Badge>
                    <Badge variant="secondary" className="rounded-sm capitalize">
                      {s.source_type}
                    </Badge>
                    <span className="font-mono text-muted-foreground">{s.document_number}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">{s.title}</div>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">"{s.excerpt}"</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {s.publication_date
                        ? new Date(s.publication_date).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                    <a
                      href={s.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      INPS.it <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nessuna fonte trovata. Prova a riformulare la domanda o aggiorna l'indice AI.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
