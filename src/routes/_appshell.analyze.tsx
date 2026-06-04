import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSearch,
  FileUp,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  analyzeDocument,
  chatAboutDocument,
  type AnalysisResult,
  type ChatMessage,
} from "@/lib/analyze.functions";
import { extractTextFromFile, downloadAsPdf, downloadAsDocx } from "@/lib/doc-io";
import { SavePracticeButton } from "@/components/save-practice-button";
import type { AnalysisResult as AnalysisResultT } from "@/lib/analyze.functions";

export const Route = createFileRoute("/_appshell/analyze")({
  head: () => ({ meta: [{ title: "Analizza un documento · INPS Copilot" }] }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const [fileName, setFileName] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");

  const callAnalyze = useServerFn(analyzeDocument);
  const analyze = useMutation({
    mutationFn: (input: { text: string; title?: string }) => callAnalyze({ data: input }),
    onSuccess: (res) => setEditedText(res.correctedText),
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setExtractError("");
    setExtracting(true);
    setFileName(file.name);
    try {
      const txt = await extractTextFromFile(file);
      setDocText(txt);
      setEditedText(txt);
    } catch (e) {
      setExtractError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const runAnalyze = () => {
    if (docText.trim().length < 50) return;
    analyze.mutate({ text: docText, title: fileName });
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Cruscotto
        </Link>
      </Button>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Azione rapida</p>
        <h1 className="font-display text-2xl font-semibold">Analizza un documento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carica un PDF o DOCX su temi INPS. Lo confrontiamo con il corpus, evidenziamo errori,
          ti proponiamo correzioni e puoi fare domande riferite solo a questo documento.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-primary" />
          <div className="font-display text-base font-semibold">1 · Carica il documento</div>
        </div>
        <Separator className="my-3" />
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              File (.pdf, .docx, .txt)
            </label>
            <Input
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            onClick={runAnalyze}
            disabled={docText.trim().length < 50 || analyze.isPending || extracting}
            className="gap-1.5"
          >
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analizza con il corpus
          </Button>
        </div>
        {extracting && (
          <p className="mt-2 text-xs text-muted-foreground">Estrazione testo in corso…</p>
        )}
        {extractError && <p className="mt-2 text-xs text-destructive">{extractError}</p>}
        {fileName && !extracting && (
          <p className="mt-2 text-xs text-muted-foreground">
            File: <span className="font-medium text-foreground">{fileName}</span> · {docText.length} caratteri
          </p>
        )}
      </Card>

      {analyze.error && (
        <Card className="p-4 text-sm text-destructive">
          Errore: {(analyze.error as Error).message}
        </Card>
      )}

      {(docText || analyze.data) && (
        <Tabs defaultValue={analyze.data ? "review" : "edit"}>
          <TabsList>
            <TabsTrigger value="review" className="gap-1.5" disabled={!analyze.data}>
              <FileSearch className="h-3.5 w-3.5" /> Revisione
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Correggi & scarica
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Domande sul documento
            </TabsTrigger>
          </TabsList>

          {analyze.data && (
            <TabsContent value="review" className="mt-4">
              <ReviewPanel result={analyze.data} />
            </TabsContent>
          )}

          <TabsContent value="edit" className="mt-4 space-y-3">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-base font-semibold">Versione corretta</div>
                  <p className="text-xs text-muted-foreground">
                    Modifica liberamente il testo prima di scaricarlo.
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={!editedText.trim()} className="gap-1.5">
                      <Download className="h-4 w-4" /> Scarica
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        downloadAsPdf(editedText, baseName(fileName) + "-corretto")
                      }
                    >
                      PDF (.pdf)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadAsDocx(editedText, baseName(fileName) + "-corretto")
                      }
                    >
                      Word (.docx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Separator className="my-3" />
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="min-h-[420px] font-mono text-xs"
              />
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <DocChat documentText={docText} documentTitle={fileName} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function baseName(name: string) {
  if (!name) return "documento";
  return name.replace(/\.[^.]+$/, "");
}

function ReviewPanel({ result }: { result: AnalysisResult }) {
  const sevColor: Record<string, string> = {
    alta: "bg-destructive/10 text-destructive border-destructive/30",
    media: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    bassa: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="font-display text-base font-semibold">Sintesi della revisione</div>
          <Badge variant="secondary" className="rounded-full">
            Punteggio {result.overallScore}/100
          </Badge>
        </div>
        <p className="mt-2 rounded-md border bg-surface-muted/40 p-3 text-sm leading-relaxed">
          {result.summary || "Nessuna sintesi disponibile."}
        </p>

        <Separator className="my-4" />

        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {result.issues.length} problemi rilevati
        </div>
        {result.issues.length === 0 ? (
          <div className="rounded-md border bg-surface p-4 text-sm text-muted-foreground">
            Nessun problema rilevato rispetto al corpus.
          </div>
        ) : (
          <ul className="space-y-3">
            {result.issues.map((it, i) => (
              <li key={i} className="rounded-md border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`rounded-sm ${sevColor[it.severity] ?? ""}`}>
                    <TriangleAlert className="mr-1 h-3 w-3" />
                    {it.severity}
                  </Badge>
                  <Badge variant="secondary" className="rounded-sm">{it.category}</Badge>
                </div>
                {it.excerpt && (
                  <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
                    «{it.excerpt}»
                  </blockquote>
                )}
                <p className="mt-2 text-sm"><span className="font-medium">Problema: </span>{it.problem}</p>
                <p className="mt-1 text-sm"><span className="font-medium text-emerald-700">Correzione: </span>{it.suggestion}</p>
                {it.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {it.citations.map((c, j) =>
                      c.sourceId ? (
                        <Link
                          key={j}
                          to="/source/$id"
                          params={{ id: c.sourceId }}
                          className="inline-flex items-center rounded-full border bg-primary/5 px-2 py-0.5 text-[11px] hover:bg-primary/10"
                        >
                          {c.label || "Fonte"}
                        </Link>
                      ) : (
                        <span key={j} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {c.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="font-display text-base font-semibold">Fonti usate</div>
        <p className="text-xs text-muted-foreground">Atti del corpus rilevanti per il documento.</p>
        <Separator className="my-3" />
        {result.usedSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna fonte associata.</p>
        ) : (
          <ul className="space-y-2">
            {result.usedSources.map((s) => (
              <li key={s.id}>
                <Link
                  to="/source/$id"
                  params={{ id: s.id }}
                  className="block rounded-md border bg-surface p-2.5 text-sm hover:border-primary/40"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
                    <span className="font-mono">{s.document_number}</span>
                    <span>{s.publication_date}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 font-medium">{s.title}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DocChat({ documentText, documentTitle }: { documentText: string; documentTitle: string }) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const callChat = useServerFn(chatAboutDocument);
  const ask = useMutation({
    mutationFn: (q: string) =>
      callChat({ data: { documentText, documentTitle, history, question: q } }),
  });

  const send = () => {
    const q = input.trim();
    if (!q || ask.isPending) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", content: q }]);
    ask.mutate(q, {
      onSuccess: (res) =>
        setHistory((h) => [...h, { role: "assistant", content: res.answer }]),
      onError: (err) =>
        setHistory((h) => [
          ...h,
          { role: "assistant", content: `Errore: ${(err as Error).message}` },
        ]),
    });
  };

  return (
    <Card className="flex h-[560px] flex-col p-0">
      <div className="border-b p-4">
        <div className="font-display text-base font-semibold">Chiedi al documento</div>
        <p className="text-xs text-muted-foreground">
          Le risposte si basano solo sul testo caricato, non sul corpus.
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {history.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esempi: «Quali scadenze sono indicate?», «Riassumi gli obblighi del beneficiario».
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-md border p-3 text-sm ${
              m.role === "user"
                ? "ml-auto bg-primary/5"
                : "bg-surface"
            }`}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {m.role === "user" ? "Tu" : "Assistente"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {ask.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Sto rispondendo…
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Fai una domanda sul documento…"
          />
          <Button onClick={send} disabled={!input.trim() || ask.isPending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
