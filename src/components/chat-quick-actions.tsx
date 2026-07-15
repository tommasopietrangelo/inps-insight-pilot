import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  FileCheck2,
  BookmarkPlus,
  Loader2,
  Sparkles,
  ShieldCheck,
  Pin,
  BellPlus,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  generateReminder,
  pinReminderToPractice,
  reminderToNoteBody,
  type Reminder,
} from "@/lib/reminders.functions";
import { createNote } from "@/lib/notes.functions";
import { listPractices } from "@/lib/practices.functions";
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
  const [reminderOpen, setReminderOpen] = useState(false);
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
          variant="default"
          className="gap-1.5"
          onClick={() => setReminderOpen(true)}
        >
          <BellPlus className="h-3.5 w-3.5" />
          Crea reminder per punti
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
      </div>

      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        question={question}
        answer={answer}
        sources={sources}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Crea reminder per punti                                     */
/* ------------------------------------------------------------------ */

function ReminderDialog({
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
  const wsId = workspace?.id ?? "";

  const genFn = useServerFn(generateReminder);
  const noteFn = useServerFn(createNote);
  const pinFn = useServerFn(pinReminderToPractice);
  const listPracticesFn = useServerFn(listPractices);

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [pinTarget, setPinTarget] = useState<string>("");

  const practicesQuery = useQuery({
    queryKey: ["practices", wsId, "flow_run"],
    queryFn: () => listPracticesFn({ data: { workspaceId: wsId, kind: "flow_run" } }),
    enabled: !!wsId && open,
  });

  const gen = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          question,
          answer,
          sources: sources.map((s) => ({
            n: s.n,
            source_id: s.source_id,
            title: s.title,
            source_type: s.source_type,
            document_number: s.document_number,
          })),
        },
      }),
    onSuccess: (r) => setReminder(r),
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-generate on open
  useMemo(() => {
    if (open && !reminder && !gen.isPending) gen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveNote = useMutation({
    mutationFn: () => {
      if (!wsId) throw new Error("Nessun workspace selezionato");
      if (!reminder) throw new Error("Reminder non ancora generato");
      return noteFn({
        data: {
          workspaceId: wsId,
          title: reminder.title,
          body: reminderToNoteBody(reminder),
          tags: ["reminder", "da-chat"],
        },
      });
    },
    onSuccess: async () => {
      toast.success("Reminder salvato nello Spazio di lavoro");
      if (pinTarget && reminder) {
        try {
          await pinFn({ data: { practiceId: pinTarget, reminder } });
          toast.success("Reminder pinnato nella sotto-pratica");
        } catch (e) {
          toast.error(`Pin fallito: ${(e as Error).message}`);
        }
      }
      onOpenChange(false);
      setReminder(null);
      setPinTarget("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBullet = (idx: number, value: string) => {
    if (!reminder) return;
    setReminder({
      ...reminder,
      bullets: reminder.bullets.map((b, i) => (i === idx ? value : b)),
    });
  };
  const removeBullet = (idx: number) => {
    if (!reminder) return;
    setReminder({
      ...reminder,
      bullets: reminder.bullets.filter((_, i) => i !== idx),
    });
  };
  const addBullet = () => {
    if (!reminder) return;
    setReminder({ ...reminder, bullets: [...reminder.bullets, ""] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellPlus className="h-5 w-5 text-primary" />
            Reminder per punti
          </DialogTitle>
          <DialogDescription>
            Genera un riassunto operativo per punti da questa risposta. Viene salvato nello
            <strong> Spazio di lavoro → Reminder</strong> e può essere pinnato in una sotto-pratica dei Flussi.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {gen.isPending && (
            <div className="flex items-center gap-2 rounded-md border bg-surface-muted/40 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Sto generando il reminder…
            </div>
          )}

          {reminder && (
            <>
              <div>
                <Label className="text-xs">Titolo</Label>
                <Input
                  value={reminder.title}
                  onChange={(e) => setReminder({ ...reminder, title: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Riassunto operativo</Label>
                <Textarea
                  value={reminder.summary}
                  onChange={(e) => setReminder({ ...reminder, summary: e.target.value })}
                  className="mt-1 min-h-[80px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Punti operativi</Label>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={addBullet}>
                    <Plus className="h-3 w-3" /> Aggiungi
                  </Button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {reminder.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Input
                        value={b}
                        onChange={(e) => updateBullet(i, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => removeBullet(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {sources.length > 0 && (
                <div>
                  <Label className="text-xs">Fonti INPS collegate</Label>
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

              <Separator />

              <div>
                <Label className="flex items-center gap-1.5 text-xs">
                  <Pin className="h-3 w-3" /> Pinna anche in una sotto-pratica (opzionale)
                </Label>
                <Select value={pinTarget} onValueChange={setPinTarget}>
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={
                        practicesQuery.isLoading
                          ? "Carico sotto-pratiche…"
                          : "Nessuna — salva solo nello Spazio di lavoro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(practicesQuery.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                    {(practicesQuery.data ?? []).length === 0 && !practicesQuery.isLoading && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nessuna sotto-pratica: creane una dai Flussi.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {pinTarget && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Il reminder sarà consultabile in cima alla sotto-pratica selezionata.
                  </p>
                )}
              </div>
            </>
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
            Rigenera
          </Button>
          <Button
            onClick={() => saveNote.mutate()}
            disabled={!reminder || saveNote.isPending || !wsId}
            className="gap-1.5"
          >
            {saveNote.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            Salva reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
