import { Link, createFileRoute } from "@tanstack/react-router";
import { Bookmark, PenSquare, Users, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NOTES, SAVED_SEARCHES, SOURCES } from "@/lib/mock-data";

export const Route = createFileRoute("/_appshell/workspace")({
  head: () => ({ meta: [{ title: "Spazio di lavoro · INPS Copilot" }] }),
  component: Workspace,
});

const MEMBERS = [
  { name: "Giulia Rossi", role: "Admin", initials: "GR" },
  { name: "Marco De Luca", role: "Operatore", initials: "MD" },
  { name: "Sara Bianchi", role: "Operatore", initials: "SB" },
  { name: "Luca Verdi", role: "Sola lettura", initials: "LV" },
];

function Workspace() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Spazio di lavoro
          </p>
          <h1 className="font-display text-2xl font-semibold">Studio Rossi · CAF</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            4 membri · 8 ricerche salvate · 12 note interne · 18 fonti preferite
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="h-4 w-4" /> Gestisci membri
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuova nota
          </Button>
        </div>
      </div>

      {/* members strip */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex -space-x-2">
          {MEMBERS.map((m) => (
            <div
              key={m.name}
              title={`${m.name} · ${m.role}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-xs font-medium text-primary-foreground"
            >
              {m.initials}
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Workspace privato · accessibile solo ai membri dello studio
        </div>
      </Card>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList>
          <TabsTrigger value="notes">Note interne</TabsTrigger>
          <TabsTrigger value="searches">Ricerche salvate</TabsTrigger>
          <TabsTrigger value="memos">Memo condivisi</TabsTrigger>
          <TabsTrigger value="favs">Fonti preferite</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Autore</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Fonte collegata</TableHead>
                  <TableHead className="text-right">Aggiornata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NOTES.map((n) => {
                  const src = SOURCES.find((s) => s.id === n.linked_source);
                  return (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PenSquare className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">{n.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{n.author}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {n.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="rounded-sm text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {src ? (
                          <Link
                            to="/source/$id"
                            params={{ id: src.id }}
                            className="text-sm text-primary hover:underline"
                          >
                            {src.document_number}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(n.updated_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="searches" className="mt-4">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Risultati</TableHead>
                  <TableHead className="text-right">Salvata il</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAVED_SEARCHES.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{s.query}</span>
                      </div>
                    </TableCell>
                    <TableCell>{s.results_count}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="memos" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                t: "Procedura interna ADI – aggiornata 22 mag",
                a: "Giulia Rossi",
                b: "Sequenza completa di verifica DSU, sottoscrizione PAD e archiviazione pratica.",
              },
              {
                t: "Modello comunicazione utente NASpI",
                a: "Marco De Luca",
                b: "Template email per informare il beneficiario della soglia 5.000 € su prestazioni occasionali.",
              },
            ].map((m) => (
              <Card key={m.t} className="p-5">
                <div className="text-xs text-muted-foreground">{m.a}</div>
                <div className="mt-1 font-display text-base font-semibold">{m.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{m.b}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="favs" className="mt-4">
          <Card className="divide-y p-0">
            {SOURCES.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to="/source/$id"
                params={{ id: s.id }}
                className="flex items-start gap-3 px-5 py-4 hover:bg-surface-muted/50"
              >
                <Bookmark className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
                    <span className="font-mono text-muted-foreground">{s.document_number}</span>
                  </div>
                  <div className="mt-1 font-medium">{s.title}</div>
                </div>
              </Link>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
