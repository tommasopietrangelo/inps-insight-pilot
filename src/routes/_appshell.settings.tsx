import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ingestEmbeddings } from "@/lib/search.functions";
import { importFromUrl, importInpsLatest, importFromText } from "@/lib/import.functions";
import { backfillInpsViaFirecrawl } from "@/lib/inps-firecrawl.functions";
import { ingestNormativeCardine } from "@/lib/normative-cardine.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Download, Rss, ClipboardPaste, Flame, BookMarked } from "lucide-react";
import { TeamCard } from "@/components/team-card";

export const Route = createFileRoute("/_appshell/settings")({
  head: () => ({ meta: [{ title: "Impostazioni · INPS Copilot" }] }),
  component: Settings,
});


function Settings() {
  const [name, setName] = useState("Studio Rossi · CAF");
  const [dark, setDark] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [weekly, setWeekly] = useState(false);
  const runIngest = useServerFn(ingestEmbeddings);
  const runImportUrl = useServerFn(importFromUrl);
  const runImportRss = useServerFn(importInpsLatest);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [rssing, setRssing] = useState(false);
  const [rssResult, setRssResult] = useState<string | null>(null);
  const runImportText = useServerFn(importFromText);
  const [txtTitle, setTxtTitle] = useState("");
  const [txtUrl, setTxtUrl] = useState("");
  const [txtBody, setTxtBody] = useState("");
  const [txting, setTxting] = useState(false);
  const [txtResult, setTxtResult] = useState<string | null>(null);
  const runBackfill = useServerFn(backfillInpsViaFirecrawl);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfillLimit, setBackfillLimit] = useState(100);
  const runNormative = useServerFn(ingestNormativeCardine);
  const [normLoading, setNormLoading] = useState(false);
  const [normResult, setNormResult] = useState<string | null>(null);

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

        {/* Import from URL */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 font-display text-base font-semibold">
            <Download className="h-4 w-4 text-primary" /> Importa atto da URL ufficiale
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Incolla un link a una circolare, messaggio o decreto su <code>inps.it</code> o <code>gazzettaufficiale.it</code>.
            Verranno estratti automaticamente titolo, numero, data e testo. Lancia poi "Aggiorna indice" per renderlo cercabile.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="https://www.inps.it/it/it/dettaglio-atto.circolare-numero-14-del-30-01-2026.html"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
            />
            <Button
              size="sm"
              disabled={importing || !importUrl}
              onClick={async () => {
                setImporting(true);
                setImportResult(null);
                try {
                  const r = await runImportUrl({ data: { url: importUrl } });
                  setImportResult(
                    `Importato: ${r.source.title} · tipo ${r.detected.sourceType} · n. ${r.detected.number ?? "—"} · ${r.detected.date}`,
                  );
                  setImportUrl("");
                } catch (e) {
                  setImportResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importa"}
            </Button>
          </div>
          {importResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{importResult}</div>
          )}
        </Card>

        {/* Import from pasted text */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 font-display text-base font-semibold">
            <ClipboardPaste className="h-4 w-4 text-primary" /> Importa da testo incollato (consigliato)
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Le pagine <code>dettaglio-atto</code> di inps.it sono renderizzate via JavaScript, quindi l'import automatico
            spesso non trova il contenuto. Apri il <strong>PDF ufficiale</strong> della circolare, copia il testo (Ctrl+A,
            Ctrl+C) e incollalo qui: è il modo più affidabile per avere risposte AI fondate.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="txt-title">Titolo</Label>
              <Input
                id="txt-title"
                placeholder="Circolare INPS n. 14 del 30 gennaio 2026 — Assegno di Inclusione"
                value={txtTitle}
                onChange={(e) => setTxtTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txt-url">URL ufficiale</Label>
              <Input
                id="txt-url"
                placeholder="https://www.inps.it/..."
                value={txtUrl}
                onChange={(e) => setTxtUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="txt-body">Testo dell'atto</Label>
            <Textarea
              id="txt-body"
              rows={10}
              placeholder="Incolla qui il testo integrale della circolare, messaggio o decreto…"
              value={txtBody}
              onChange={(e) => setTxtBody(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{txtBody.length} caratteri · minimo 200</p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="sm"
              disabled={txting || !txtTitle || !txtUrl || txtBody.length < 200}
              onClick={async () => {
                setTxting(true);
                setTxtResult(null);
                try {
                  const r = await runImportText({
                    data: { title: txtTitle, official_url: txtUrl, text: txtBody },
                  });
                  setTxtResult(
                    `Importato: ${r.source.title} · tipo ${r.detected.sourceType} · n. ${r.detected.number ?? "—"}. Ora clicca "Aggiorna indice" qui sotto.`,
                  );
                  setTxtTitle("");
                  setTxtUrl("");
                  setTxtBody("");
                } catch (e) {
                  setTxtResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setTxting(false);
                }
              }}
            >
              {txting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importa testo"}
            </Button>
            {txtResult && <span className="text-sm text-muted-foreground">{txtResult}</span>}
          </div>
        </Card>

        {/* Firecrawl backfill */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Flame className="h-4 w-4 text-primary" /> Backfill INPS via Firecrawl
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Scopre via Firecrawl gli URL di circolari e messaggi pubblicati su inps.it,
                filtra gli ultimi 24 mesi e li importa con dedup automatico (gli atti già presenti
                in DB vengono saltati prima dello scraping per non consumare crediti).
                Eseguilo una sola volta; poi il cron giornaliero terrà il corpus aggiornato.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bf-limit" className="text-xs">Max atti</Label>
                <Input
                  id="bf-limit"
                  type="number"
                  min={1}
                  max={400}
                  value={backfillLimit}
                  onChange={(e) => setBackfillLimit(Math.max(1, Math.min(400, Number(e.target.value) || 100)))}
                  className="w-24"
                />
              </div>
              <Button
                size="sm"
                disabled={backfilling}
                onClick={async () => {
                  setBackfilling(true);
                  setBackfillResult(null);
                  try {
                    const r = await runBackfill({ data: { limit: backfillLimit, kinds: ["circolare", "messaggio"] } });
                    setBackfillResult(
                      `Scoperti ${r.discovered} URL · ${r.eligible} idonei · processati ${r.processed} · nuovi ${r.created} · già presenti ${r.skipped}${r.errors.length ? ` · ${r.errors.length} errori` : ""}. Ora clicca "Aggiorna indice".`,
                    );
                  } catch (e) {
                    setBackfillResult(`Errore: ${(e as Error).message}`);
                  } finally {
                    setBackfilling(false);
                  }
                }}
                className="gap-1.5"
              >
                {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                {backfilling ? "Backfill in corso…" : "Esegui backfill"}
              </Button>
            </div>
          </div>
          {backfillResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{backfillResult}</div>
          )}
        </Card>

        {/* Normative cardine */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <BookMarked className="h-4 w-4 text-primary" /> Normative cardine
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Carica nel corpus le ~14 norme cardine ancora vigenti (DL 48/2023 ADI/SFL,
                D.Lgs. 22/2015 NASpI, DPCM 159/2013 ISEE, D.Lgs. 230/2021 Assegno Unico,
                Leggi di Bilancio 2022-2025, riforme pensioni, TU maternità, L. 104).
                Ogni voce ha un riassunto operativo curato; il testo integrale viene
                scaricato da Normattiva via Firecrawl quando possibile. Dedup automatico.
              </p>
            </div>
            <Button
              size="sm"
              disabled={normLoading}
              onClick={async () => {
                setNormLoading(true);
                setNormResult(null);
                try {
                  const r = await runNormative();
                  setNormResult(
                    `Totale ${r.total} · nuove ${r.created} · aggiornate ${r.updated} · già presenti ${r.skipped}${r.errors.length ? ` · ${r.errors.length} errori` : ""}. Ora clicca "Aggiorna indice".`,
                  );
                } catch (e) {
                  setNormResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setNormLoading(false);
                }
              }}
              className="gap-1.5"
            >
              {normLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
              {normLoading ? "Caricamento…" : "Carica normative"}
            </Button>
          </div>
          {normResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{normResult}</div>
          )}
        </Card>

        {/* RSS pull (best effort) */}
        <Card className="p-6 lg:col-span-2">

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Rss className="h-4 w-4 text-primary" /> Aggiornamento automatico (sperimentale)
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Tenta di scaricare gli ultimi atti pubblicati dal feed RSS INPS. Funzione best-effort:
                se il feed non è raggiungibile o il formato cambia, usa l'import da URL singolo.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={rssing}
              onClick={async () => {
                setRssing(true);
                setRssResult(null);
                try {
                  const r = await runImportRss();
                  if (!r.ok) {
                    setRssResult(r.message ?? "Nessun atto importato.");
                  } else {
                    setRssResult(
                      `Importati ${r.imported} su ${r.found} trovati${r.errors && r.errors.length ? ` · ${r.errors.length} errori` : ""}`,
                    );
                  }
                } catch (e) {
                  setRssResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setRssing(false);
                }
              }}
              className="gap-1.5"
            >
              {rssing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
              {rssing ? "Scaricamento…" : "Scarica ultimi"}
            </Button>
          </div>
          {rssResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{rssResult}</div>
          )}
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

        <TeamCard />

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
