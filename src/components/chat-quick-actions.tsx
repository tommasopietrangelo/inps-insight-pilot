import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck,
  AlertTriangle,
  FileCheck2,
  BookmarkPlus,
  Loader2,
  ArrowRight,
  Sparkles,
  X,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { generateChecklist, type ChecklistResult } from "@/lib/checklist.functions";
import { createNote } from "@/lib/notes.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export type QuickActionSource = {
  n: number;
  source_id: string;
  title: string;
  source_type: string;
  document_number: string | null;
};

type Props = {
  question: string;
  answer: string;
  sources: QuickActionSource[];
  onFollowUp: (prompt: string) => void;
  followUpPending: boolean;
};

/** Deduce un titolo pratica breve dalla domanda utente. */
function derivePracticeTitle(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 80) return cleaned;
  return cleaned.slice(0, 77) + "…";
}

/** Estrae voci checklist plausibili dalla risposta AI: liste, punti, headings brevi. */
function extractDraftItems(answer: string): string[] {
  const items: string[] = [];
  const lines = answer.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // bullet o numerati
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.{6,180})$/);
    if (bullet) {
      items.push(bullet[1].replace(/\[\d+\]/g, "").replace(/\*\*/g, "").trim());
      continue;
    }
    // linee brevi imperative
    if (line.length < 130 && /^(verifica|controlla|acquisisci|allega|richiedi|invia|compila|conferma|assicurati)/i.test(line)) {
      items.push(line.replace(/\[\d+\]/g, "").replace(/\*\*/g, "").trim());
    }
  }
  const unique = Array.from(new Set(items));
  return unique.slice(0, 8);
}

function buildContextBlock(question: string, answer: string, sources: QuickActionSource[]) {
  const src = sources
    .map((s) => `[${s.n}] ${s.source_type}${s.document_number ? " " + s.document_number : ""} — ${s.title}`)
    .join("\n");
  return [
    `RICHIESTA ORIGINALE:\n${question}`,
    `RISPOSTA PRECEDENTE (estratto):\n${answer.slice(0, 2400)}`,
    src ? `FONTI INPS CITATE:\n${src}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function ChatQuickActions({
  question,
  answer,
  sources,
  onFollowUp,
  followUpPending,
}: Props) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "eccezioni" | "documenti">(null);

  const handleFollowUp = (kind: "eccezioni" | "documenti") => {
    if (followUpPending) return;
    const ctx = buildContextBlock(question, answer, sources);
    const prompt =
      kind === "eccezioni"
        ? `In base alla risposta precedente e alle fonti INPS citate, elenca in modo strutturato:\n` +
          `- eccezioni e casi particolari\n` +
          `- incompatibilità e cause di decadenza\n` +
          `- requisiti soggettivi o oggettivi da verificare con attenzione\n` +
          `- scenari operativi meno frequenti che l'operatore dovrebbe considerare.\n\n` +
          `Rimani ancorato alle fonti già citate e cita ogni affermazione con [n].\n\n` +
          `CONTESTO:\n${ctx}`
        : `In base alla risposta precedente e alle fonti INPS citate, elenca in formato operativo per CAF/patronato:\n` +
          `- documenti da acquisire dall'utente\n` +
          `- dichiarazioni e autocertificazioni necessarie\n` +
          `- allegati tecnici (ISEE, contratti, buste paga, sentenze, ecc.)\n` +
          `- prove e ricevute da conservare a fascicolo.\n\n` +
          `Struttura la risposta in elenchi puntati chiari, con eventuali riferimenti [n] alle fonti.\n\n` +
          `CONTESTO:\n${ctx}`;
    setPendingAction(kind);
    onFollowUp(prompt);
    // reset lo stato pending dopo un attimo (il vero loading è gestito dal parent)
    setTimeout(() => setPendingAction(null), 400);
  };

  return (
    <div className="mt-5 border-t pt-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Trasforma questa risposta in azione
      </div>
      <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto sm:overflow-visible">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setChecklistOpen(true)}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Crea checklist pratica
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => handleFollowUp("eccezioni")}
          disabled={followUpPending}
        >
          {pendingAction === "eccezioni" && followUpPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          Approfondisci eccezioni
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => handleFollowUp("documenti")}
          disabled={followUpPending}
        >
          {pendingAction === "documenti" && followUpPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileCheck2 className="h-3.5 w-3.5" />
          )}
          Verifica documenti
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setSaveOpen(true)}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Salva nello Studio
        </Button>
      </div>

      <ChecklistFromAnswerDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        question={question}
        answer={answer}
        sources={sources}
      />
      <SaveToStudioDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        question={question}
        answer={answer}
        sources={sources}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Crea checklist pratica dalla risposta                       */
/* ------------------------------------------------------------------ */

function ChecklistFromAnswerDialog({
  open,
  onOpenChange,
  question,
  answer,
  sources,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  question: string;
  answer: string;
  sources: QuickActionSource[];
}) {
  const initialTitle = useMemo(() => derivePracticeTitle(question), [question]);
  const initialItems = useMemo(() => extractDraftItems(answer), [answer]);
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(question);
  const [items, setItems] = useState<string[]>(initialItems.length ? initialItems : [""]);
  const [generated, setGenerated] = useState<ChecklistResult | null>(null);
  const navigate = useNavigate();

  const genFn = useServerFn(generateChecklist);
  const gen = useMutation({
    mutationFn: () => {
      const draft = items.filter((i) => i.trim()).map((i) => `- ${i}`).join("\n");
      const context =
        `${question}\n\n` +
        (draft ? `Bozza checklist iniziale proposta dall'operatore:\n${draft}\n\n` : "") +
        `Contesto risposta precedente (estratto):\n${answer.slice(0, 4000)}`;
      return genFn({ data: { query: context, documentText: "", documentTitle: title } });
    },
    onSuccess: (res) => {
      setGenerated(res);
      toast.success("Checklist completa generata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openInChecklistPage = () => {
    // Prefill via sessionStorage; il route legge e applica.
    try {
      sessionStorage.setItem(
        "chatChecklistPrefill",
        JSON.stringify({
          title,
          query: `${title}\n\n${summary}`,
          items: items.filter((i) => i.trim()),
          sources,
          answerExcerpt: answer.slice(0, 4000),
          ts: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    onOpenChange(false);
    navigate({ to: "/checklist", search: { fromChat: "1" } as never });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist generata dalla risposta
          </DialogTitle>
          <DialogDescription>
            Abbiamo precompilato questa checklist sulla base della risposta e delle fonti INPS
            appena analizzate. Puoi modificarla prima di generare la versione completa o aprirla
            nella sezione dedicata.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Titolo pratica</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Sintesi del caso</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 min-h-[70px]"
            />
          </div>

          {sources.length > 0 && (
            <div>
              <Label className="text-xs">Fonti INPS usate nella risposta</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sources.map((s) => (
                  <Badge key={s.source_id} variant="outline" className="gap-1 text-[11px]">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    [{s.n}] {s.source_type}
                    {s.document_number ? ` ${s.document_number}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Prime voci checklist</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => setItems((p) => [...p, ""])}
              >
                <Plus className="h-3 w-3" /> Aggiungi voce
              </Button>
            </div>
            <div className="mt-2 space-y-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Input
                    value={it}
                    onChange={(e) =>
                      setItems((p) => p.map((x, i) => (i === idx ? e.target.value : x)))
                    }
                    placeholder="Voce operativa…"
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {generated && (
            <div className="rounded-md border bg-surface-muted p-3">
              <div className="text-xs font-semibold text-primary">
                {generated.practiceType} · {generated.items.length} voci generate
              </div>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {generated.summary}
              </p>
              <Separator className="my-2" />
              <ul className="space-y-1 text-xs">
                {generated.items.slice(0, 6).map((it) => (
                  <li key={it.id} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{it.title}</span>
                  </li>
                ))}
                {generated.items.length > 6 && (
                  <li className="text-muted-foreground">
                    …e altre {generated.items.length - 6} voci. Apri nella sezione checklist per il
                    dettaglio completo.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="gap-1.5"
          >
            {gen.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Genera checklist completa
          </Button>
          <Button onClick={openInChecklistPage} className="gap-1.5">
            Apri nella sezione checklist
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Salva nello Studio (nota operativa)                         */
/* ------------------------------------------------------------------ */

function SaveToStudioDialog({
  open,
  onOpenChange,
  question,
  answer,
  sources,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  question: string;
  answer: string;
  sources: QuickActionSource[];
}) {
  const { current: workspace } = useWorkspace();
  const [title, setTitle] = useState(derivePracticeTitle(question));
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  const noteFn = useServerFn(createNote);
  const save = useMutation({
    mutationFn: () => {
      if (!workspace?.id) throw new Error("Nessun workspace selezionato");
      const body =
        (description ? `${description}\n\n` : "") +
        `— Da risposta chat —\n\nDomanda:\n${question}\n\nRisposta:\n${answer}\n\n` +
        (sources.length
          ? `Fonti INPS:\n` +
            sources
              .map(
                (s) =>
                  `[${s.n}] ${s.source_type}${s.document_number ? " " + s.document_number : ""} — ${s.title}`,
              )
              .join("\n")
          : "");
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 15);
      return noteFn({
        data: {
          workspaceId: workspace.id,
          title: title || "Nota da chat",
          body,
          tags: ["da-chat", ...tagArr],
        },
      });
    },
    onSuccess: () => {
      toast.success("Nota salvata nello spazio di lavoro");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-primary" />
            Salva nota operativa
          </DialogTitle>
          <DialogDescription>
            La nota viene archiviata nello Spazio di lavoro del tuo studio, con riferimento alle
            fonti INPS citate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Titolo nota</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tag / topic (separati da virgola)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="es. NASpI, licenziamento, urgente"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Breve descrizione</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contesto della pratica, nome cliente interno, prossimi passi…"
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div className="rounded-md border bg-surface-muted px-3 py-2 text-[11px] text-muted-foreground">
            Fonte origine: <span className="font-medium text-foreground">Da risposta chat</span>
            {sources.length > 0 && ` · ${sources.length} font${sources.length === 1 ? "e" : "i"} INPS collegate`}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !workspace?.id}
            className="gap-1.5"
          >
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            Salva nota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
