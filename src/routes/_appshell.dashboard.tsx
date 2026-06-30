import { Link, createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Bell,
  Bookmark,
  StickyNote,
  TrendingUp,
  Search,
  GitCompareArrows,
  FileSignature,
  FileSearch,
  PenSquare,
  ArrowUpRight,
  ClipboardCheck,
  Brain,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTopics, useCorpusStats, useLatestUpdates } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSavedSearches } from "@/lib/saved-searches.functions";
import { listNotes } from "@/lib/notes.functions";
import { listAlerts } from "@/lib/alerts.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_appshell/dashboard")({
  head: () => ({ meta: [{ title: "Cruscotto · INPS Copilot" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Utente";

  const { current } = useWorkspace();
  const wsId = current?.id ?? "";

  const listSavedFn = useServerFn(listSavedSearches);
  const listNotesFn = useServerFn(listNotes);
  const listAlertsFn = useServerFn(listAlerts);

  const savedQuery = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () => listSavedFn({}),
  });
  const notesQuery = useQuery({
    queryKey: ["notes", wsId],
    queryFn: () => listNotesFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  const alertsQuery = useQuery({
    queryKey: ["alerts", wsId],
    queryFn: () => listAlertsFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  const savedSearches = savedQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const activeAlerts = alerts.filter((a) => a.is_active);
  const highPriorityAlerts = activeAlerts.filter((a) => a.priority === "alta");

  const { data: sources = [] } = useLatestUpdates(6);
  const { data: topics = [] } = useTopics();
  const { data: stats } = useCorpusStats();

  const kpis = [
    { label: "Nuovi atti questa settimana", value: stats?.lastWeek ?? 0, hint: `${stats?.total ?? 0} atti in archivio`, icon: FileText },
    { label: "Ricerche salvate", value: savedSearches.length, hint: savedSearches.length ? "nel tuo workspace" : "nessuna ancora", icon: Bookmark },
    { label: "Avvisi attivi", value: activeAlerts.length, hint: highPriorityAlerts.length ? `${highPriorityAlerts.length} ad alta priorità` : "nessuno ad alta priorità", icon: Bell },
    { label: "Note interne", value: notes.length, hint: notes.length ? "ultima aggiornata di recente" : "nessuna ancora", icon: StickyNote },
  ];

  return (
    <div className="space-y-10">
      {/* Hero with aurora gradient — Stripe-like */}
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b bg-surface px-6 pb-10 pt-10 lg:-mx-8 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-90" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              Cruscotto
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Buongiorno, {displayName}.
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              12 nuovi atti pubblicati questa settimana · 4 riguardano i tuoi topic.
            </p>
          </div>
          <Button asChild size="lg" className="shadow-elevated">
            <Link to="/search">
              <Search className="mr-1.5 h-4 w-4" /> Nuova ricerca
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs — premium grid with elevated surface */}
      <div className="grid gap-px overflow-hidden rounded-xl border bg-border shadow-card md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="group bg-surface p-6 transition-colors hover:bg-surface-muted/40">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {k.label}
              </div>
              <k.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="mt-4 font-display text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums">
              {k.value}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{k.hint}</div>
          </div>
        ))}
      </div>


      {/* Quick actions */}
      <Card className="p-6 shadow-card">
        <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Azioni rapide
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { t: "Cerca una fonte", i: Search, to: "/search" as const },
            { t: "Crea checklist pratica", i: ClipboardCheck, to: "/checklist" as const },
            { t: "Analizza un documento", i: FileSearch, to: "/analyze" as const },
            { t: "Confronta due atti", i: GitCompareArrows, to: "/compare" as const },
            { t: "Riassumi una circolare", i: FileSignature, to: "/summarize" as const },
          ].map((a) => (
            <Button
              key={a.t}
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3 shadow-none transition-all hover:border-primary/30 hover:shadow-card"
              asChild
            >
              <Link to={a.to}>
                <a.i className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{a.t}</span>
              </Link>
            </Button>
          ))}
        </div>
      </Card>


      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latest updates — editorial cards */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Ultimi aggiornamenti INPS
              </h2>
              <p className="text-xs text-muted-foreground">
                Circolari, messaggi, normativa e notizie in ordine cronologico
              </p>
            </div>
            <Button variant="link" size="sm" className="text-primary" asChild>
              <Link to="/sources">Vedi tutti</Link>
            </Button>
          </div>

          <div className="space-y-3">
            {sources.map((s) => (
              <Link
                key={s.id}
                to="/source/$id"
                params={{ id: s.id }}
                className="group block rounded-lg border bg-surface p-5 transition-colors hover:border-primary/40"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-sm border border-primary/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                      {s.source_type}
                    </span>
                    {s.document_number && (
                      <span
                        className="text-xs tracking-tight text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        n. {s.document_number}
                      </span>
                    )}
                  </div>
                  <time className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {new Date(s.publication_date).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary">
                  {s.title}
                </h3>
                {s.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {s.summary}
                  </p>
                )}
                {s.topic_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.topic_tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Right column — auxiliary panels */}
        <div className="space-y-4">
          <Card className="p-5 shadow-none">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Topic in evidenza
              </div>
            </div>
            <div className="space-y-2">
              {topics.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.description}</div>
                  </div>
                  <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {t.updates_count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 shadow-none">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ricerche salvate
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" asChild>
                <Link to="/workspace">Workspace</Link>
              </Button>
            </div>
            <div className="space-y-2.5">
              {savedQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Carico ricerche…</div>
              ) : savedSearches.length === 0 ? (
                <Link
                  to="/search"
                  className="flex items-center justify-between rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:border-primary/40"
                >
                  <span className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-primary" />
                    Nessuna ricerca salvata.
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                savedSearches.slice(0, 5).map((s) => (
                  <Link
                    key={s.id}
                    to="/search"
                    search={{ q: s.query }}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0 hover:text-primary"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{s.query}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {s.results_count != null ? `${s.results_count}` : "—"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5 shadow-none">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Note interne recenti
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" asChild>
                <Link to="/workspace">Tutte</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {notesQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Carico note…</div>
              ) : notes.length === 0 ? (
                <Link
                  to="/workspace"
                  className="flex items-center justify-between rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:border-primary/40"
                >
                  <span className="flex items-center gap-2">
                    <PenSquare className="h-3.5 w-3.5 text-primary" />
                    Nessuna nota ancora.
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                notes.slice(0, 3).map((n) => (
                  <Link
                    key={n.id}
                    to="/workspace"
                    className="block border-l-2 border-primary/40 pl-3 hover:border-primary"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Nota interna</span>
                      <span>
                        {new Date(n.updated_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-foreground">{n.title}</div>
                    {n.body && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Memoria AI — sober institutional banner */}
      <Link
        to="/memory"
        className="group flex flex-wrap items-center justify-between gap-6 rounded-lg border border-primary/20 bg-primary p-6 text-primary-foreground transition-colors hover:border-primary/40"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-white/30 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
                <Sparkles className="mr-1 inline h-2.5 w-2.5" />
                Premium
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
                Nuovo
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-lg font-semibold tracking-tight">
              Memoria AI
            </h2>
            <p className="mt-1 max-w-xl text-sm opacity-80">
              Apprende dal lavoro del tuo studio e costruisce conoscenza nel tempo: normative,
              pratiche, casi particolari e procedure interne.
            </p>
          </div>
        </div>
        <Button variant="secondary" className="gap-1.5 shadow-none">
          Apri Memoria <ArrowUpRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

