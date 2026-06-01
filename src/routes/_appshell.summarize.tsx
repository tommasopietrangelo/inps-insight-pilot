import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  FileUp,
  ListChecks,
  Loader2,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSources } from "@/lib/data";
import { summarizeSource, type SummaryResult } from "@/lib/summarize.functions";

const SearchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/_appshell/summarize")({
  head: () => ({ meta: [{ title: "Riassumi un atto · INPS Copilot" }] }),
  validateSearch: SearchSchema,
  component: SummarizePage,
});

function SummarizePage() {
  const { id } = Route.useSearch();
  const { data: sources = [], isLoading } = useSources();
  const initial = useMemo(() => sources.find((s) => s.id === id), [sources, id]);

  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const [uploadName, setUploadName] = useState<string>("");
  const [uploadText, setUploadText] = useState<string>("");
  const [tab, setTab] = useState<"corpus" | "upload">(id ? "corpus" : "corpus");

  const selected = sources.find((s) => s.id === (selectedId ?? id)) ?? initial;
  const callSummarize = useServerFn(summarizeSource);

  const mutation = useMutation({
    mutationFn: (input: { sourceId?: string; rawText?: string; title?: string }) =>
      callSummarize({ data: input }),
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setUploadName(file.name);
    const isText = file.type.startsWith("text/") || /\.(txt|md|csv|json|html|xml)$/i.test(file.name);
    if (!isText) {
      setUploadText(
        `[Documento "${file.name}" caricato — formato binario]\nPer riassumerlo automaticamente incolla qui sotto il testo estratto dal PDF/DOCX (es. con copia-incolla dal documento aperto).`,
      );
      return;
    }
    const txt = await file.text();
    setUploadText(txt);
  };

  const runCorpus = () => {
    if (!selected) return;
    mutation.mutate({ sourceId: selected.uuid });
  };
  const runUpload = () => {
    if (uploadText.trim().length < 50) return;
    mutation.mutate({ rawText: uploadText, title: uploadName || "Documento caricato" });
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Cruscotto</Link>
      </Button>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Azione rapida</p>
        <h1 className="font-display text-2xl font-semibold">Riassumi un atto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scegli un atto dal corpus oppure carica un documento. Ottieni TL;DR, obblighi, scadenze e note operative.
        </p>
      </div>

      <Card className="p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "corpus" | "upload")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="corpus" className="gap-1.5">
              <FileSignature className="h-3.5 w-3.5" /> Dal corpus
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" /> Carica documento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="corpus" className="mt-4 space-y-3">
            <Select
              value={selectedId ?? id}
              onValueChange={(v) => setSelectedId(v)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Caricamento…" : "Scegli un atto del corpus…"} />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.publication_date.slice(0, 10)}
                    </span>{" "}
                    · {s.source_type} {s.document_number} — {s.title.slice(0, 70)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="rounded-md border bg-surface-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="rounded-sm">{selected.source_type}</Badge>
                  <span className="font-mono text-muted-foreground">{selected.document_number}</span>
                  <span className="text-muted-foreground">{selected.publication_date}</span>
                </div>
                <div className="mt-1 font-medium">{selected.title}</div>
              </div>
            )}
            <Button onClick={runCorpus} disabled={!selected || mutation.isPending} className="gap-1.5">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Genera riassunto
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                File (.txt, .md) oppure incolla il testo qui sotto
              </label>
              <Input
                type="file"
                accept=".txt,.md,.csv,.json,.html,.xml,text/*,application/pdf,.pdf,.docx"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              {uploadName && (
                <p className="text-xs text-muted-foreground">File: {uploadName}</p>
              )}
            </div>
            <Textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder="Incolla qui il testo della circolare, del messaggio o della normativa (minimo 50 caratteri)…"
              className="min-h-[220px] font-mono text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{uploadText.length} caratteri</span>
              <Button
                onClick={runUpload}
                disabled={uploadText.trim().length < 50 || mutation.isPending}
                className="gap-1.5"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Genera riassunto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Suggerimento: per PDF/DOCX apri il documento, seleziona tutto il testo e incollalo qui.
            </p>
          </TabsContent>
        </Tabs>
      </Card>

      {mutation.error && (
        <Card className="p-4 text-sm text-destructive">
          Errore: {(mutation.error as Error).message}
        </Card>
      )}

      {mutation.data && <SummaryPanel data={mutation.data} />}
    </div>
  );
}

function SummaryPanel({ data }: { data: SummaryResult }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{data.title}</h2>
      </div>
      <Separator className="my-3" />
      {data.tldr && (
        <p className="rounded-md border bg-surface-muted/40 p-3 text-sm leading-relaxed">{data.tldr}</p>
      )}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Section icon={<ListChecks className="h-4 w-4 text-primary" />} title="Punti chiave" items={data.keyPoints} />
        <Section icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title="Obblighi / adempimenti" items={data.obligations} />
        <Section icon={<CalendarClock className="h-4 w-4 text-amber-600" />} title="Scadenze" items={data.deadlines} />
        <Section icon={<Users className="h-4 w-4 text-primary" />} title="Destinatari" items={data.whoIsAffected} />
        <Section icon={<Wrench className="h-4 w-4 text-primary" />} title="Note operative" items={data.operationalNotes} />
      </div>
    </Card>
  );
}

function Section({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="rounded-md border bg-surface p-2.5 text-sm leading-relaxed">{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Avoid unused-import warning if XCircle not used elsewhere
