import type React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Brain,
  Lock,
  RotateCcw,
  Eye,
  ArrowRight,
  MessageCircle,
  Send,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groundedSearch } from "@/lib/search.functions";
import { createSavedSearch } from "@/lib/saved-searches.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";

import { ChatQuickActions } from "@/components/chat-quick-actions";

export const Route = createFileRoute("/_appshell/search")({
  head: () => ({ meta: [{ title: "Ricerca · INPS Copilot" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
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

type SourceItem = SearchResult["sources"][number];

function shortLabel(s: SourceItem): string {
  const type = (s.source_type ?? "").toLowerCase();
  const typeShort =
    type.startsWith("circ") ? "Circ."
      : type.startsWith("mess") ? "Msg"
      : type.startsWith("norm") ? "Norm."
      : s.source_type ?? "Fonte";
  const num = s.document_number?.trim();
  const base = num ? `${typeShort} ${num}` : `${typeShort} — ${s.title ?? ""}`;
  return base.length > 48 ? base.slice(0, 47) + "…" : base;
}

function CitationChip({ s }: { s: SourceItem }) {
  return (
    <Link
      to="/source/$id"
      params={{ id: s.source_id }}
      className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary align-baseline hover:bg-primary/10 hover:border-primary/50 transition-colors"
      title={s.title}
    >
      <span className="rounded bg-primary/15 px-1 text-[10px] leading-none py-0.5">[{s.n}]</span>
      <span className="leading-none">{shortLabel(s)}</span>
    </Link>
  );
}

function renderAnswer(text: string, sources: SourceItem[]) {
  const byN = new Map(sources.map((s) => [s.n, s]));
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
        {renderInline(line, byN)}
      </p>
    );
  });
}

function renderInline(line: string, byN: Map<number, SourceItem>) {
  const parts: React.ReactNode[] = [];
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
      const n = parseInt(tok.slice(1, -1), 10);
      const src = byN.get(n);
      if (src) {
        parts.push(<CitationChip key={k++} s={src} />);
      } else {
        parts.push(
          <sup key={k++} className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
            {tok}
          </sup>,
        );
      }
    }
    last = m.index + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

type Turn = {
  id: string;
  question: string;
  answer: string;
  sources: SourceItem[];
};

function SearchPage() {
  const { q: urlQ } = Route.useSearch();
  const [q, setQ] = useState(urlQ ?? "Nuove regole ADI 2026 per nuclei con minori");
  const [followUp, setFollowUp] = useState("");
  const [thread, setThread] = useState<Turn[]>([]);
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const runSearch = useServerFn(groundedSearch);
  const saveFn = useServerFn(createSavedSearch);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation<
    SearchResult,
    Error,
    { query: string; isFollowUp: boolean }
  >({
    mutationFn: ({ query, isFollowUp }) => {
      const history = isFollowUp
        ? thread.flatMap((t) => [
            { role: "user" as const, content: t.question },
            { role: "assistant" as const, content: t.answer },
          ])
        : [];
      return runSearch({ data: { query, history } });
    },
    onSuccess: (data, vars) => {
      const turn: Turn = {
        id: crypto.randomUUID(),
        question: vars.query,
        answer: data.answer,
        sources: data.sources,
      };
      setThread((prev) => (vars.isFollowUp ? [...prev, turn] : [turn]));
      if (vars.isFollowUp) setFollowUp("");
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    },
  });

  const lastRunRef = useRef<string | null>(null);
  useEffect(() => {
    const trimmed = (urlQ ?? "").trim();
    if (trimmed.length >= 2 && lastRunRef.current !== trimmed) {
      lastRunRef.current = trimmed;
      setQ(urlQ ?? "");
      setThread([]);
      mutation.mutate({ query: trimmed, isFollowUp: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          query: q.trim(),
          workspaceId: current?.id ?? null,
          resultsCount: thread[thread.length - 1]?.sources.length ?? 0,
        },
      }),
    onSuccess: () => {
      toast.success("Ricerca salvata nello workspace");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (query: string) => {
    if (query.trim().length < 2 || mutation.isPending) return;
    setThread([]);
    mutation.mutate({ query: query.trim(), isFollowUp: false });
  };

  const submitFollowUp = (query: string) => {
    if (query.trim().length < 2 || mutation.isPending || thread.length === 0) return;
    mutation.mutate({ query: query.trim(), isFollowUp: true });
  };

  const resetThread = () => {
    setThread([]);
    setFollowUp("");
    lastRunRef.current = null;
  };



  const latestTurn = thread[thread.length - 1];
  const sources = latestTurn?.sources ?? [];
  const hasThread = thread.length > 0;

  // Memoria AI (mock UI only)
  const isPro = true; // toggle to false to preview the locked state
  const [useMemory, setUseMemory] = useState<boolean>(false);
  const [upgradeOpen, setUpgradeOpen] = useState<boolean>(false);
  const memorySuggestions = [
    { label: "Pratica NASpI · sig. Bianchi (apr. 2026)", to: "/workspace" },
    { label: "Ricerca recente: rivalutazione pensioni 2026", to: "/search?q=Rivalutazione+pensioni+2026" },
    { label: "Documento analizzato: ISEE nucleo Rossi.pdf", to: "/analyze" },
  ];

  return (
    <div className="space-y-8">
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b bg-surface px-6 pb-10 pt-10 lg:-mx-8 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Ricerca</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Chiedi in linguaggio naturale.
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Le risposte sono sempre basate su circolari, messaggi e normativa ufficiale INPS.
          </p>
        </div>
      </div>

      <Card className="p-2 shadow-elevated">

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="flex items-start gap-2"
        >
          <Search className="ml-3 mt-3 h-5 w-5 shrink-0 text-muted-foreground" />
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit(q);
              }
            }}
            rows={2}
            placeholder="Fai una domanda completa in linguaggio naturale… (Cmd/Ctrl+Invio per inviare)"
            className="min-h-11 max-h-64 flex-1 resize-y bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="sm" className="mt-1 gap-1.5" type="button">
            <ListFilter className="h-4 w-4" /> Filtri
          </Button>
          <Button type="submit" className="mt-1 gap-1.5" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Cerca
          </Button>
        </form>
        <div className="mt-1 flex items-center justify-between border-t px-3 py-2">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPro) {
                      setUpgradeOpen(true);
                      return;
                    }
                    setUseMemory((v) => !v);
                  }}
                  className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-sm"
                >
                  <Brain
                    className={`h-4 w-4 ${useMemory && isPro ? "text-orange-500" : "text-muted-foreground"}`}
                  />
                  <span className="font-medium text-foreground">Usa Memoria AI</span>
                  <Badge className="gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] text-white hover:from-amber-500 hover:to-orange-500">
                    {!isPro && <Lock className="h-3 w-3" />}
                    {isPro && <Sparkles className="h-3 w-3" />} PRO
                  </Badge>
                  {isPro && (
                    <Switch
                      checked={useMemory}
                      onCheckedChange={setUseMemory}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1 data-[state=checked]:bg-orange-500"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Ricalibra la risposta in base alle tue pratiche, ricerche e documenti già analizzati.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {useMemory && isPro && (
            <span className="text-xs text-muted-foreground">Memoria AI attiva su questa ricerca</span>
          )}
        </div>
      </Card>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Memoria AI è una funzione PRO
            </DialogTitle>
            <DialogDescription>
              Passa al piano PRO per consentire al Copilot di ricalibrare ogni risposta in base alle
              pratiche, ricerche e documenti del tuo studio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Non ora
            </Button>
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90">
              Scopri il piano PRO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {hasThread && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Thread + composer */}
          <div className="space-y-5">
            {thread.map((turn, idx) => (
              <div key={turn.id} className="space-y-3">
                {/* User question bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[92%] rounded-2xl rounded-br-sm bg-primary/90 px-4 py-2.5 text-sm text-primary-foreground">
                    {turn.question}
                  </div>
                </div>
                {/* Assistant answer card */}
                <Card className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {turn.sources.length} font{turn.sources.length === 1 ? "e" : "i"} ufficial{turn.sources.length === 1 ? "e" : "i"} INPS
                      </Badge>
                      {turn.sources[0]?.similarity != null && (
                        <Badge variant="secondary" className="gap-1">
                          Top match {(turn.sources[0].similarity * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {idx > 0 && (
                        <Badge variant="secondary" className="text-[10px]">Follow-up</Badge>
                      )}
                    </div>
                    {idx === thread.length - 1 && (
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => saveMut.mutate()}
                          disabled={saveMut.isPending}
                        >
                          {saveMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                          Salva
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled>
                          <Download className="h-3.5 w-3.5" /> Esporta
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled>
                          <PenSquare className="h-3.5 w-3.5" /> A nota
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-1">{renderAnswer(turn.answer, turn.sources)}</div>

                  {idx === thread.length - 1 && !mutation.isPending && (
                    <ChatQuickActions
                      question={turn.question}
                      answer={turn.answer}
                      sources={turn.sources.map((s) => ({
                        n: s.n,
                        source_id: s.source_id,
                        title: s.title,
                        source_type: s.source_type,
                        document_number: s.document_number,
                      }))}
                      onFollowUp={(prompt) => submitFollowUp(prompt)}
                      followUpPending={mutation.isPending}
                    />
                  )}
                </Card>
              </div>
            ))}


            {mutation.isPending && hasThread && (
              <div className="flex items-center gap-2 rounded-md border bg-surface px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Sto consultando il corpus INPS per la tua nuova domanda…
              </div>
            )}

            <div ref={threadEndRef} />

            {/* Follow-up composer */}
            <Card className="p-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitFollowUp(followUp);
                }}
                className="flex items-start gap-2"
              >
                <MessageCircle className="ml-3 mt-3 h-5 w-5 shrink-0 text-muted-foreground" />
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitFollowUp(followUp);
                    }
                  }}
                  rows={2}
                  placeholder="Continua la conversazione… (es. ‘E se il nucleo ha un minore disabile?’)"
                  className="min-h-11 max-h-64 flex-1 resize-y bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  className="mt-1 gap-1.5"
                  disabled={mutation.isPending || followUp.trim().length < 2}
                >
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Invia
                </Button>
              </form>
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {thread.length} turn{thread.length === 1 ? "o" : "i"} in questa conversazione
                </span>
                <button
                  type="button"
                  onClick={resetThread}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <RotateCcw className="h-3 w-3" /> Nuova conversazione
                </button>
              </div>
            </Card>

            <div className="rounded-md border-l-2 border-primary bg-surface-muted p-4 text-sm">
              <div className="font-medium">Avvertenza</div>
              <p className="mt-1 text-muted-foreground">
                Le risposte sono generate automaticamente sulla base delle fonti citate. Verifica sempre il testo
                ufficiale prima di un atto formale.
              </p>
            </div>
          </div>

          {/* Sources for latest turn */}
          <Card className="p-5 h-fit lg:sticky lg:top-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-semibold">Fonti citate</div>
                <p className="text-xs text-muted-foreground">
                  {sources.length} atti per l'ultima risposta
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                Ordine per pertinenza
              </Badge>
            </div>
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.chunk_id} className="rounded-md border bg-surface p-4 transition-colors hover:border-primary/40">
                  <Link
                    to="/source/$id"
                    params={{ id: s.source_id }}
                    className="block"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="rounded-sm bg-primary text-primary-foreground">[{s.n}]</Badge>
                      <Badge variant="secondary" className="rounded-sm capitalize">
                        {s.source_type}
                      </Badge>
                      <span className="font-mono text-muted-foreground">{s.document_number}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium hover:text-primary">{s.title}</div>
                    <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">"{s.excerpt}"</p>
                  </Link>
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
                    <div className="flex items-center gap-3">
                      <Link
                        to="/source/$id"
                        params={{ id: s.source_id }}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Vai al documento
                      </Link>
                      {s.official_url && (
                        <a
                          href={s.official_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-primary"
                        >
                          INPS.it <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
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
