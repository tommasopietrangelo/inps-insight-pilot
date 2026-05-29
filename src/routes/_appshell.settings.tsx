import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ingestEmbeddings } from "@/lib/search.functions";
import { importFromUrl, importInpsLatest } from "@/lib/import.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2, Download, Rss } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_appshell/settings")({
  head: () => ({ meta: [{ title: "Impostazioni · INPS Copilot" }] }),
  component: Settings,
});

const MEMBERS = [
  { name: "Giulia Rossi", email: "giulia.rossi@studiorossi.it", role: "Admin" },
  { name: "Marco De Luca", email: "marco.deluca@studiorossi.it", role: "Operatore" },
  { name: "Sara Bianchi", email: "sara.bianchi@studiorossi.it", role: "Operatore" },
  { name: "Luca Verdi", email: "luca.verdi@studiorossi.it", role: "Sola lettura" },
];

function Settings() {
  const [name, setName] = useState("Studio Rossi · CAF");
  const [dark, setDark] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [weekly, setWeekly] = useState(false);
  const runIngest = useServerFn(ingestEmbeddings);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Impostazioni</p>
        <h1 className="font-display text-2xl font-semibold">Workspace e account</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Workspace */}
        <Card className="p-6">
          <div className="font-display text-base font-semibold">Workspace</div>
          <p className="text-sm text-muted-foreground">Nome visibile a tutti i membri.</p>
          <div className="mt-4 space-y-3">
            <Label htmlFor="ws">Nome workspace</Label>
            <Input id="ws" value={name} onChange={(e) => setName(e.target.value)} />
            <Button size="sm">Salva</Button>
          </div>
        </Card>

        {/* Theme */}
        <Card className="p-6">
          <div className="font-display text-base font-semibold">Aspetto</div>
          <p className="text-sm text-muted-foreground">Tema dell'interfaccia.</p>
          <div className="mt-4 flex items-center justify-between rounded-md border bg-surface px-4 py-3">
            <div>
              <div className="text-sm font-medium">Tema scuro</div>
              <div className="text-xs text-muted-foreground">Migliore per sessioni di lettura prolungate</div>
            </div>
            <Switch
              checked={dark}
              onCheckedChange={(v) => {
                setDark(v);
                if (typeof document !== "undefined") {
                  document.documentElement.classList.toggle("dark", v);
                }
              }}
            />
          </div>
        </Card>

        {/* AI Index */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Indice AI del corpus
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Genera gli embedding vettoriali delle fonti ufficiali per abilitare la ricerca grounded.
                Eseguilo dopo ogni nuovo import di circolari o messaggi.
              </p>
            </div>
            <Button
              size="sm"
              disabled={ingesting}
              onClick={async () => {
                setIngesting(true);
                setIngestResult(null);
                try {
                  const r = await runIngest();
                  setIngestResult(
                    `Indicizzati ${r.processed} nuovi atti · totali ${r.total} · già indicizzati ${r.skipped}`,
                  );
                } catch (e) {
                  setIngestResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setIngesting(false);
                }
              }}
              className="gap-1.5"
            >
              {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {ingesting ? "Indicizzazione…" : "Aggiorna indice"}
            </Button>
          </div>
          {ingestResult && (
            <div className="mt-4 rounded-md border bg-surface px-4 py-3 text-sm">{ingestResult}</div>
          )}
        </Card>

        {/* Notifications */}
        <Card className="p-6 lg:col-span-2">
          <div className="font-display text-base font-semibold">Notifiche</div>
          <p className="text-sm text-muted-foreground">Come vuoi essere avvisato di nuovi atti.</p>
          <div className="mt-4 space-y-3">
            <ToggleRow
              title="Email"
              desc="Riassunto degli atti pubblicati nei tuoi topic"
              checked={emailAlerts}
              onChange={setEmailAlerts}
            />
            <ToggleRow
              title="Notifiche in-app"
              desc="Badge e popup all'interno del cruscotto"
              checked={inAppAlerts}
              onChange={setInAppAlerts}
            />
            <ToggleRow
              title="Digest settimanale"
              desc="Ogni lunedì mattina, riepilogo di tutti i topic"
              checked={weekly}
              onChange={setWeekly}
            />
          </div>
        </Card>

        {/* Roles */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-1 font-display text-base font-semibold">Ruoli e permessi</div>
          <p className="text-sm text-muted-foreground">
            Admin gestisce membri e fatturazione · Operatore può creare ricerche, note e avvisi · Sola lettura può solo
            consultare.
          </p>
          <Separator className="my-4" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MEMBERS.map((m) => (
                <TableRow key={m.email}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Select defaultValue={m.role}>
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Admin", "Operatore", "Sola lettura"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Rimuovi</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Billing */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-base font-semibold">Piano e fatturazione</div>
              <p className="text-sm text-muted-foreground">Gestisci il piano del workspace.</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">Piano Studio</Badge>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Utenti" value="8 / 10" />
            <Stat label="Query questo mese" value="5.420" />
            <Stat label="Prossima fattura" value="01 giu 2026 · €129" />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm">Aggiorna piano</Button>
            <Button variant="ghost" size="sm">Storico fatture</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-surface px-4 py-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-surface p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
