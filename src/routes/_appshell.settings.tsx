import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ingestEmbeddings } from "@/lib/search.functions";
import { importFromUrl, importInpsLatest, importFromText } from "@/lib/import.functions";
import {
  backfillInpsViaFirecrawl,
  discoverInpsCorpus,
  processInpsQueueBatch,
  getInpsQueueStats,
} from "@/lib/inps-firecrawl.functions";
import { Database as DatabaseIcon } from "lucide-react";
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


const TYPE_LABEL: Record<string, string> = {
  circolare: "Circolare",
  messaggio: "Messaggio",
  decreto: "Decreto",
  pagina_servizio: "Pagina servizio",
  normativa: "Normativa",
};

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

  // Backfill massivo via coda
  const runDiscover = useServerFn(discoverInpsCorpus);
  const runBatch = useServerFn(processInpsQueueBatch);
  const fetchQueueStats = useServerFn(getInpsQueueStats);
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<string | null>(null);
  const [yearFrom, setYearFrom] = useState(1999);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [batching, setBatching] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(200);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; created: number; skipped: number; failed: number } | null>(null);
  const stopBatchRef = useRef(false);
  const { data: queueStats, refetch: refetchQueueStats } = useQuery({
    queryKey: ["inps-queue-stats"],
    queryFn: () => fetchQueueStats(),
  });

  const { data: sourcesByIngestion, isLoading: sourcesByIngestionLoading } = useQuery({
    queryKey: ["sources-by-ingestion"],
    queryFn: async () => {
      const PAGE = 1000;
      const all: any[] = [];
      let from = 0;
      for (;;) {
        const to = from + PAGE - 1;
        const { data, error } = await supabase
          .from("sources")
          .select("id, title, source_type, document_number, publication_date, ingested_at, official_url")
          .order("ingested_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

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

        {/* Backfill massivo via coda */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <DatabaseIcon className="h-4 w-4 text-primary" /> Importazione massiva corpus INPS
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Importa progressivamente l'intero archivio circolari + messaggi (~15.000 atti)
                pubblicato su inps.it. Funziona in due fasi:
                <strong> 1) Discovery</strong> — scopre via Firecrawl tutti gli URL per anno e li
                accoda in DB (costo ~2 crediti/anno, ignora URL già in coda).
                <strong> 2) Batch</strong> — scarica e indicizza 200–500 atti per run, saltando i
                duplicati PRIMA dello scraping (zero credito per quelli già nel corpus).
                Puoi rilanciare il batch più volte fino a esaurimento coda.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border bg-surface px-3 py-2">
              <div className="text-xs text-muted-foreground">In coda</div>
              <div className="font-mono text-lg">{queueStats?.queue.pending ?? "—"}</div>
            </div>
            <div className="rounded-md border bg-surface px-3 py-2">
              <div className="text-xs text-muted-foreground">Importate</div>
              <div className="font-mono text-lg">{queueStats?.queue.done ?? "—"}</div>
            </div>
            <div className="rounded-md border bg-surface px-3 py-2">
              <div className="text-xs text-muted-foreground">Già presenti</div>
              <div className="font-mono text-lg">{queueStats?.queue.skipped ?? "—"}</div>
            </div>
            <div className="rounded-md border bg-surface px-3 py-2">
              <div className="text-xs text-muted-foreground">Errori</div>
              <div className="font-mono text-lg">{queueStats?.queue.error ?? "—"}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Totale URL accodati: <strong>{queueStats?.queueTotal ?? "—"}</strong> · Atti INPS nel corpus:{" "}
            <strong>{queueStats?.sourcesInpsTotal ?? "—"}</strong>
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="yf" className="text-xs">Anno da</Label>
              <Input id="yf" type="number" min={1995} max={yearTo} value={yearFrom}
                onChange={(e) => setYearFrom(Number(e.target.value) || 1999)} className="w-24" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yt" className="text-xs">Anno a</Label>
              <Input id="yt" type="number" min={yearFrom} max={2100} value={yearTo}
                onChange={(e) => setYearTo(Number(e.target.value) || new Date().getFullYear())} className="w-24" />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={discovering}
              onClick={async () => {
                setDiscovering(true);
                setDiscoverResult(null);
                try {
                  const r = await runDiscover({ data: { yearFrom, yearTo } });
                  setDiscoverResult(
                    `Scoperti ${r.discovered} URL · ${r.enqueued} nuovi accodati (anni ${r.yearFrom}–${r.yearTo})${r.errors.length ? ` · ${r.errors.length} errori` : ""}`,
                  );
                  await refetchQueueStats();
                } catch (e) {
                  setDiscoverResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setDiscovering(false);
                }
              }}
              className="gap-1.5"
            >
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseIcon className="h-4 w-4" />}
              {discovering ? "Discovery in corso…" : "1) Discovery URL"}
            </Button>

            <div className="ml-auto flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bs" className="text-xs">Batch totale</Label>
                <Input id="bs" type="number" min={1} max={2000} value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(2000, Number(e.target.value) || 200)))} className="w-24" />
              </div>
              {batching ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { stopBatchRef.current = true; }}
                  className="gap-1.5"
                >
                  Ferma
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={batching || (queueStats?.queue.pending ?? 0) === 0}
                onClick={async () => {
                  setBatching(true);
                  setBatchResult(null);
                  stopBatchRef.current = false;
                  const totals = { processed: 0, created: 0, skipped: 0, failed: 0 };
                  setBatchProgress({ ...totals });
                  const CHUNK = 20;
                  try {
                    while (totals.processed < batchSize && !stopBatchRef.current) {
                      const remaining = batchSize - totals.processed;
                      const limit = Math.min(CHUNK, remaining);
                      const r = await runBatch({ data: { limit } });
                      totals.processed += r.processed;
                      totals.created += r.created;
                      totals.skipped += r.skipped;
                      totals.failed += r.failed;
                      setBatchProgress({ ...totals });
                      await refetchQueueStats();
                      if (r.processed === 0) break; // coda vuota
                    }
                    setBatchResult(
                      `Batch ${stopBatchRef.current ? "fermato" : "completato"}: ${totals.processed} URL · ${totals.created} nuovi · ${totals.skipped} già presenti · ${totals.failed} errori. Ricorda di lanciare "Aggiorna indice" quando hai finito.`,
                    );
                  } catch (e) {
                    setBatchResult(`Interrotto a ${totals.processed}/${batchSize}. Errore: ${(e as Error).message}`);
                  } finally {
                    setBatching(false);
                  }
                }}
                className="gap-1.5"
              >
                {batching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                {batching
                  ? `Batch ${batchProgress?.processed ?? 0}/${batchSize}…`
                  : "2) Importa prossimo batch"}
              </Button>
            </div>
          </div>

          {discoverResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{discoverResult}</div>
          )}
          {batchResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{batchResult}</div>
          )}
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
                  let totalProcessed = 0;
                  let lastTotal = 0;
                  let lastSkipped = 0;
                  for (let i = 0; i < 200; i++) {
                    const r = await runIngest();
                    totalProcessed += r.processed;
                    lastTotal = r.total;
                    lastSkipped = r.skipped;
                    setIngestResult(
                      `Indicizzazione in corso… ${totalProcessed} nuovi, ${r.remaining} rimanenti (totale corpus ${r.total})`,
                    );
                    if (r.processed === 0 || r.remaining === 0) break;
                  }
                  setIngestResult(
                    `Indicizzati ${totalProcessed} nuovi atti · totali ${lastTotal} · già indicizzati ${lastSkipped}`,
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

        {/* Corpus sources list */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold">Fonti nel corpus</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {sourcesByIngestion?.length ?? 0} fonti ordinate per data di aggiunta (più recente in alto).
              </p>
            </div>
          </div>
          <div className="mt-4 max-h-96 overflow-auto rounded-md border">
            {sourcesByIngestionLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento fonti…
              </div>
            ) : !sourcesByIngestion || sourcesByIngestion.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nessuna fonte nel corpus.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Titolo</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">N.</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data atto</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Aggiunto il</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sourcesByIngestion.map((s) => (
                    <tr key={s.id} className="hover:bg-surface/50">
                      <td className="px-4 py-2">
                        <a
                          href={s.official_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline line-clamp-1"
                          title={s.title ?? ""}
                        >
                          {s.title ?? "—"}
                        </a>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{TYPE_LABEL[s.source_type as keyof typeof TYPE_LABEL] ?? s.source_type}</td>
                      <td className="px-4 py-2 whitespace-nowrap font-mono text-muted-foreground">{s.document_number ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {s.publication_date
                          ? new Date(s.publication_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {s.ingested_at
                          ? new Date(s.ingested_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
