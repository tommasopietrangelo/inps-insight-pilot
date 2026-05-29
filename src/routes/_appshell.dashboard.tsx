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
  PenSquare,
  ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SAVED_SEARCHES, NOTES } from "@/lib/mock-data";
import { useSources, useTopics, useCorpusStats } from "@/lib/data";

export const Route = createFileRoute("/_appshell/dashboard")({
  head: () => ({ meta: [{ title: "Cruscotto · INPS Copilot" }] }),
  component: Dashboard,
});

function Dashboard() {
  const kpis = [
    { label: "Nuovi atti questa settimana", value: 12, hint: "+3 vs settimana scorsa", icon: FileText },
    { label: "Fonti salvate", value: 84, hint: "in 9 raccolte", icon: Bookmark },
    { label: "Avvisi attivi", value: 5, hint: "2 ad alta priorità", icon: Bell },
    { label: "Note interne non lette", value: 3, hint: "ultima oggi alle 09:41", icon: StickyNote },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cruscotto</p>
          <h1 className="font-display text-2xl font-semibold">Buongiorno, Giulia.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            12 nuovi atti pubblicati questa settimana · 4 riguardano i tuoi topic.
          </p>
        </div>
        <Button asChild>
          <Link to="/search">
            <Search className="mr-1.5 h-4 w-4" /> Nuova ricerca
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <k.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 font-display text-3xl font-semibold">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.hint}</div>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card className="p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Azioni rapide
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Cerca una fonte", i: Search, to: "/search" },
            { t: "Confronta due atti", i: GitCompareArrows, to: "/search" },
            { t: "Riassumi una circolare", i: FileSignature, to: "/search" },
            { t: "Crea nota interna", i: PenSquare, to: "/workspace" },
          ].map((a) => (
            <Button key={a.t} variant="outline" className="h-auto justify-start gap-3 px-4 py-3" asChild>
              <Link to={a.to}>
                <a.i className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{a.t}</span>
              </Link>
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Latest updates */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold">Ultimi aggiornamenti INPS</div>
              <p className="text-xs text-muted-foreground">Circolari e messaggi pubblicati di recente</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sources">Vedi tutti</Link>
            </Button>
          </div>
          <div className="divide-y">
            {SOURCES.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                to="/source/$id"
                params={{ id: s.id }}
                className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0 hover:bg-surface-muted/50 -mx-2 px-2 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
                    <span className="font-mono text-muted-foreground">{s.document_number}</span>
                    {s.topic_tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="outline" className="rounded-sm font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1.5 line-clamp-1 text-sm font-medium text-foreground">{s.title}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{s.summary}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.publication_date).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Trending */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">Topic in evidenza</div>
          </div>
          <div className="space-y-3">
            {TOPICS.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border bg-surface px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {t.updates_count}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Saved + notes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-base font-semibold">Ricerche salvate</div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/workspace">Workspace</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {SAVED_SEARCHES.map((s) => (
              <Link
                key={s.id}
                to="/search"
                className="flex items-center justify-between rounded-md border bg-surface px-3 py-2.5 hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">{s.query}</span>
                </div>
                <span className="text-xs text-muted-foreground">{s.results_count} risultati</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-base font-semibold">Note interne recenti</div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/workspace">Tutte</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {NOTES.map((n) => (
              <div key={n.id} className="rounded-md border bg-surface p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{n.author}</span>
                  <span>
                    {new Date(n.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium">{n.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
