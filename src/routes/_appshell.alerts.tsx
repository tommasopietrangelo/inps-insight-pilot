import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Plus, Mail, MessageSquare, Hash } from "lucide-react";
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
import { ALERTS, TOPICS, SOURCES } from "@/lib/mock-data";

export const Route = createFileRoute("/_appshell/alerts")({
  head: () => ({ meta: [{ title: "Avvisi · INPS Copilot" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const [topic, setTopic] = useState(TOPICS[0].name);
  const [sourceType, setSourceType] = useState("Tutti");
  const [freq, setFreq] = useState("Immediata");
  const [priority, setPriority] = useState("Alta");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avvisi</p>
        <h1 className="font-display text-2xl font-semibold">Monitoraggio per topic</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ricevi una notifica ogni volta che INPS pubblica un nuovo atto sui topic che segui.
        </p>
      </div>

      {/* Alert cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ALERTS.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-display text-base font-semibold">{a.topic}</div>
                  <div className="text-xs text-muted-foreground">{a.source_type} · {a.frequency}</div>
                </div>
              </div>
              <PriorityBadge p={a.priority} />
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="font-display text-2xl font-semibold">{a.new_updates}</div>
                <div className="text-xs text-muted-foreground">nuovi atti</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Ultimo aggiornamento</div>
                <div className="text-sm font-medium">
                  {new Date(a.last_update).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs text-muted-foreground">
                {a.channels.includes("Email") && <ChannelChip icon={Mail} label="Email" />}
                {a.channels.includes("In-app") && <ChannelChip icon={Bell} label="In-app" />}
                {a.channels.includes("Slack") && <ChannelChip icon={Hash} label="Slack" />}
              </div>
              <Button variant="outline" size="sm">Gestisci</Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Create alert */}
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <div className="font-display text-base font-semibold">Crea una regola di avviso</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Definisci topic, tipo atto, frequenza e priorità.
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
            <Field label="Tipo atto">
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Tutti", "Circolare", "Messaggio", "Decreto", "Pagina servizio"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Frequenza">
              <Select value={freq} onValueChange={setFreq}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Immediata", "Giornaliera", "Settimanale"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priorità">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Alta", "Media", "Bassa"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome regola (opzionale)">
              <Input placeholder="es. ADI urgente" />
            </Field>
          </div>
          <Button className="mt-5 w-full sm:w-auto">Crea regola</Button>
        </Card>

        {/* Timeline */}
        <Card className="p-6">
          <div className="mb-4 font-display text-base font-semibold">Timeline aggiornamenti</div>
          <ol className="relative space-y-5 border-l pl-5">
            {SOURCES.slice(0, 6).map((s) => (
              <li key={s.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <div className="text-xs text-muted-foreground">
                  {new Date(s.publication_date).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-sm text-[10px]">{s.source_type}</Badge>
                  {s.topic_tags.slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline" className="rounded-sm text-[10px] font-normal">{t}</Badge>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function ChannelChip({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const cls =
    p === "Alta"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : p === "Media"
      ? "bg-warning/15 text-warning-foreground border-warning/30"
      : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`rounded-sm ${cls}`}>{p}</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// silence unused MessageSquare import warning in some setups
void MessageSquare;
