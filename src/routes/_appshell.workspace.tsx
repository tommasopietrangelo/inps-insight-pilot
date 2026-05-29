import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, PenSquare, Users, Search, Plus, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SOURCES } from "@/lib/mock-data";
import { useWorkspace } from "@/hooks/use-workspace";
import { createNote, deleteNote, listNotes } from "@/lib/notes.functions";
import {
  deleteSavedSearch,
  listSavedSearches,
} from "@/lib/saved-searches.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_appshell/workspace")({
  head: () => ({ meta: [{ title: "Spazio di lavoro · INPS Copilot" }] }),
  component: Workspace,
});

function Workspace() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const listNotesFn = useServerFn(listNotes);
  const createNoteFn = useServerFn(createNote);
  const deleteNoteFn = useServerFn(deleteNote);
  const listSavedFn = useServerFn(listSavedSearches);
  const deleteSavedFn = useServerFn(deleteSavedSearch);

  const wsId = current?.id ?? "";

  const notesQuery = useQuery({
    queryKey: ["notes", wsId],
    queryFn: () => listNotesFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  const savedQuery = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () => listSavedFn({}),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createNoteFn({
        data: {
          workspaceId: wsId,
          title: title.trim(),
          body: body.trim() || undefined,
          tags: tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Nota creata");
      setOpen(false);
      setTitle("");
      setBody("");
      setTagsRaw("");
      qc.invalidateQueries({ queryKey: ["notes", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delNoteMut = useMutation({
    mutationFn: (id: string) => deleteNoteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Nota eliminata");
      qc.invalidateQueries({ queryKey: ["notes", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delSavedMut = useMutation({
    mutationFn: (id: string) => deleteSavedFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Ricerca rimossa");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notes = notesQuery.data ?? [];
  const saved = savedQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Spazio di lavoro
          </p>
          <h1 className="font-display text-2xl font-semibold">{current?.name ?? "—"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {saved.length} ricerc{saved.length === 1 ? "a salvata" : "he salvate"} · {notes.length} not{notes.length === 1 ? "a interna" : "e interne"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled>
            <Users className="h-4 w-4" /> Gestisci membri
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!wsId}>
                <Plus className="h-4 w-4" /> Nuova nota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuova nota interna</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="note-title">Titolo</Label>
                  <Input
                    id="note-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="es. Procedura interna ADI"
                  />
                </div>
                <div>
                  <Label htmlFor="note-body">Contenuto</Label>
                  <Textarea
                    id="note-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="note-tags">Tag (separati da virgola)</Label>
                  <Input
                    id="note-tags"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="adi, procedura"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!title.trim() || createMut.isPending}
                >
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salva nota
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList>
          <TabsTrigger value="notes">Note interne</TabsTrigger>
          <TabsTrigger value="searches">Ricerche salvate</TabsTrigger>
          <TabsTrigger value="favs">Fonti preferite</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <Card className="p-0">
            {notesQuery.isLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carico note…
              </div>
            ) : notes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nessuna nota ancora. Creane una con "Nuova nota".
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Fonte collegata</TableHead>
                    <TableHead className="text-right">Aggiornata</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((n) => {
                    const src = SOURCES.find((s) => s.id === n.linked_source_id);
                    return (
                      <TableRow key={n.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PenSquare className="h-3.5 w-3.5 text-primary" />
                            <div>
                              <div className="font-medium">{n.title}</div>
                              {n.body && (
                                <div className="line-clamp-1 text-xs text-muted-foreground">
                                  {n.body}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(n.tags ?? []).map((t) => (
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => delNoteMut.mutate(n.id)}
                            disabled={delNoteMut.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="searches" className="mt-4">
          <Card className="p-0">
            {savedQuery.isLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carico ricerche…
              </div>
            ) : saved.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nessuna ricerca salvata. Usa "Salva" nella pagina Ricerca.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Risultati</TableHead>
                    <TableHead className="text-right">Salvata il</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saved.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          to="/search"
                          className="flex items-center gap-2 hover:text-primary"
                        >
                          <Search className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">{s.query}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{s.results_count ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => delSavedMut.mutate(s.id)}
                          disabled={delSavedMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
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
