import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  GitCompareArrows,
  ExternalLink,
  CalendarDays,
  Hash,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { getSource, SOURCES, NOTES } from "@/lib/mock-data";

export const Route = createFileRoute("/_appshell/source/$id")({
  head: ({ params }) => {
    const s = getSource(params.id);
    return { meta: [{ title: s ? `${s.document_number} · INPS Copilot` : "Fonte · INPS Copilot" }] };
  },
  component: SourceDetail,
});

function SourceDetail() {
  const { id } = Route.useParams();
  const src = getSource(id) ?? SOURCES[0];
  const related = SOURCES.filter((s) => src.related_documents.includes(s.id) || (s.id !== src.id && s.topic_tags.some((t) => src.topic_tags.includes(t)))).slice(0, 4);
  const noteForSource = NOTES.find((n) => n.linked_source === src.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Torna al cruscotto
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <GitCompareArrows className="h-3.5 w-3.5" /> Confronta con altro atto
          </Button>
          <Button size="sm" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" /> Salva nel workspace
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-primary text-primary-foreground rounded-sm">{src.source_type}</Badge>
              <span className="font-mono text-muted-foreground">{src.document_number}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {new Date(src.publication_date).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold leading-snug">{src.title}</h1>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {src.topic_tags.map((t) => (
                <Badge key={t} variant="secondary" className="rounded-sm font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            <Separator className="my-5" />
            <p className="text-base leading-relaxed text-foreground/90">{src.summary}</p>
          </Card>

          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="ai">Sintesi AI</TabsTrigger>
              <TabsTrigger value="text">Testo integrale</TabsTrigger>
              <TabsTrigger value="deadlines">Scadenze chiave</TabsTrigger>
              <TabsTrigger value="related">Atti collegati</TabsTrigger>
              <TabsTrigger value="notes">Note interne</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <Card className="space-y-4 p-6 text-sm leading-relaxed">
                <Section title="Cosa cambia">
                  <p>{src.summary}</p>
                </Section>
                <Section title="Chi è coinvolto">
                  <p>
                    Operatori CAF e patronato che gestiscono pratiche relative ai topic:{" "}
                    {src.topic_tags.join(", ")}.
                  </p>
                </Section>
                <Section title="Come applicarlo">
                  <ul className="space-y-1.5">
                    <li>1. Verifica la posizione del beneficiario nei sistemi INPS.</li>
                    <li>2. Aggiorna eventuali DSU o moduli interni.</li>
                    <li>3. Comunica la modifica al beneficiario tramite il canale previsto.</li>
                  </ul>
                </Section>
              </Card>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <Card className="p-6">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {src.full_text}
                </pre>
              </Card>
            </TabsContent>

            <TabsContent value="deadlines" className="mt-4">
              <Card className="p-6">
                <div className="space-y-3 text-sm">
                  {[
                    { d: "01/06/2026", t: "Entrata in vigore nuovi requisiti reddituali" },
                    { d: "30/09/2026", t: "Termine rinnovo PAD per nuclei già percettori" },
                    { d: "31/12/2026", t: "Conclusione fase transitoria" },
                  ].map((x) => (
                    <div key={x.d} className="flex items-center gap-3 rounded-md border bg-surface p-3">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="font-mono text-xs text-muted-foreground">{x.d}</span>
                      <span className="text-foreground">{x.t}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="related" className="mt-4">
              <Card className="p-6">
                <div className="divide-y">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      to="/source/$id"
                      params={{ id: r.id }}
                      className="block py-3 first:pt-0 last:pb-0 hover:bg-surface-muted/50 -mx-2 px-2 rounded-md"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" className="rounded-sm">{r.source_type}</Badge>
                        <span className="font-mono text-muted-foreground">{r.document_number}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium">{r.title}</div>
                    </Link>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card className="p-6">
                {noteForSource ? (
                  <div className="rounded-md border bg-surface p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{noteForSource.author}</span>
                      <span>aggiornata il {noteForSource.updated_at}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium">{noteForSource.title}</div>
                    <p className="mt-2 text-sm text-foreground/90">{noteForSource.body}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nessuna nota interna collegata a questo atto. Crea una nota nello{" "}
                    <Link to="/workspace" className="text-primary underline">spazio di lavoro</Link>.
                  </p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metadati
            </div>
            <div className="space-y-3 text-sm">
              <Meta icon={Hash} label="Numero">
                <span className="font-mono">{src.document_number}</span>
              </Meta>
              <Meta icon={CalendarDays} label="Pubblicazione">
                {new Date(src.publication_date).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Meta>
              <Meta icon={Tag} label="Tipo">
                {src.source_type}
              </Meta>
              <Meta icon={Tag} label="Topic">
                {src.topic_tags.join(", ")}
              </Meta>
            </div>
            <Separator className="my-4" />
            <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
              <a href={src.official_url} target="_blank" rel="noreferrer">
                Apri su INPS.it <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Atti correlati
            </div>
            <div className="space-y-2">
              {related.slice(0, 3).map((r) => (
                <Link
                  key={r.id}
                  to="/source/$id"
                  params={{ id: r.id }}
                  className="block rounded-md border bg-surface p-3 hover:border-primary/40"
                >
                  <div className="text-xs text-muted-foreground">{r.document_number}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm font-medium">{r.title}</div>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">{title}</div>
      {children}
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Hash;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
