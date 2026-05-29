import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSources } from "@/lib/data";

export const Route = createFileRoute("/_appshell/sources")({
  head: () => ({ meta: [{ title: "Fonti · INPS Copilot" }] }),
  component: SourcesPage,
});

function SourcesPage() {
  const { data: sources, isLoading, error } = useSources();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fonti</p>
        <h1 className="font-display text-2xl font-semibold">Archivio circolari, messaggi e normativa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sources?.length ?? 0} atti ufficiali indicizzati · aggiornato il{" "}
          {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}.
        </p>
      </div>

      {isLoading && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento corpus…
        </Card>
      )}
      {error && (
        <Card className="p-6 text-sm text-destructive">Errore nel caricamento delle fonti.</Card>
      )}

      {sources && sources.length > 0 && (
        <Card className="divide-y p-0">
          {sources.map((s) => (
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
      )}
    </div>
  );
}
