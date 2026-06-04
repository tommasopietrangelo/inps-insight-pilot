import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Plus, Mail, Trash2, Loader2, Play, ExternalLink, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOPICS } from "@/lib/mock-data";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listAlerts,
  createAlert,
  deleteAlert,
  listAlertDeliveries,
  markDeliveryRead,
  runAlertsNow,
} from "@/lib/alerts.functions";

export const Route = createFileRoute("/_appshell/alerts")({
  head: () => ({ meta: [{ title: "Avvisi · INPS Copilot" }] }),
  component: AlertsPage,
});

type Frequency = "immediata" | "giornaliera" | "settimanale";
type Priority = "alta" | "media" | "bassa";

function AlertsPage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const listFn = useServerFn(listAlerts);
  const createFn = useServerFn(createAlert);
  const deleteFn = useServerFn(deleteAlert);
  const listDeliveriesFn = useServerFn(listAlertDeliveries);
  const markReadFn = useServerFn(markDeliveryRead);
  const runNowFn = useServerFn(runAlertsNow);

  const deliveriesQ = useQuery({
    queryKey: ["alert-deliveries", current?.id],
    queryFn: () => listDeliveriesFn({ data: { workspaceId: current!.id, limit: 50 } }),
    enabled: !!current,
  });

  const runNowM = useMutation({
    mutationFn: () => runNowFn({}),
    onSuccess: (r) => {
      toast.success(`Avvisi eseguiti su ${r.total} regole`);
      qc.invalidateQueries({ queryKey: ["alert-deliveries", current?.id] });
      qc.invalidateQueries({ queryKey: ["alerts", current?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const markReadM = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-deliveries", current?.id] }),
  });

  const [topic, setTopic] = useState(TOPICS[0].name);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState<Frequency>("giornaliera");
  const [priority, setPriority] = useState<Priority>("media");

  const alertsQ = useQuery({
    queryKey: ["alerts", current?.id],
    queryFn: () => listFn({ data: { workspaceId: current!.id } }),
    enabled: !!current,
  });

  const createM = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          workspaceId: current!.id,
          name: name.trim() || `${topic} · ${freq}`,
          topicTags: [topic],
          frequency: freq,
          priority,
          channels: ["in_app", "email"],
        },
      }),
    onSuccess: () => {
      toast.success("Avviso creato");
      setName("");
      qc.invalidateQueries({ queryKey: ["alerts", current?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Avviso eliminato");
      qc.invalidateQueries({ queryKey: ["alerts", current?.id] });
    },
  });

  const deliveries = deliveriesQ.data ?? [];
  const unread = deliveries.filter((d) => !d.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avvisi</p>
          <h1 className="font-display text-2xl font-semibold">Monitoraggio per topic</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ricevi una notifica ogni volta che INPS pubblica un nuovo atto sui topic che segui.
            Il matching gira automaticamente ogni ora.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => runNowM.mutate()} disabled={runNowM.isPending}>
          {runNowM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Esegui ora
        </Button>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">Notifiche recenti</div>
            {unread > 0 && <Badge className="rounded-sm">{unread} nuove</Badge>}
          </div>
        </div>
        {deliveriesQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nessuna notifica ancora. Premi "Esegui ora" per forzare un controllo manuale.
          </div>
        ) : (
          <ul className="divide-y">
            {deliveries.map((d) => {
              const s = d.sources as { external_id: string | null; title: string; source_type: string; publication_date: string } | null;
              return (
                <li key={d.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{d.alert?.name ?? "Avviso"}</span>
                      <span>·</span>
                      <span className="capitalize">{s?.source_type}</span>
                      <span>·</span>
                      <span>{s?.publication_date}</span>
                      {!d.read_at && <Badge variant="outline" className="ml-1 rounded-sm border-primary/30 text-primary">nuovo</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">{s?.title}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {s?.external_id && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/source/$id" params={{ id: s.external_id }}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {!d.read_at && (
                      <Button variant="ghost" size="sm" onClick={() => markReadM.mutate(d.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>


      {alertsQ.isLoading ? (
        <Card className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento avvisi…
        </Card>
      ) : alerts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nessun avviso configurato. Crea la prima regola qui sotto.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alerts.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display text-base font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {a.topic_tags.join(", ")} · {a.frequency}
                    </div>
                  </div>
                </div>
                <PriorityBadge p={a.priority} />
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {(a.channels ?? []).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5">
                      <Mail className="h-3 w-3" /> {c}
                    </span>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteM.mutate(a.id)}
                  disabled={deleteM.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <div className="font-display text-base font-semibold">Crea una regola di avviso</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Definisci topic, frequenza e priorità. Riceverai una notifica in-app + email.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Topic">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOPICS.map((t) => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Frequenza">
            <Select value={freq} onValueChange={(v) => setFreq(v as Frequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediata">Immediata</SelectItem>
                <SelectItem value="giornaliera">Giornaliera</SelectItem>
                <SelectItem value="settimanale">Settimanale</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priorità">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="bassa">Bassa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome regola (opzionale)">
            <Input placeholder="es. ADI urgente" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-5" onClick={() => createM.mutate()} disabled={createM.isPending || !current}>
          {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crea regola
        </Button>
      </Card>
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const cls =
    p === "alta"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : p === "media"
      ? "bg-warning/15 text-warning-foreground border-warning/30"
      : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`rounded-sm capitalize ${cls}`}>{p}</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
