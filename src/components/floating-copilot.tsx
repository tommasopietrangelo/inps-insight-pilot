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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { groundedSearch } from "@/lib/search.functions";
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

const STORAGE_KEY = "copilot-floating-state-v1";

type Persisted = {
  open: boolean;
  minimized: boolean;
  mode: Mode;
  messages: Msg[];
};

function loadState(): Persisted {
  if (typeof window === "undefined") {
    return { open: false, minimized: false, mode: "docked", messages: [] };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* ignore */
  }
  return { open: false, minimized: false, mode: "docked", messages: [] };
}

const QUICK_ACTIONS: { label: string; icon: typeof FileText; prompt: string }[] = [
  { label: "Riassumi questa pagina", icon: BookOpenCheck, prompt: "Riassumi i contenuti rilevanti della sezione che sto consultando." },
  { label: "Trova fonti correlate", icon: FileText, prompt: "Trova circolari e messaggi INPS correlati al tema corrente." },
  { label: "Crea checklist pratica", icon: ListChecks, prompt: "Crea una checklist operativa per gestire questa pratica." },
];

export function FloatingCopilot() {
  const isMobile = useIsMobile();
  const initial = useRef<Persisted>(loadState());
  const [open, setOpen] = useState(initial.current.open);
  const [minimized, setMinimized] = useState(initial.current.minimized);
  const [mode, setMode] = useState<Mode>(initial.current.mode);
  const [messages, setMessages] = useState<Msg[]>(initial.current.messages);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        JSON.stringify({ open, minimized, mode, messages } satisfies Persisted),
      );
    } catch {
      /* ignore */
    }
  }, [open, minimized, mode, messages]);

  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mutation.isPending, open, minimized]);

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
        className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2.5 text-sm font-medium text-foreground shadow-lg backdrop-blur-md transition hover:bg-background hover:shadow-xl"
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
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3.5 py-2 text-sm shadow-lg backdrop-blur-md hover:bg-background"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium">Copilot INPS</span>
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    );
  }

  // ---------- Panel ----------
  const panelClass = isMobile
    ? "fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-xl border-t"
    : mode === "docked"
      ? "fixed right-4 bottom-4 top-20 z-50 w-[400px] rounded-xl border"
      : "fixed bottom-5 right-5 z-50 h-[560px] w-[380px] rounded-xl border";

  return (
    <div
      className={cn(
        panelClass,
        "flex flex-col bg-background/95 shadow-2xl backdrop-blur-xl",
      )}
      role="dialog"
      aria-label="Copilot INPS"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">Copilot INPS</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Assistente attivo
          </div>
        </div>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setMode((m) => (m === "docked" ? "floating" : "docked"))}
            title={mode === "docked" ? "Finestra compatta" : "Aggancia a destra"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {mode === "docked" ? <PictureInPicture2 className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          title="Riduci"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Chiudi"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !mutation.isPending && (
          <EmptyState onPick={send} />
        )}
        <div className="space-y-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} m={m} />
          ))}
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
        <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => send(a.prompt)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1 rounded-full border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
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
        className="flex items-end gap-2 border-t p-2.5"
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
          className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={mutation.isPending || input.trim().length < 2}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
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
      <div className="mt-4 flex w-full flex-col gap-1.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onPick(a.prompt)}
            className="flex items-center gap-2 rounded-md border bg-surface px-3 py-2 text-left text-xs hover:border-primary/40"
          >
            <a.icon className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: Msg }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          {m.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border bg-surface px-3 py-2 text-sm text-foreground">
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
    // strip bold markers, citation refs handled as superscript
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
