import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain, BookOpen, FolderOpen, Lightbulb, User, Users, Search, Sparkles,
  TrendingUp, Clock, Plus, Pencil, Trash2, Share2, Lock, Loader2, ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getMemoryOverview, getMemoryNormativa, getMemoryPratiche, getMemoryStudio,
  listMemoryCases, createMemoryCase, updateMemoryCase, deleteMemoryCase,
  getOperatorPrefs, updateOperatorPrefs,
} from "@/lib/memory.functions";

export const Route = createFileRoute("/_appshell/memory")({
  head: () => ({
    meta: [
      { title: "Memoria AI · INPS Copilot" },
      { name: "description", content: "Memoria AI: l'assistente apprende da normative, pratiche e casi gestiti dal tuo studio." },
    ],
  }),
  component: MemoryPage,
});

type LevelId = "normativa" | "pratiche" | "casi" | "operatore" | "studio";

function MemoryPage() {
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";
  const [active, setActive] = useState<LevelId>("normativa");

  const overviewFn = useServerFn(getMemoryOverview);
  const overview = useQuery({
    queryKey: ["mem-overview", wsId],
    queryFn: () => overviewFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Funzione Premium</p>
              <h1 className="mt-1 font-display text-2xl font-semibold">Memoria AI</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Una memoria professionale che apprende da normative, pratiche e casi gestiti dal tuo studio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Clock className="h-3.5 w-3.5 text-primary" /> Aggiornato in tempo reale
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Elementi memorizzati", value: overview.data?.totalMemorized ?? "—", icon: Brain },
            { label: "Casi salvati", value: overview.data?.totalCases ?? "—", icon: Lightbulb },
            { label: "Pratiche tracciate", value: overview.data?.totalPractices ?? "—", icon: FolderOpen },
            { label: "Crescita 30 gg", value: overview.data ? `${overview.data.growth30d >= 0 ? "+" : ""}${overview.data.growth30d}%` : "—", icon: TrendingUp },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border bg-background/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <k.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="mt-1.5 font-display text-2xl font-semibold">{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as LevelId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-surface p-1">
          <TabsTrigger value="normativa" className="gap-2 data-[state=active]:bg-background"><BookOpen className="h-3.5 w-3.5" />Normativa</TabsTrigger>
          <TabsTrigger value="pratiche" className="gap-2 data-[state=active]:bg-background"><FolderOpen className="h-3.5 w-3.5" />Pratiche</TabsTrigger>
          <TabsTrigger value="casi" className="gap-2 data-[state=active]:bg-background"><Lightbulb className="h-3.5 w-3.5" />Casi particolari</TabsTrigger>
          <TabsTrigger value="operatore" className="gap-2 data-[state=active]:bg-background"><User className="h-3.5 w-3.5" />Operatore</TabsTrigger>
          <TabsTrigger value="studio" className="gap-2 data-[state=active]:bg-background"><Users className="h-3.5 w-3.5" />Studio</TabsTrigger>
        </TabsList>

        <TabsContent value="normativa" className="mt-5"><NormativaTab wsId={wsId} /></TabsContent>
        <TabsContent value="pratiche" className="mt-5"><PraticheTab wsId={wsId} /></TabsContent>
        <TabsContent value="casi" className="mt-5"><CasiTab wsId={wsId} /></TabsContent>
        <TabsContent value="operatore" className="mt-5"><OperatoreTab wsId={wsId} /></TabsContent>
        <TabsContent value="studio" className="mt-5"><StudioTab wsId={wsId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
function LevelHeader({ icon: Icon, title, subtitle, description, accent, highlight, stats, insight, right }: {
  icon: typeof BookOpen; title: string; subtitle: string; description: string; accent: string;
  highlight?: boolean; stats: { label: string; value: string | number }[]; insight?: string; right?: React.ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden p-5", highlight && "border-amber-500/40 ring-1 ring-amber-500/20")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br", accent)}><Icon className="h-5 w-5" /></div>
          <div>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
            <p className="mt-2 max-w-2xl text-sm">{description}</p>
          </div>
        </div>
        {right}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border bg-surface px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
      {insight && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><div className="text-[11px] font-medium uppercase tracking-wider text-primary">Insight automatico</div><div className="mt-0.5">{insight}</div></div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
function NormativaTab({ wsId }: { wsId: string }) {
  const fn = useServerFn(getMemoryNormativa);
  const q = useQuery({
    queryKey: ["mem-norm", wsId],
    queryFn: () => fn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const list = q.data?.top ?? [];
    const s = query.trim().toLowerCase();
    return s ? list.filter((i) => i.title.toLowerCase().includes(s)) : list;
  }, [q.data, query]);
  const top = q.data?.top?.[0];
  return (
    <div className="space-y-4">
      <LevelHeader
        icon={BookOpen} title="Memoria Normativa"
        subtitle="Fonti consultate automaticamente memorizzate"
        description="Traccia in automatico le fonti consultate dal tuo studio. Conteggio e ultima consultazione sono aggiornati ad ogni apertura di un atto."
        accent="from-sky-500/20 to-sky-500/5 text-sky-600"
        stats={[
          { label: "Fonti memorizzate", value: q.data?.totalSources ?? "—" },
          { label: "Consultazioni totali", value: q.data?.totalViews ?? "—" },
          { label: "Fonte più consultata", value: top?.count ?? "—" },
        ]}
        insight={top ? `Fonte più consultata: "${top.title}" (${top.count} consultazioni).` : "Consulta almeno un atto per iniziare a costruire la memoria normativa."}
      />
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-display text-sm font-semibold">Fonti memorizzate</div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca…" className="h-9 pl-8 text-sm" />
          </div>
        </div>
        {q.isLoading ? <LoadingRow /> : items.length === 0 ? <EmptyState label="Nessuna fonte consultata ancora. Apri un atto dalla sezione Fonti." /> : (
          <div className="divide-y">
            {items.map((it, i) => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{it.title}</span>
                    {i === 0 && <Badge variant="secondary" className="rounded-sm text-[10px]">Top</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {it.type}{it.documentNumber ? ` · ${it.documentNumber}` : ""} · Consultata {it.count} volte · ultima {formatWhen(it.lastViewedAt)}
                  </div>
                </div>
                <Badge variant="outline" className="rounded-sm">{it.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
function PraticheTab({ wsId }: { wsId: string }) {
  const fn = useServerFn(getMemoryPratiche);
  const q = useQuery({
    queryKey: ["mem-pratiche", wsId],
    queryFn: () => fn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  return (
    <div className="space-y-4">
      <LevelHeader
        icon={FolderOpen} title="Memoria Pratiche"
        subtitle="Categorie e strumenti più frequenti"
        description="Analizza automaticamente le pratiche create nello studio (checklist, analisi, riassunti, confronti) e ne memorizza categorie ed uso ricorrente."
        accent="from-emerald-500/20 to-emerald-500/5 text-emerald-600"
        stats={[
          { label: "Pratiche tracciate", value: q.data?.totalPractices ?? "—" },
          { label: "Categorie attive", value: q.data?.categoriesCount ?? "—" },
          { label: "Strumenti in uso", value: q.data?.byKind.length ?? "—" },
        ]}
        insight={q.data && q.data.top[0] ? `Categoria più frequente: "${q.data.top[0].title}" (${q.data.top[0].count} pratiche).` : undefined}
      />
      <Card className="p-5">
        <div className="mb-4 font-display text-sm font-semibold">Distribuzione per strumento</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(q.data?.byKind ?? []).map((k) => (
            <div key={k.kind} className="rounded-md border bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.kind}</div>
              <div className="font-display text-lg font-semibold">{k.count}</div>
            </div>
          ))}
          {q.data?.byKind.length === 0 && <EmptyState label="Nessuna pratica creata." />}
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-4 font-display text-sm font-semibold">Categorie ricorrenti</div>
        {q.isLoading ? <LoadingRow /> : q.data?.top.length === 0 ? <EmptyState label="Nessuna categoria ancora." /> : (
          <div className="divide-y">
            {(q.data?.top ?? []).map((t) => (
              <div key={t.title} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.kind} · {t.count} pratiche · ultima {formatWhen(t.lastUsed)}</div>
                </div>
                <Badge variant="outline" className="rounded-sm">{t.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
function CasiTab({ wsId }: { wsId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemoryCases);
  const createFn = useServerFn(createMemoryCase);
  const updateFn = useServerFn(updateMemoryCase);
  const deleteFn = useServerFn(deleteMemoryCase);
  const [scope, setScope] = useState<"mine" | "shared" | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["mem-cases", wsId, scope],
    queryFn: () => listFn({ data: { workspaceId: wsId, scope } }),
    enabled: !!wsId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mem-cases", wsId] });
    qc.invalidateQueries({ queryKey: ["mem-overview", wsId] });
    qc.invalidateQueries({ queryKey: ["mem-studio", wsId] });
  };

  const create = useMutation({
    mutationFn: (v: any) => createFn({ data: { workspaceId: wsId, ...v } }),
    onSuccess: () => { toast.success("Caso salvato"); invalidate(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Caso aggiornato"); invalidate(); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Caso eliminato"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleShare = useMutation({
    mutationFn: (v: { id: string; isShared: boolean }) => updateFn({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (q.data ?? []).filter((c) =>
      !s || c.title.toLowerCase().includes(s) || (c.situation || "").toLowerCase().includes(s) || (c.solution || "").toLowerCase().includes(s),
    );
  }, [q.data, query]);

  const totalReuses = (q.data ?? []).reduce((s, c) => s + (c.reuses ?? 0), 0);

  return (
    <div className="space-y-4">
      <LevelHeader
        icon={Lightbulb} title="Memoria Casi Particolari"
        subtitle="Eccezioni, interpretazioni e soluzioni operative"
        description="Conserva casi fuori standard: eccezioni normative, interpretazioni operative e problematiche risolte. Ogni caso è privato di default; puoi condividerlo con il team."
        accent="from-amber-500/20 to-amber-500/5 text-amber-600" highlight
        stats={[
          { label: "Casi memorizzati", value: q.data?.length ?? "—" },
          { label: "Condivisi con il team", value: (q.data ?? []).filter((c) => c.is_shared).length },
          { label: "Riusi totali", value: totalReuses },
        ]}
        insight={filtered[0] ? `Ultimo caso salvato: "${filtered[0].title}".` : undefined}
        right={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nuovo caso</Button></DialogTrigger>
            <CaseDialog
              editing={editing}
              onSubmit={(v) => editing ? update.mutate({ id: editing.id, ...v }) : create.mutate(v)}
              pending={create.isPending || update.isPending}
            />
          </Dialog>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>Tutti</Button>
            <Button size="sm" variant={scope === "mine" ? "default" : "outline"} onClick={() => setScope("mine")}>Miei</Button>
            <Button size="sm" variant={scope === "shared" ? "default" : "outline"} onClick={() => setScope("shared")}>Condivisi</Button>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca nei casi…" className="h-9 pl-8 text-sm" />
          </div>
        </div>
        {q.isLoading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState label='Nessun caso ancora. Clicca "Nuovo caso" per iniziare.' /> : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c.title}</span>
                      {c.category && <Badge variant="secondary" className="rounded-sm text-[10px]">{c.category}</Badge>}
                      {c.is_shared ? <Badge className="rounded-sm bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 text-[10px] gap-1"><Share2 className="h-3 w-3" />condiviso</Badge>
                        : <Badge variant="outline" className="rounded-sm text-[10px] gap-1"><Lock className="h-3 w-3" />privato</Badge>}
                      {c.reuses > 0 && <Badge variant="outline" className="rounded-sm text-[10px]">{c.reuses} riusi</Badge>}
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Situazione:</span> {c.situation}</div>
                    <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Soluzione:</span> {c.solution}</div>
                    {c.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">{c.tags.map((t: string) => <Badge key={t} variant="outline" className="rounded-sm text-[10px]">#{t}</Badge>)}</div>
                    )}
                  </div>
                  {c.isMine && (
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex items-center gap-1 pr-1 text-xs text-muted-foreground">
                        <Switch checked={c.is_shared} onCheckedChange={(v) => toggleShare.mutate({ id: c.id, isShared: v })} />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminare questo caso?")) del.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CaseDialog({ editing, onSubmit, pending }: { editing: any | null; onSubmit: (v: any) => void; pending: boolean }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [situation, setSituation] = useState(editing?.situation ?? "");
  const [solution, setSolution] = useState(editing?.solution ?? "");
  const [tagsStr, setTagsStr] = useState((editing?.tags ?? []).join(", "));
  const [isShared, setIsShared] = useState(editing?.is_shared ?? false);
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Modifica caso" : "Nuovo caso particolare"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Titolo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Assegno Unico con figli all'estero UE" /></div>
        <div><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Es. Assegno Unico, ADI, NASpI…" /></div>
        <div><Label>Situazione</Label><Textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={3} placeholder="Descrivi il caso, l'eccezione o il dubbio operativo" /></div>
        <div><Label>Soluzione</Label><Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} placeholder="Come è stato risolto, riferimento normativo, esito" /></div>
        <div><Label>Tag (separati da virgola)</Label><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="ISEE, dimissioni, reddito estero" /></div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Condividi con lo studio</div>
            <div className="text-xs text-muted-foreground">Reso visibile nella Memoria Collettiva del workspace</div>
          </div>
          <Switch checked={isShared} onCheckedChange={setIsShared} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim() || !situation.trim() || !solution.trim()}
          onClick={() => onSubmit({
            title: title.trim(),
            category: category.trim() || null,
            situation: situation.trim(),
            solution: solution.trim(),
            tags: tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean),
            isShared,
          })}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Salva modifiche" : "Salva caso"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================
function OperatoreTab({ wsId }: { wsId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOperatorPrefs);
  const updateFn = useServerFn(updateOperatorPrefs);
  const q = useQuery({
    queryKey: ["mem-op", wsId],
    queryFn: () => getFn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  const [style, setStyle] = useState<string>("sintetico");
  const [detail, setDetail] = useState<string>("medio");
  const [sources, setSources] = useState("");
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");

  const loaded = q.data;
  useMemo(() => {
    if (loaded) {
      setStyle(loaded.response_style);
      setDetail(loaded.detail_level);
      setSources((loaded.preferred_sources ?? []).join(", "));
      setTopics((loaded.preferred_topics ?? []).join(", "));
      setNotes(loaded.notes ?? "");
    }
  }, [loaded]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: {
      workspaceId: wsId,
      responseStyle: style as any,
      detailLevel: detail as any,
      preferredSources: sources.split(",").map((s) => s.trim()).filter(Boolean),
      preferredTopics: topics.split(",").map((s) => s.trim()).filter(Boolean),
      notes: notes.trim() || null,
    } }),
    onSuccess: () => { toast.success("Preferenze salvate"); qc.invalidateQueries({ queryKey: ["mem-op", wsId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <LevelHeader
        icon={User} title="Memoria Operatore"
        subtitle="Profilo personale dell'utente"
        description="Personalizza l'assistente in base alle tue abitudini di lavoro: stile di risposta, livello di dettaglio, fonti e argomenti preferiti."
        accent="from-violet-500/20 to-violet-500/5 text-violet-600"
        stats={[
          { label: "Stile risposta", value: loaded?.response_style ?? "—" },
          { label: "Livello dettaglio", value: loaded?.detail_level ?? "—" },
          { label: "Argomenti preferiti", value: (loaded?.preferred_topics ?? []).length },
        ]}
      />
      <Card className="p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Stile di risposta</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sintetico">Sintetico</SelectItem>
                <SelectItem value="esteso">Esteso</SelectItem>
                <SelectItem value="bullet">Bullet point</SelectItem>
                <SelectItem value="narrativo">Narrativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Livello di dettaglio</Label>
            <Select value={detail} onValueChange={setDetail}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basso">Basso — essenziale</SelectItem>
                <SelectItem value="medio">Medio — requisiti e scadenze</SelectItem>
                <SelectItem value="alto">Alto — analisi normativa completa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Fonti preferite (virgola)</Label>
          <Input value={sources} onChange={(e) => setSources(e.target.value)} placeholder="Circolari INPS, Messaggi, FAQ ufficiali" />
        </div>
        <div>
          <Label>Argomenti più frequenti (virgola)</Label>
          <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Assegno Unico, ADI, NASpI, Pensioni" />
        </div>
        <div>
          <Label>Note personali per l'assistente</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Es. cita sempre l'articolo di legge; prediligi tabelle riassuntive; scrivi in italiano formale…" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva preferenze
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
function StudioTab({ wsId }: { wsId: string }) {
  const fn = useServerFn(getMemoryStudio);
  const q = useQuery({
    queryKey: ["mem-studio", wsId],
    queryFn: () => fn({ data: { workspaceId: wsId } }),
    enabled: !!wsId,
  });
  return (
    <div className="space-y-4">
      <LevelHeader
        icon={Users} title="Memoria Collettiva Studio"
        subtitle="Conoscenza condivisa dell'intero team"
        description="I casi che gli operatori decidono di condividere diventano una base di conoscenza dello studio, accessibile a tutti i membri del workspace."
        accent="from-rose-500/20 to-rose-500/5 text-rose-600"
        stats={[
          { label: "Membri workspace", value: q.data?.teamSize ?? "—" },
          { label: "Contributori", value: q.data?.contributors ?? "—" },
          { label: "Casi condivisi", value: q.data?.sharedCount ?? "—" },
        ]}
        insight={q.data && q.data.sharedCount > 0 ? `Il team ha condiviso ${q.data.sharedCount} casi con ${q.data.totalReuses} riusi complessivi.` : "Nessun caso ancora condiviso. Attiva la condivisione dai tuoi casi particolari."}
      />
      <Card className="p-5">
        <div className="mb-4 font-display text-sm font-semibold">Best practice condivise</div>
        {q.isLoading ? <LoadingRow /> : q.data?.cases.length === 0 ? <EmptyState label="Nessun caso condiviso ancora." /> : (
          <div className="space-y-3">
            {(q.data?.cases ?? []).map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{c.title}</span>
                  {c.category && <Badge variant="secondary" className="rounded-sm text-[10px]">{c.category}</Badge>}
                  <Badge variant="outline" className="rounded-sm text-[10px]">autore: {c.authorName}</Badge>
                  {c.reuses > 0 && <Badge variant="outline" className="rounded-sm text-[10px]">{c.reuses} riusi</Badge>}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Situazione:</span> {c.situation}</div>
                <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Soluzione:</span> {c.solution}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
function LoadingRow() {
  return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Caricamento…</div>;
}
function EmptyState({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>;
}
function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day) return "oggi";
  if (diff < 2 * day) return "ieri";
  if (diff < 30 * day) return `${Math.floor(diff / day)} giorni fa`;
  return d.toLocaleDateString("it-IT");
}
