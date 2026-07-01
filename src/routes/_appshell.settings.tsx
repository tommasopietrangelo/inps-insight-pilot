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
  repairEmptyInpsFullText,
  getInpsErrorBreakdown,
  retryInpsErrors,
  rebuildInpsTitles,
  testFirecrawlConnection,
} from "@/lib/inps-firecrawl.functions";
import {
  discoverInpsSection,
  processInpsSectionBatch,
  getInpsSectionsStats,
} from "@/lib/inps-operational.functions";
import {
  discoverInpsNews,
  batchIngestNews,
  getNewsQueueStats,
} from "@/lib/inps-news.functions";

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
import { Sparkles, Loader2, Download, Rss, ClipboardPaste, Flame, BookMarked, Layers, Newspaper } from "lucide-react";
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
  const runTestFirecrawl = useServerFn(testFirecrawlConnection);
  const [testingFc, setTestingFc] = useState(false);
  const [fcTestResult, setFcTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
  const runRepair = useServerFn(repairEmptyInpsFullText);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const { data: queueStats, refetch: refetchQueueStats } = useQuery({
    queryKey: ["inps-queue-stats"],
    queryFn: () => fetchQueueStats(),
  });

  // Recupero errori coda
  const fetchErrorBreakdown = useServerFn(getInpsErrorBreakdown);
  const runRetryErrors = useServerFn(retryInpsErrors);
  const { data: errorBreakdown, refetch: refetchErrorBreakdown } = useQuery({
    queryKey: ["inps-error-breakdown"],
    queryFn: () => fetchErrorBreakdown(),
  });
  const [retrying, setRetrying] = useState<null | "all" | "credits" | "transient" | "other">(null);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  // Rigenera titoli con "oggetto"
  const runRebuildTitles = useServerFn(rebuildInpsTitles);
  const [rebuildingTitles, setRebuildingTitles] = useState(false);
  const [rebuildTitlesResult, setRebuildTitlesResult] = useState<string | null>(null);


  // Layer operativo per-sezione (controllo manuale dalle Impostazioni)
  const runOpDiscover = useServerFn(discoverInpsSection);
  const runOpBatch = useServerFn(processInpsSectionBatch);
  const fetchOpStats = useServerFn(getInpsSectionsStats);
  const [opBusySection, setOpBusySection] = useState<string | null>(null);
  const [opBusyMode, setOpBusyMode] = useState<"discover" | "batch" | null>(null);
  const [opSectionMsg, setOpSectionMsg] = useState<Record<string, string>>({});
  const [opBatchSize, setOpBatchSize] = useState(100);
  type DiscoveryReport = {
    totalLinksSeen: number; matched: number; ignored: number;
    inCorpus: number; newEnqueued: number; seedUrls: number; fromEntryScrape: number;
    at: string;
  };
  const [opReports, setOpReports] = useState<Record<string, DiscoveryReport>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("inps-op-discovery-reports") || "{}"); } catch { return {}; }
  });
  const saveReport = (id: string, r: DiscoveryReport) => {
    setOpReports((prev) => {
      const next = { ...prev, [id]: r };
      try { localStorage.setItem("inps-op-discovery-reports", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const { data: opStats, refetch: refetchOpStats } = useQuery({
    queryKey: ["inps-op-sections-stats"],
    queryFn: () => fetchOpStats(),
  });

  // Notizie INPS (sezione dedicata)
  const runNewsDiscover = useServerFn(discoverInpsNews);
  const runNewsBatch = useServerFn(batchIngestNews);
  const fetchNewsStats = useServerFn(getNewsQueueStats);
  const { data: newsStats, refetch: refetchNewsStats } = useQuery({
    queryKey: ["inps-news-stats"],
    queryFn: () => fetchNewsStats(),
  });
  const [newsBusy, setNewsBusy] = useState<"discover" | "batch" | null>(null);
  const [newsMsg, setNewsMsg] = useState<string | null>(null);
  const [newsBatchSize, setNewsBatchSize] = useState(200);




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
              <Input id="yf" type="number" min={1969} max={yearTo} value={yearFrom}
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

          <Separator className="my-5" />
          <div className="space-y-3">
            <div className="max-w-2xl text-sm">
              <div className="font-medium">2bis) Recupero errori coda</div>
              <div className="text-muted-foreground">
                Resetta a <code>pending</code> gli URL falliti così il prossimo batch li riprocessa.
                Utile dopo aver ricaricato i crediti Firecrawl o quando un picco di rate-limit ha
                lasciato indietro molte righe.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">Totale errori: {errorBreakdown?.total ?? "—"}</Badge>
              <Badge variant="outline">Crediti esauriti (402): {errorBreakdown?.credits ?? "—"}</Badge>
              <Badge variant="outline">Transitori (429/timeout/5xx): {errorBreakdown?.transient ?? "—"}</Badge>
              <Badge variant="outline">Altri: {errorBreakdown?.other ?? "—"}</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchErrorBreakdown()}
                className="h-7 px-2"
              >
                Aggiorna
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["credits", "transient", "other", "all"] as const).map((scope) => {
                const count =
                  scope === "credits"
                    ? errorBreakdown?.credits
                    : scope === "transient"
                      ? errorBreakdown?.transient
                      : scope === "other"
                        ? errorBreakdown?.other
                        : errorBreakdown?.total;
                const label =
                  scope === "credits"
                    ? "Riprova errori da crediti"
                    : scope === "transient"
                      ? "Riprova errori transitori"
                      : scope === "other"
                        ? "Riprova altri errori"
                        : "Riprova TUTTI gli errori";
                const variant = scope === "all" ? "outline" : "default";
                return (
                  <Button
                    key={scope}
                    size="sm"
                    variant={variant as any}
                    disabled={retrying !== null || !count}
                    onClick={async () => {
                      if (scope === "all" && !confirm("Resettare TUTTI gli errori a pending?")) return;
                      setRetrying(scope);
                      setRetryResult(null);
                      try {
                        const r = await runRetryErrors({ data: { scope } });
                        setRetryResult(
                          `Resettati ${r.reset} URL (${scope}) → ora sono pending. Lancia "Importa prossimo batch" per riprocessarli.`,
                        );
                        await Promise.all([refetchErrorBreakdown(), refetchQueueStats()]);
                      } catch (e) {
                        setRetryResult(`Errore: ${(e as Error).message}`);
                      } finally {
                        setRetrying(null);
                      }
                    }}
                    className="gap-1.5"
                  >
                    {retrying === scope ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Flame className="h-4 w-4" />
                    )}
                    {label} {count ? `(${count})` : ""}
                  </Button>
                );
              })}
            </div>
            {retryResult && (
              <div className="rounded-md border bg-surface px-4 py-3 text-sm">{retryResult}</div>
            )}
          </div>

          <Separator className="my-5" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl text-sm">
              <div className="font-medium">3) Ripara atti con testo vuoto</div>
              <div className="text-muted-foreground">
                Per i vecchi atti la pagina HTML non contiene testo: scarica il PDF allegato e
                ne estrae il contenuto. 1 credito Firecrawl per atto riparato.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={repairing}
              onClick={async () => {
                setRepairing(true);
                setRepairResult(null);
                try {
                  const r = await runRepair({ data: { limit: 10, minLength: 400 } });
                  setRepairResult(
                    `Riparati ${r.repaired}/${r.candidates} atti · ${r.stillEmpty} senza PDF utile · ${r.failed} errori. Lancia "Aggiorna indice" per re-embeddare.`,
                  );
                } catch (e) {
                  setRepairResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setRepairing(false);
                }
              }}
              className="gap-1.5"
            >
              {repairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {repairing ? "Riparazione…" : "Ripara 10 atti"}
            </Button>
          </div>
          {repairResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{repairResult}</div>
          )}

          <Separator className="my-5" />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl text-sm">
              <div className="font-medium">4) Rigenera titoli con "oggetto"</div>
              <div className="text-muted-foreground">
                Riscrive i titoli di circolari/messaggi/decreti già nel corpus aggiungendo l'oggetto
                estratto dal testo (es. <em>"Circolare n. 109 del 09-12-2008 — Novità bonus mamme"</em>).
                Non consuma crediti Firecrawl: usa solo il testo già salvato. Idempotente,
                lo puoi rilanciare in sicurezza.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={rebuildingTitles}
              onClick={async () => {
                setRebuildingTitles(true);
                setRebuildTitlesResult(null);
                try {
                  const r = await runRebuildTitles({ data: { limit: 5000, onlyGeneric: true } });
                  const ex = r.samples.length
                    ? ` Esempi: ${r.samples.map((s) => `"${s.after}"`).slice(0, 2).join(" · ")}`
                    : "";
                  setRebuildTitlesResult(
                    `Esaminati ${r.scanned} · aggiornati ${r.changed} · senza oggetto ${r.noOggetto} · invariati ${r.skipped}.${ex}`,
                  );
                } catch (e) {
                  setRebuildTitlesResult(`Errore: ${(e as Error).message}`);
                } finally {
                  setRebuildingTitles(false);
                }
              }}
              className="gap-1.5"
            >
              {rebuildingTitles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Rigenera titoli con oggetto
            </Button>
          </div>
          {rebuildTitlesResult && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{rebuildTitlesResult}</div>
          )}
        </Card>


        {/* Notizie INPS — discovery + batch dedicato per /inps-comunica/notizie/ */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Newspaper className="h-4 w-4 text-primary" /> Notizie INPS · /inps-comunica/notizie
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Discovery via Firecrawl <code>map</code> sulla landing notizie di inps.it
                (~3000 articoli storici), filtra i link con pattern <code>/notizie/...html</code> e li accoda.
                Poi <strong>Batch</strong> esegue scrape + upsert in corpus con <code>source_type = notizia</code>.
                Costi a carico dei crediti Firecrawl (non Lovable). Dedup automatico per URL.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="news-bs" className="text-xs">Batch totale</Label>
                <Input id="news-bs" type="number" min={1} max={3000} value={newsBatchSize}
                  onChange={(e) => setNewsBatchSize(Math.max(1, Math.min(3000, Number(e.target.value) || 200)))} className="w-24" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="font-mono">notizie in corpus {newsStats?.corpusTotal ?? "—"}</Badge>
            <Badge variant="outline" className="font-mono">coda totale {newsStats?.total ?? 0}</Badge>
            <Badge variant="outline" className="font-mono">pend {newsStats?.pending ?? 0}</Badge>
            <Badge variant="outline" className="font-mono">ok {newsStats?.done ?? 0}</Badge>
            <Badge variant="outline" className="font-mono">dup {newsStats?.skipped ?? 0}</Badge>
            <Badge variant="outline" className="font-mono">err {newsStats?.error ?? 0}</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={newsBusy !== null}
              onClick={async () => {
                setNewsBusy("discover");
                setNewsMsg("Discovery in corso (può richiedere 30–60s)…");
                try {
                  const r = await runNewsDiscover({ data: { limit: 5000 } });
                  setNewsMsg(
                    `Discovery completata: trovati ${r.totalLinksSeen} link · match ${r.matched} · già in corpus ${r.inCorpus} · nuovi accodati ${r.newEnqueued}${r.errors.length ? ` · ${r.errors.length} errori` : ""}.`,
                  );
                  await refetchNewsStats();
                } catch (e) {
                  setNewsMsg(`Errore discovery: ${(e as Error).message}`);
                } finally {
                  setNewsBusy(null);
                }
              }}
              className="gap-1.5"
            >
              {newsBusy === "discover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />}
              Discovery notizie
            </Button>
            <Button
              size="sm"
              disabled={newsBusy !== null || (newsStats?.pending ?? 0) === 0}
              onClick={async () => {
                setNewsBusy("batch");
                const totals = { processed: 0, created: 0, skipped: 0, failed: 0 };
                const CHUNK = 20;
                try {
                  while (totals.processed < newsBatchSize) {
                    const remaining = newsBatchSize - totals.processed;
                    const limit = Math.min(CHUNK, remaining);
                    const r = await runNewsBatch({ data: { limit, concurrency: 4 } });
                    totals.processed += r.processed;
                    totals.created += r.created;
                    totals.skipped += r.skipped;
                    totals.failed += r.failed;
                    setNewsMsg(
                      `Batch ${totals.processed}/${newsBatchSize} · nuovi ${totals.created} · dup ${totals.skipped} · err ${totals.failed} · ${r.remaining} ancora pendenti`,
                    );
                    await refetchNewsStats();
                    if (r.processed === 0) break;
                  }
                  setNewsMsg(
                    `Batch completato: ${totals.processed} URL · ${totals.created} nuovi · ${totals.skipped} già presenti · ${totals.failed} errori. Lancia "Aggiorna indice" per gli embedding.`,
                  );
                } catch (e) {
                  setNewsMsg(`Errore batch a ${totals.processed}: ${(e as Error).message}`);
                } finally {
                  setNewsBusy(null);
                }
              }}
              className="gap-1.5"
            >
              {newsBusy === "batch" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
              Esegui batch
            </Button>
          </div>

          {newsMsg && (
            <div className="mt-3 rounded-md border bg-surface px-4 py-3 text-sm">{newsMsg}</div>
          )}
        </Card>

        {/* Layer OPERATIVO per-sezione: discovery + batch indipendenti */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Layers className="h-4 w-4 text-primary" /> Layer operativo INPS · per sezione
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Per ogni sezione top-level di inps.it lancia <strong>Discovery</strong> (Firecrawl `map` su entry-point + base con keyword,
                filtra i link nel path della sezione) e poi <strong>Batch</strong> (scrape + upsert nel corpus, dedup automatico).
                Stats indipendenti per sezione così vedi quante sottosezioni Firecrawl è riuscito a scoprire e importare.
                Lo scraping ricorrente è disattivato: si lancia manualmente da qui.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="op-bs" className="text-xs">Batch totale / sezione</Label>
                <Input id="op-bs" type="number" min={1} max={2000} value={opBatchSize}
                  onChange={(e) => setOpBatchSize(Math.max(1, Math.min(2000, Number(e.target.value) || 100)))} className="w-24" />
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Pagine operative nel corpus: <strong>{opStats?.sourcesOpTotal ?? "—"}</strong>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            {(opStats?.sections ?? []).map((sec) => {
              const stats = opStats?.perSection[sec.id] ?? { pending: 0, done: 0, skipped: 0, error: 0, total: 0 };
              const busy = opBusySection === sec.id;
              const msg = opSectionMsg[sec.id];
              const report = opReports[sec.id];
              return (
                <div key={sec.id} className="rounded-md border bg-surface px-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{sec.label}</div>
                      <a href={sec.entryUrl} target="_blank" rel="noreferrer"
                        className="truncate text-xs text-muted-foreground hover:underline">
                        {sec.entryUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">scoperti {stats.total}</Badge>
                      <Badge variant="outline" className="font-mono">pend {stats.pending}</Badge>
                      <Badge variant="outline" className="font-mono">ok {stats.done}</Badge>
                      <Badge variant="outline" className="font-mono">dup {stats.skipped}</Badge>
                      <Badge variant="outline" className="font-mono">err {stats.error}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setOpBusySection(sec.id);
                          setOpBusyMode("discover");
                          setOpSectionMsg((m) => ({ ...m, [sec.id]: "Discovery…" }));
                          try {
                            const r = await runOpDiscover({ data: { section: sec.id, limit: 500 } });
                            saveReport(sec.id, {
                              totalLinksSeen: r.totalLinksSeen,
                              matched: r.matched,
                              ignored: r.ignored,
                              inCorpus: r.inCorpus,
                              newEnqueued: r.newEnqueued,
                              seedUrls: r.seedUrls,
                              fromEntryScrape: r.fromEntryScrape,
                              at: new Date().toISOString(),
                            });
                            setOpSectionMsg((m) => ({
                              ...m,
                              [sec.id]: `Discovery completata${r.errors.length ? ` · ${r.errors.length} errori` : ""}`,
                            }));
                            await refetchOpStats();
                          } catch (e) {
                            setOpSectionMsg((m) => ({ ...m, [sec.id]: `Errore discovery: ${(e as Error).message}` }));
                          } finally {
                            setOpBusySection(null);
                            setOpBusyMode(null);
                          }
                        }}
                        className="gap-1.5"
                      >
                        {busy && opBusyMode === "discover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                        Discovery
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy || stats.pending === 0}
                        onClick={async () => {
                          setOpBusySection(sec.id);
                          setOpBusyMode("batch");
                          const totals = { processed: 0, created: 0, skipped: 0, failed: 0 };
                          const CHUNK = 15;
                          try {
                            while (totals.processed < opBatchSize) {
                              const remaining = opBatchSize - totals.processed;
                              const limit = Math.min(CHUNK, remaining);
                              const r = await runOpBatch({ data: { section: sec.id, limit, concurrency: 4 } });
                              totals.processed += r.processed;
                              totals.created += r.created;
                              totals.skipped += r.skipped;
                              totals.failed += r.failed;
                              setOpSectionMsg((m) => ({
                                ...m,
                                [sec.id]: `Batch ${totals.processed}/${opBatchSize} · nuovi ${totals.created} · dup ${totals.skipped} · err ${totals.failed}`,
                              }));
                              await refetchOpStats();
                              if (r.processed === 0) break;
                            }
                            setOpSectionMsg((m) => ({
                              ...m,
                              [sec.id]: `Batch completato: ${totals.processed} URL · ${totals.created} nuovi · ${totals.skipped} già presenti · ${totals.failed} errori. Lancia "Aggiorna indice".`,
                            }));
                          } catch (e) {
                            setOpSectionMsg((m) => ({ ...m, [sec.id]: `Errore batch a ${totals.processed}: ${(e as Error).message}` }));
                          } finally {
                            setOpBusySection(null);
                            setOpBusyMode(null);
                          }
                        }}
                        className="gap-1.5"
                      >
                        {busy && opBusyMode === "batch" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
                        Batch
                      </Button>
                    </div>
                  </div>
                  {report && (
                    <div className="mt-2 rounded border bg-background/50 px-2.5 py-2 text-xs">
                      <div className="mb-1 font-medium text-foreground/80">
                        Ultima discovery · {new Date(report.at).toLocaleString("it-IT")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="font-mono">trovati {report.totalLinksSeen}</Badge>
                        <Badge variant="secondary" className="font-mono">match {report.matched}</Badge>
                        <Badge variant="secondary" className="font-mono text-emerald-700 dark:text-emerald-400">nuovi {report.newEnqueued}</Badge>
                        <Badge variant="secondary" className="font-mono">già in corpus {report.inCorpus}</Badge>
                        <Badge variant="secondary" className="font-mono text-muted-foreground">ignorati {report.ignored}</Badge>
                        {report.seedUrls > 0 && (
                          <Badge variant="outline" className="font-mono">seed {report.seedUrls}</Badge>
                        )}
                        {report.fromEntryScrape > 0 && (
                          <Badge variant="outline" className="font-mono">da entry {report.fromEntryScrape}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {msg && (
                    <div className="mt-2 text-xs text-muted-foreground">{msg}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>


        {/* Test connessione Firecrawl */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-display text-base font-semibold">
                <Flame className="h-4 w-4 text-primary" /> Test connessione Firecrawl
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifica che l'API key sia valida e che ci siano crediti disponibili
                (chiama <code>/team/credit-usage</code>, non consuma crediti).
                Usalo se i batch falliscono con errori 402 o 401.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={testingFc}
              onClick={async () => {
                setTestingFc(true);
                setFcTestResult(null);
                try {
                  const r = await runTestFirecrawl({});
                  if (r.ok) {
                    const parts: string[] = ["Connessione OK."];
                    if (r.remainingCredits !== null) {
                      parts.push(`Crediti residui: ${r.remainingCredits.toLocaleString("it-IT")}${r.planCredits ? ` / ${r.planCredits.toLocaleString("it-IT")}` : ""}.`);
                    } else {
                      parts.push("Crediti disponibili (dettaglio non fornito dall'API).");
                    }
                    setFcTestResult({ ok: true, msg: parts.join(" ") });
                  } else {
                    setFcTestResult({ ok: false, msg: r.error });
                  }
                } catch (e) {
                  setFcTestResult({ ok: false, msg: (e as Error).message });
                } finally {
                  setTestingFc(false);
                }
              }}
              className="gap-1.5"
            >
              {testingFc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {testingFc ? "Test in corso…" : "Testa connessione"}
            </Button>
          </div>
          {fcTestResult && (
            <div
              className={`mt-3 rounded-md border px-4 py-3 text-sm ${
                fcTestResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {fcTestResult.msg}
            </div>
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
