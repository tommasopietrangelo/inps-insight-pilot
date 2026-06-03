import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Brain,
  BookOpen,
  FolderOpen,
  Lightbulb,
  User,
  Users,
  Search,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_appshell/memory")({
  head: () => ({
    meta: [
      { title: "Memoria AI · INPS Copilot" },
      {
        name: "description",
        content:
          "Memoria AI: l'assistente apprende da normative, pratiche e casi gestiti dal tuo studio.",
      },
    ],
  }),
  component: MemoryPage,
});

type LevelId = "normativa" | "pratiche" | "casi" | "operatore" | "studio";

interface MemoryItem {
  title: string;
  meta: string;
  detail?: string;
  tag?: string;
}

interface Level {
  id: LevelId;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof BookOpen;
  accent: string;
  stats: { label: string; value: string }[];
  insight: string;
  items: MemoryItem[];
  highlight?: boolean;
}

const LEVELS: Level[] = [
  {
    id: "normativa",
    title: "Memoria Normativa",
    subtitle: "Fonti consultate automaticamente memorizzate",
    description:
      "Memorizza automaticamente le fonti consultate più spesso dal tuo studio: circolari, messaggi, FAQ e atti citati nelle risposte.",
    icon: BookOpen,
    accent: "from-sky-500/20 to-sky-500/5 text-sky-600",
    stats: [
      { label: "Fonti memorizzate", value: "1.284" },
      { label: "Consultazioni / 30 gg", value: "612" },
      { label: "Citazioni nelle risposte", value: "1.097" },
    ],
    insight:
      "Negli ultimi 30 giorni il tuo studio ha consultato 47 volte la Circolare INPS 23/2022 sull'Assegno Unico.",
    items: [
      {
        title: "Circolare INPS 23/2022 — Assegno Unico e Universale",
        meta: "Consultata 47 volte · ultima oggi",
        tag: "Top fonte",
      },
      {
        title: "Messaggio INPS 1430/2024 — ADI requisiti",
        meta: "Consultata 31 volte · ultima ieri",
      },
      {
        title: "Circolare INPS 105/2023 — NASpI durata",
        meta: "Consultata 22 volte · ultima 3 giorni fa",
      },
      {
        title: "FAQ Pensione di vecchiaia",
        meta: "Utilizzata 18 volte · ultima 5 giorni fa",
      },
    ],
  },
  {
    id: "pratiche",
    title: "Memoria Pratiche",
    subtitle: "Categorie e procedure più frequenti",
    description:
      "Analizza e memorizza i tipi di pratiche gestite nel tempo. Nessun dato personale: solo categoria, normativa, procedura ed esito.",
    icon: FolderOpen,
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-600",
    stats: [
      { label: "Categorie attive", value: "14" },
      { label: "Pratiche tracciate", value: "812" },
      { label: "Procedure standard", value: "27" },
    ],
    insight: "Hai già gestito 84 pratiche simili a quella aperta oggi.",
    items: [
      { title: "Assegno Unico e Universale", meta: "214 pratiche · esito positivo 92%", tag: "Frequente" },
      { title: "ADI — Assegno di Inclusione", meta: "168 pratiche · esito positivo 78%" },
      { title: "NASpI", meta: "121 pratiche · esito positivo 96%" },
      { title: "Pensione di vecchiaia", meta: "84 pratiche · esito positivo 88%" },
      { title: "Invalidità civile", meta: "63 pratiche · in attesa 19%" },
      { title: "SFL — Supporto Formazione Lavoro", meta: "47 pratiche · esito positivo 71%" },
    ],
  },
  {
    id: "casi",
    title: "Memoria Casi Particolari",
    subtitle: "Eccezioni, interpretazioni e soluzioni operative",
    description:
      "Conserva automaticamente i casi particolari e le situazioni fuori standard: eccezioni normative, interpretazioni operative e problematiche risolte.",
    icon: Lightbulb,
    accent: "from-amber-500/20 to-amber-500/5 text-amber-600",
    stats: [
      { label: "Casi particolari", value: "56" },
      { label: "Soluzioni applicate", value: "184" },
      { label: "Riusi negli ultimi 90 gg", value: "37" },
    ],
    insight: "Sono stati trovati 12 casi simili negli ultimi 18 mesi.",
    highlight: true,
    items: [
      {
        title: "Assegno Unico con figli all'estero UE",
        meta: "Eccezione · Circ. 23/2022 §4 · 8 riusi",
        detail:
          "Riconoscimento parziale in presenza di reddito estero non dichiarato in DSU. Soluzione: integrazione ISEE corrente.",
        tag: "Alta rilevanza",
      },
      {
        title: "ADI — nucleo con disabile grave non convivente",
        meta: "Interpretazione operativa · Msg. 1430/2024 · 5 riusi",
        detail:
          "Verifica scala di equivalenza con allegato medico. Sede competente conferma applicazione coefficiente maggiorato.",
      },
      {
        title: "NASpI dopo dimissioni per giusta causa",
        meta: "Caso complesso · Circ. 94/2015 · 4 riusi",
        detail:
          "Documentazione integrativa richiesta: copia denuncia o lettera dimissioni motivate. Esito positivo in 4/4 casi.",
      },
    ],
  },
  {
    id: "operatore",
    title: "Memoria Operatore",
    subtitle: "Profilo personale dell'utente",
    description:
      "Personalizza l'assistente in base alle abitudini di lavoro dell'operatore: modalità di risposta, livello di dettaglio, fonti e argomenti preferiti.",
    icon: User,
    accent: "from-violet-500/20 to-violet-500/5 text-violet-600",
    stats: [
      { label: "Sessioni analizzate", value: "1.420" },
      { label: "Argomenti ricorrenti", value: "9" },
      { label: "Suggerimenti attivi", value: "6" },
    ],
    insight:
      "L'operatore preferisce risposte sintetiche con citazione diretta della fonte.",
    items: [
      { title: "Stile di risposta", meta: "Sintetico · bullet point · citazione [n]", tag: "Profilo" },
      { title: "Livello di dettaglio", meta: "Medio — focus su requisiti e scadenze" },
      { title: "Fonti preferite", meta: "Circolari INPS · Messaggi · FAQ ufficiali" },
      { title: "Argomenti più frequenti", meta: "Assegno Unico · ADI · NASpI" },
    ],
  },
  {
    id: "studio",
    title: "Memoria Collettiva Studio",
    subtitle: "Conoscenza condivisa dell'intero team",
    description:
      "Trasforma l'esperienza dell'intero studio in una base di conoscenza condivisa: casi risolti, procedure interne e buone pratiche.",
    icon: Users,
    accent: "from-rose-500/20 to-rose-500/5 text-rose-600",
    stats: [
      { label: "Operatori contributori", value: "8" },
      { label: "Soluzioni condivise", value: "146" },
      { label: "Procedure interne", value: "32" },
    ],
    insight: "Questa soluzione è già stata adottata da altri 3 operatori dello studio.",
    items: [
      {
        title: "Checklist standard ADI — Studio Rossi",
        meta: "Procedura interna · 12 utilizzi · autore: Marta",
        tag: "Best practice",
      },
      {
        title: "Modello richiesta integrazione ISEE corrente",
        meta: "Template condiviso · 27 utilizzi",
      },
      {
        title: "Flusso NASpI con dimissioni per giusta causa",
        meta: "Procedura · 9 utilizzi · 4 operatori",
      },
    ],
  },
];

function MemoryPage() {
  const [active, setActive] = useState<LevelId>("normativa");
  const [query, setQuery] = useState("");

  const activeLevel = useMemo(
    () => LEVELS.find((l) => l.id === active)!,
    [active],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeLevel.items;
    return activeLevel.items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.meta.toLowerCase().includes(q) ||
        (it.detail ?? "").toLowerCase().includes(q),
    );
  }, [activeLevel, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Funzione Premium
                </p>
                <Badge className="gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-500 hover:to-orange-500">
                  <Sparkles className="h-3 w-3" /> PRO
                </Badge>
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold">Memoria AI</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Una memoria professionale che apprende da normative, pratiche e casi gestiti dal
                tuo studio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Ultimo aggiornamento: oggi
          </div>
        </div>

        {/* Global KPIs */}
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Elementi memorizzati", value: "2.341", icon: Brain },
            { label: "Casi risolti", value: "184", icon: Lightbulb },
            { label: "Precedenti rilevanti", value: "56", icon: Sparkles },
            { label: "Crescita / 30 gg", value: "+12%", icon: TrendingUp },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg border bg-background/70 p-4 backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </span>
                <k.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="mt-1.5 font-display text-2xl font-semibold">{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Levels */}
      <Tabs value={active} onValueChange={(v) => setActive(v as LevelId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-surface p-1">
          {LEVELS.map((l) => (
            <TabsTrigger
              key={l.id}
              value={l.id}
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <l.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{l.title.replace("Memoria ", "")}</span>
              <span className="sm:hidden">{l.title.split(" ").pop()}</span>
              {l.highlight && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {LEVELS.map((level) => (
          <TabsContent key={level.id} value={level.id} className="mt-5 space-y-4">
            {/* Level header */}
            <Card
              className={cn(
                "overflow-hidden p-5",
                level.highlight && "border-amber-500/40 ring-1 ring-amber-500/20",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br",
                      level.accent,
                    )}
                  >
                    <level.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">{level.title}</h2>
                      {level.highlight && (
                        <Badge className="rounded-sm bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                          Massimo valore
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{level.subtitle}</p>
                    <p className="mt-2 max-w-2xl text-sm">{level.description}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {level.stats.map((s) => (
                  <div key={s.label} className="rounded-md border bg-surface px-4 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="mt-1 font-display text-xl font-semibold">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Insight */}
              <div className="mt-4 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-primary">
                    Insight automatico
                  </div>
                  <div className="mt-0.5 text-foreground">{level.insight}</div>
                </div>
              </div>
            </Card>

            {/* Search + items */}
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="font-display text-sm font-semibold">
                  Cronologia & elementi memorizzati
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca nella memoria…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>

              <div className="divide-y">
                {filteredItems.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nessun elemento corrisponde alla ricerca.
                  </div>
                )}
                {filteredItems.map((it, i) => (
                  <div
                    key={i}
                    className="group flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{it.title}</span>
                        {it.tag && (
                          <Badge variant="secondary" className="rounded-sm text-[10px]">
                            {it.tag}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{it.meta}</div>
                      {it.detail && (
                        <div className="mt-1.5 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
                          {it.detail}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Future roadmap teaser */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed bg-surface/60 p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 text-primary" />
          <div>
            <div className="font-medium text-foreground">In arrivo</div>
            Vector database, RAG semantico e agenti AI autonomi sulla tua memoria di studio.
          </div>
        </div>
        <Button variant="outline" size="sm" disabled>
          Roadmap Pro
        </Button>
      </Card>
    </div>
  );
}
