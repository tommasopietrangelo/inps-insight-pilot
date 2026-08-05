import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Loader2,
  Sparkles,
  PanelRightOpen,
  PictureInPicture2,
  ShieldCheck,
  FileText,
  ListChecks,
  BookOpenCheck,
  GripVertical,
  Info,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { groundedSearch } from "@/lib/search.functions";
import { createMemoryCase } from "@/lib/memory.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Msg = {
  id: string;
  role: Role;
  content: string;
  sources?: { n: number; title: string | null; source_type: string | null; document_number: string | null }[];
  ts: number;
};

type Mode = "docked" | "floating";
type Pos = { x: number; y: number } | null;

const STORAGE_KEY = "copilot-floating-state-v2";

type Persisted = {
  open: boolean;
  minimized: boolean;
  mode: Mode;
  messages: Msg[];
  pos: Pos;
};

function loadState(): Persisted {
  if (typeof window === "undefined") {
    return { open: false, minimized: false, mode: "floating", messages: [], pos: null };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* ignore */
  }
  return { open: false, minimized: false, mode: "floating", messages: [], pos: null };
}

const QUICK_ACTIONS: { label: string; icon: typeof FileText; prompt: string }[] = [
  { label: "Riassumi questa pagina", icon: BookOpenCheck, prompt: "Riassumi i contenuti rilevanti della sezione che sto consultando." },
  { label: "Trova fonti correlate", icon: FileText, prompt: "Trova circolari e messaggi INPS correlati al tema corrente." },
  { label: "Crea reminder per punti", icon: ListChecks, prompt: "Trasforma la risposta in un reminder operativo per punti, sintetico e utile per l'operatore." },
];

const PANEL_W = 380;
const PANEL_H = 560;

export function FloatingCopilot() {
  const isMobile = useIsMobile();
  const initial = useRef<Persisted>(loadState());
  const [open, setOpen] = useState(initial.current.open);
  const [minimized, setMinimized] = useState(initial.current.minimized);
  const [mode, setMode] = useState<Mode>(initial.current.mode);
  const [messages, setMessages] = useState<Msg[]>(initial.current.messages);
  const [pos, setPos] = useState<Pos>(initial.current.pos);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saveFor, setSaveFor] = useState<{ msg: Msg; question: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const { current } = useWorkspace();
  const wsId = current?.id ?? "";

  const createCaseFn = useServerFn(createMemoryCase);
  const saveCaseMut = useMutation({
    mutationFn: (v: {
      title: string; situation: string; solution: string; category: string | null; tags: string[]; isShared: boolean; sourceContext: Record<string, unknown>;
    }) => createCaseFn({ data: { workspaceId: wsId, origin: "chat", ...v } }),
    onSuccess: () => { toast.success("Caso salvato in Memoria AI"); setSaveFor(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runSearch = useServerFn(groundedSearch);
  const mutation = useMutation({
    mutationFn: (query: string) => runSearch({ data: { query } }),
    onSuccess: (data) => {
      const msg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources.map((s) => ({
          n: s.n,
          title: s.title,
          source_type: s.source_type,
          document_number: s.document_number,
        })),
        ts: Date.now(),
      };
      setMessages((m) => [...m, msg]);
      if (minimized || !open) setUnread((u) => u + 1);
    },
    onError: (err: Error) => {
      const msg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Errore: ${err.message}`,
        ts: Date.now(),
      };
      setMessages((m) => [...m, msg]);
    },
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ open, minimized, mode, messages, pos } satisfies Persisted),
      );
    } catch {
      /* ignore */
    }
  }, [open, minimized, mode, messages, pos]);

  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mutation.isPending, open, minimized]);

  // Drag handlers
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!dragOffset.current) return;
      const w = PANEL_W;
      const h = PANEL_H;
      const maxX = window.innerWidth - w - 4;
      const maxY = window.innerHeight - h - 4;
      const x = Math.min(Math.max(4, e.clientX - dragOffset.current.dx), Math.max(4, maxX));
      const y = Math.min(Math.max(4, e.clientY - dragOffset.current.dy), Math.max(4, maxY));
      setPos({ x, y });
    };
    const onUp = () => {
      setDragging(false);
      dragOffset.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const startDrag = (e: React.PointerEvent) => {
    if (isMobile || mode !== "floating") return;
    const rect = (e.currentTarget as HTMLElement).closest("[data-copilot-panel]")?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
  };

  const send = (text: string) => {
    const q = text.trim();
    if (q.length < 2 || mutation.isPending) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q, ts: Date.now() }]);
    setInput("");
    mutation.mutate(q);
  };

  // ---------- Launcher ----------
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        aria-label="Apri Copilot"
        className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground shadow-lg backdrop-blur-xl transition hover:bg-background/80 hover:shadow-xl"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageSquare className="h-4 w-4" />
        </span>
        Apri Copilot
        {messages.length > 0 && unread > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    );
  }

  // ---------- Minimized pill ----------
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => {
          setMinimized(false);
          setUnread(0);
        }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3.5 py-2 text-sm shadow-lg backdrop-blur-xl hover:bg-background/80"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium">Copilot</span>
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    );
  }

  // ---------- Panel ----------
  const isFreelyPositioned = !isMobile && mode === "floating" && pos !== null;

  const panelClass = isMobile
    ? "fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-xl border-t"
    : mode === "docked"
      ? "fixed right-4 bottom-4 top-20 z-50 w-[400px] rounded-xl border"
      : isFreelyPositioned
        ? "fixed z-50 rounded-xl border"
        : "fixed bottom-5 right-5 z-50 rounded-xl border";

  const inlineStyle: React.CSSProperties = isFreelyPositioned
    ? { left: pos!.x, top: pos!.y, width: PANEL_W, height: PANEL_H }
    : !isMobile && mode === "floating"
      ? { width: PANEL_W, height: PANEL_H }
      : {};

  return (
    <div
      data-copilot-panel
      style={inlineStyle}
      className={cn(
        panelClass,
        "flex flex-col bg-background/55 shadow-2xl backdrop-blur-2xl border-border/50 ring-1 ring-white/10",
        dragging && "select-none cursor-grabbing",
      )}
      role="dialog"
      aria-label="Copilot"
    >
      {/* Header (drag handle in floating mode) */}
      <div
        onPointerDown={mode === "floating" && !isMobile ? startDrag : undefined}
        className={cn(
          "flex items-center gap-2 border-b border-border/40 px-3 py-2.5",
          mode === "floating" && !isMobile && "cursor-grab active:cursor-grabbing",
        )}
      >
        {mode === "floating" && !isMobile && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">Copilot</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Servizio informativo indipendente
          </div>
        </div>
        {!isMobile && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setMode((m) => (m === "docked" ? "floating" : "docked"));
              if (mode === "floating") setPos(null);
            }}
            title={mode === "docked" ? "Finestra libera" : "Aggancia a destra"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            {mode === "docked" ? <PictureInPicture2 className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMinimized(true)}
          title="Riduci"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(false)}
          title="Chiudi"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 border-b border-border/40 bg-amber-500/10 px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
          Servizio informativo indipendente: le risposte non hanno valore ufficiale e non sostituiscono i canali INPS.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !mutation.isPending && (
          <EmptyState onPick={send} />
        )}
        <div className="space-y-3">
          {messages.map((m, i) => {
            const prevUser = m.role === "assistant"
              ? [...messages.slice(0, i)].reverse().find((x) => x.role === "user")
              : undefined;
            return (
              <MessageBubble
                key={m.id}
                m={m}
                onSaveAsCase={m.role === "assistant" && wsId ? () => setSaveFor({ msg: m, question: prevUser?.content ?? "" }) : undefined}
              />
            );
          })}
          {mutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Sto consultando le fonti INPS…
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      {messages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-3 py-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => send(a.prompt)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              <a.icon className="h-3 w-3" />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border/40 p-2.5"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Scrivi una domanda su norme, circolari, messaggi o pratiche INPS"
          className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border border-input/60 bg-background/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={mutation.isPending || input.trim().length < 2}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {saveFor && (
        <SaveCaseDialog
          open={!!saveFor}
          onOpenChange={(v) => { if (!v) setSaveFor(null); }}
          question={saveFor.question}
          answer={saveFor.msg.content}
          sources={saveFor.msg.sources ?? []}
          pending={saveCaseMut.isPending}
          onSubmit={(v) => saveCaseMut.mutate(v)}
        />
      )}
    </div>
  );
}

function SaveCaseDialog({
  open, onOpenChange, question, answer, sources, pending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  question: string;
  answer: string;
  sources: { n: number; title: string | null; source_type: string | null; document_number: string | null }[];
  pending: boolean;
  onSubmit: (v: { title: string; situation: string; solution: string; category: string | null; tags: string[]; isShared: boolean; sourceContext: Record<string, unknown> }) => void;
}) {
  const [title, setTitle] = useState(question.slice(0, 90) || "Caso da chat");
  const [category, setCategory] = useState("");
  const [situation, setSituation] = useState(question);
  const [solution, setSolution] = useState(answer);
  const [tagsStr, setTagsStr] = useState("");
  const [isShared, setIsShared] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Salva risposta come caso particolare
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Titolo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Categoria (facoltativa)</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Assegno Unico, NASpI, ADI…" /></div>
          <div><Label>Situazione (domanda / contesto)</Label><Textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={3} /></div>
          <div><Label>Soluzione (risposta operativa)</Label><Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={5} /></div>
          <div><Label>Tag (separati da virgola)</Label><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Condividi con lo studio</div>
              <div className="text-xs text-muted-foreground">Visibile a tutto il workspace</div>
            </div>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !title.trim() || !situation.trim() || !solution.trim()}
            onClick={() => onSubmit({
              title: title.trim().slice(0, 200),
              situation: situation.trim(),
              solution: solution.trim(),
              category: category.trim() || null,
              tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
              isShared,
              sourceContext: {
                chat_question: question,
                chat_answer_preview: answer.slice(0, 400),
                sources: sources.map((s) => ({ n: s.n, title: s.title, type: s.source_type, doc: s.document_number })),
                saved_at: new Date().toISOString(),
              },
            })}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-2 py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">Come posso aiutarti?</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Chiedi una norma, una circolare o un'azione operativa.
      </p>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-left">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
          Questo assistente è un servizio informativo indipendente e non sostituisce i canali ufficiali INPS.
        </p>
      </div>
      <div className="mt-4 flex w-full flex-col gap-1.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onPick(a.prompt)}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-left text-xs backdrop-blur hover:border-primary/40"
          >
            <a.icon className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const CASE_HEURISTIC = /(eccezion|derog|caso particolar|interpretazion|casistica|non standard|fuori standard|dubbio|contenzios|controvers)/i;

function MessageBubble({ m, onSaveAsCase }: { m: Msg; onSaveAsCase?: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/90 px-3 py-2 text-sm text-primary-foreground backdrop-blur">
          {m.content}
        </div>
      </div>
    );
  }
  const looksLikeException = CASE_HEURISTIC.test(m.content);
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border border-border/40 bg-background/50 px-3 py-2 text-sm text-foreground backdrop-blur">
        <FormattedAnswer text={m.content} />
        {m.sources && m.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {m.sources.slice(0, 4).map((s) => (
              <Badge key={s.n} variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-[10px] text-primary">
                <span className="rounded bg-primary/15 px-1">[{s.n}]</span>
                {s.document_number ?? s.source_type ?? "Fonte"}
              </Badge>
            ))}
          </div>
        )}
        {onSaveAsCase && (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            {looksLikeException ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Sembra un caso particolare
              </span>
            ) : <span />}
            <button
              type="button"
              onClick={onSaveAsCase}
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <Lightbulb className="h-3 w-3" /> Salva come caso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) {
      out.push(<div key={i} className="h-1.5" />);
      return;
    }
    if (/^#{2,3}\s/.test(line)) {
      out.push(
        <div key={i} className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {line.replace(/^#+\s*/, "")}
        </div>,
      );
      return;
    }
    const parts: ReactNode[] = [];
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
        parts.push(
          <sup key={k++} className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
            {tok}
          </sup>,
        );
      }
      last = m.index + tok.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    out.push(
      <p key={i} className="leading-relaxed">
        {parts}
      </p>,
    );
  });
  return <div className="space-y-1">{out}</div>;
}
