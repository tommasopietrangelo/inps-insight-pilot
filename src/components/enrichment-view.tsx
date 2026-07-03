import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Download, BookOpen, Sparkles, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EnrichResult, EnrichSuggestion } from "@/lib/analyze.functions";
import { downloadAsPdf, downloadAsDocx } from "@/lib/doc-io";

type SegKind = "text" | "annotation" | "accepted-insert" | "accepted-replace";
type Segment = {
  kind: SegKind;
  text: string;
  annIndex?: number;
  suggestionId?: string;
  originalText?: string; // per replace/delete
};

function firstIndexOf(hay: string, needle: string): number {
  if (!needle) return -1;
  const i = hay.indexOf(needle);
  if (i >= 0) return i;
  // fallback: prime 60 char
  const short = needle.slice(0, 60);
  if (short.length < 20) return -1;
  return hay.indexOf(short);
}

function findMatch(hay: string, needle: string): { start: number; end: number } | null {
  const i = hay.indexOf(needle);
  if (i >= 0) return { start: i, end: i + needle.length };
  const short = needle.slice(0, 60);
  if (short.length < 20) return null;
  const j = hay.indexOf(short);
  if (j >= 0) return { start: j, end: j + short.length };
  return null;
}

type Decision = "pending" | "accepted" | "rejected";

export function EnrichmentView({
  result,
  originalText,
  fileName,
}: {
  result: EnrichResult;
  originalText: string;
  fileName: string;
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(result.suggestions.map((s) => [s.id, "pending" as Decision])),
  );
  const [activeSourceIds, setActiveSourceIds] = useState<Set<string>>(new Set());

  // Costruisci segmenti applicando i suggerimenti accettati e annotando i passaggi.
  const segments = useMemo<Segment[]>(() => {
    // 1) parti dal testo originale, applica suggerimenti accettati (replace/delete/insert)
    // Marker approach: sostituiamo l'anchor con un placeholder unico e ricostruiamo dopo.
    type Op = {
      id: string;
      type: EnrichSuggestion["type"];
      anchor: string;
      newText?: string;
      start: number;
      end: number;
    };
    const accepted = result.suggestions.filter((s) => decisions[s.id] === "accepted");
    const ops: Op[] = [];
    for (const s of accepted) {
      const m = findMatch(originalText, s.anchor);
      if (!m) continue;
      ops.push({ id: s.id, type: s.type, anchor: s.anchor, newText: s.newText, start: m.start, end: m.end });
    }
    // ordina per posizione, elimina overlap
    ops.sort((a, b) => a.start - b.start);
    const nonOverlap: Op[] = [];
    let cursor = -1;
    for (const o of ops) {
      if (o.start >= cursor) {
        nonOverlap.push(o);
        cursor = o.end;
      }
    }

    // Costruisci una lista di parti (con tag) dopo aver applicato gli ops
    type Part = { text: string; kind: "orig" | "accepted-insert" | "accepted-replace"; suggestionId?: string; originalText?: string };
    const parts: Part[] = [];
    let idx = 0;
    for (const o of nonOverlap) {
      if (o.start > idx) parts.push({ text: originalText.slice(idx, o.start), kind: "orig" });
      if (o.type === "insert") {
        // mantieni l'anchor originale e aggiungi dopo il newText
        parts.push({ text: originalText.slice(o.start, o.end), kind: "orig" });
        if (o.newText) parts.push({ text: " " + o.newText, kind: "accepted-insert", suggestionId: o.id });
      } else if (o.type === "replace") {
        parts.push({
          text: o.newText ?? "",
          kind: "accepted-replace",
          suggestionId: o.id,
          originalText: originalText.slice(o.start, o.end),
        });
      } else if (o.type === "delete") {
        // salta il testo
      }
      idx = o.end;
    }
    if (idx < originalText.length) parts.push({ text: originalText.slice(idx), kind: "orig" });

    // 2) sui pezzi "orig" applica le annotazioni
    const segs: Segment[] = [];
    for (const p of parts) {
      if (p.kind !== "orig") {
        segs.push({
          kind: p.kind === "accepted-insert" ? "accepted-insert" : "accepted-replace",
          text: p.text,
          suggestionId: p.suggestionId,
          originalText: p.originalText,
        });
        continue;
      }
      // trova annotazioni dentro questo pezzo
      type AH = { start: number; end: number; annIndex: number };
      const hits: AH[] = [];
      result.annotations.forEach((a, i) => {
        const at = firstIndexOf(p.text, a.excerpt);
        if (at >= 0) hits.push({ start: at, end: at + a.excerpt.length, annIndex: i });
      });
      hits.sort((a, b) => a.start - b.start);
      const nonOv: AH[] = [];
      let c = -1;
      for (const h of hits) {
        if (h.start >= c) {
          nonOv.push(h);
          c = h.end;
        }
      }
      let k = 0;
      for (const h of nonOv) {
        if (h.start > k) segs.push({ kind: "text", text: p.text.slice(k, h.start) });
        segs.push({
          kind: "annotation",
          text: p.text.slice(h.start, h.end),
          annIndex: h.annIndex,
        });
        k = h.end;
      }
      if (k < p.text.length) segs.push({ kind: "text", text: p.text.slice(k) });
    }
    return segs;
  }, [originalText, result, decisions]);

  const finalText = useMemo(() => segments.map((s) => s.text).join(""), [segments]);

  // Fonti visibili nel pannello destro: filtrate se una annotation o suggerimento è selezionato
  const visibleSources = useMemo(() => {
    if (activeSourceIds.size === 0) return result.usedSources;
    return result.usedSources.filter((s) => activeSourceIds.has(s.id));
  }, [result.usedSources, activeSourceIds]);

  const pendingCount = result.suggestions.filter((s) => decisions[s.id] === "pending").length;
  const acceptedCount = result.suggestions.filter((s) => decisions[s.id] === "accepted").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="font-display text-base font-semibold">Documento arricchito</div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="mr-2 inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-primary/25 ring-1 ring-primary/40" /> collegato al corpus
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-emerald-500/25 ring-1 ring-emerald-500/40" /> aggiunta AI accettata
                </span>
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5" disabled={!finalText.trim()}>
                  <Download className="h-4 w-4" /> Scarica revisione
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    downloadAsPdf(finalText, (fileName || "documento").replace(/\.[^.]+$/, "") + "-arricchito")
                  }
                >
                  PDF (.pdf)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    downloadAsDocx(finalText, (fileName || "documento").replace(/\.[^.]+$/, "") + "-arricchito")
                  }
                >
                  Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Separator className="my-3" />
          <div className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-surface p-4 text-sm leading-relaxed">
            {segments.map((s, i) => {
              if (s.kind === "text") return <span key={i}>{s.text}</span>;
              if (s.kind === "annotation") {
                const ann = s.annIndex !== undefined ? result.annotations[s.annIndex] : undefined;
                const ids = ann?.citations.map((c) => c.sourceId).filter(Boolean) as string[];
                return (
                  <span
                    key={i}
                    onMouseEnter={() => setActiveSourceIds(new Set(ids ?? []))}
                    onMouseLeave={() => setActiveSourceIds(new Set())}
                    title={ann?.note}
                    className="cursor-help rounded bg-primary/15 px-0.5 ring-1 ring-primary/30 hover:bg-primary/25"
                  >
                    {s.text}
                  </span>
                );
              }
              // accepted-insert / accepted-replace
              return (
                <span
                  key={i}
                  className="rounded bg-emerald-500/20 px-0.5 ring-1 ring-emerald-500/40"
                  title={s.originalText ? `Sostituisce: «${s.originalText}»` : "Aggiunta AI"}
                >
                  {s.text}
                </span>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-semibold">
              Revisioni proposte dall'AI
            </div>
            <div className="text-xs text-muted-foreground">
              {acceptedCount} accettate · {pendingCount} in attesa · {result.suggestions.length} totali
            </div>
          </div>
          <Separator className="my-3" />
          {result.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna revisione proposta: il documento risulta allineato al corpus recuperato.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.suggestions.map((s) => {
                const dec = decisions[s.id];
                const typeLabel =
                  s.type === "insert" ? "Aggiunta" : s.type === "replace" ? "Riscrittura" : "Rimozione";
                const typeColor =
                  s.type === "insert"
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                    : s.type === "replace"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-destructive/10 text-destructive border-destructive/30";
                return (
                  <li
                    key={s.id}
                    className={`rounded-md border p-3 ${
                      dec === "accepted" ? "bg-emerald-500/5 border-emerald-500/30" : dec === "rejected" ? "opacity-60" : "bg-surface"
                    }`}
                    onMouseEnter={() =>
                      setActiveSourceIds(new Set(s.citations.map((c) => c.sourceId).filter(Boolean) as string[]))
                    }
                    onMouseLeave={() => setActiveSourceIds(new Set())}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`rounded-sm ${typeColor}`}>
                        {typeLabel}
                      </Badge>
                      {dec === "accepted" && (
                        <Badge variant="secondary" className="rounded-sm">Accettata</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Ancora nel documento: </span>
                        <span className="italic">«{s.anchor.slice(0, 160)}{s.anchor.length > 160 ? "…" : ""}»</span>
                      </div>
                      {s.newText && (
                        <div>
                          <span className="text-emerald-700">Testo proposto: </span>
                          <span>{s.newText}</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{s.rationale}</p>
                    {s.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.citations.map((c, j) =>
                          c.sourceId ? (
                            <Link
                              key={j}
                              to="/source/$id"
                              params={{ id: c.sourceId }}
                              className="inline-flex items-center rounded-full border bg-primary/5 px-2 py-0.5 text-[11px] hover:bg-primary/10"
                            >
                              <BookOpen className="mr-1 h-3 w-3" />
                              {c.label || "Fonte"}
                            </Link>
                          ) : (
                            <span key={j} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {c.label}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {dec !== "accepted" ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1"
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: "accepted" }))}
                        >
                          <Check className="h-3.5 w-3.5" /> Accetta
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: "pending" }))}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Annulla
                        </Button>
                      )}
                      {dec !== "rejected" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-muted-foreground"
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: "rejected" }))}
                        >
                          <X className="h-3.5 w-3.5" /> Rifiuta
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1"
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: "pending" }))}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Ripristina
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="h-fit p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <div className="font-display text-sm font-semibold">Fonti del corpus</div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeSourceIds.size > 0 ? "Fonti collegate al passaggio selezionato." : "Passa sopra un passaggio evidenziato o una revisione per filtrare."}
        </p>
        <Separator className="my-3" />
        {visibleSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna fonte associata.</p>
        ) : (
          <ul className="space-y-2">
            {visibleSources.map((s) => (
              <li key={s.id}>
                <Link
                  to="/source/$id"
                  params={{ id: s.id }}
                  className={`block rounded-md border bg-surface p-2.5 text-sm transition hover:border-primary/40 ${
                    activeSourceIds.has(s.id) ? "border-primary/60 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
                    <span className="font-mono">{s.document_number}</span>
                    <span>{s.publication_date}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-medium">{s.title}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
