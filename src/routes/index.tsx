import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Search,
  FileText,
  Bell,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Quote,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INPS Copilot — Trova la fonte INPS giusta in pochi secondi" },
      {
        name: "description",
        content:
          "Copilot AI per CAF, patronati e consulenti del lavoro. Cerca, monitora e cita circolari, messaggi e normativa INPS in linguaggio naturale.",
      },
      { property: "og:title", content: "INPS Copilot — Copilot AI per circolari e messaggi INPS" },
      {
        property: "og:description",
        content:
          "Risposte basate su fonti ufficiali INPS, monitoraggio per topic e workspace privato per il tuo studio.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-semibold">INPS Copilot</span>
          </Link>
          <nav className="hidden gap-7 text-sm text-muted-foreground md:flex">
            <a href="#prodotto" className="hover:text-foreground">Prodotto</a>
            <a href="#funzioni" className="hover:text-foreground">Funzioni</a>
            <a href="#topic" className="hover:text-foreground">Topic</a>
            <a href="#prezzi" className="hover:text-foreground">Prezzi</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">Accedi</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/dashboard">
                Prova gratis
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div className="flex flex-col justify-center">
            <Badge variant="outline" className="mb-5 w-fit gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="h-3 w-3" />
              Basato su fonti ufficiali INPS
            </Badge>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Trova la fonte INPS giusta in pochi secondi.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Il copilot AI per CAF, patronati e consulenti del lavoro. Cerca circolari,
              messaggi e normativa INPS in linguaggio naturale, con risposte sempre
              ancorate alla fonte ufficiale.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/dashboard">
                  Inizia ora
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/search">Vedi una ricerca demo</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              {[
                "Citazioni alla fonte",
                "Monitoraggio per topic",
                "Workspace privato",
                "Conforme GDPR",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-2xl" />
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Problems */}
      <section id="prodotto" className="border-b bg-surface-muted">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">Il problema</p>
            <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              Restare aggiornati sull'INPS oggi costa ore al giorno.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                t: "Troppi aggiornamenti",
                d: "Decine di circolari e messaggi al mese, sparsi tra portali, PEC e archivi.",
              },
              {
                t: "Documenti difficili da leggere",
                d: "Linguaggio normativo denso, rimandi multipli, allegati tecnici da incrociare.",
              },
              {
                t: "Interpretazioni incoerenti",
                d: "Ogni operatore arriva a risposte diverse, senza una memoria condivisa dello studio.",
              },
            ].map((p) => (
              <Card key={p.t} className="border-border/70 p-6">
                <div className="font-display text-lg font-semibold">{p.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funzioni" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">La soluzione</p>
            <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              Un copilot operativo, non un chatbot generico.
            </h2>
          </div>

          <div className="mt-14 space-y-20">
            <FeatureRow
              icon={Search}
              kicker="01 · Ricerca"
              title="Cerca in linguaggio naturale sulle fonti ufficiali INPS"
              body="Digita una domanda come 'requisiti ADI 2026 per nuclei con minori'. Il copilot interroga circolari, messaggi e normativa indicizzati ogni giorno."
              points={[
                "Indice ufficiale INPS aggiornato quotidianamente",
                "Filtri per tipo atto, periodo, topic",
                "Suggerimenti di query frequenti per area",
              ]}
              align="left"
            />
            <FeatureRow
              icon={Quote}
              kicker="02 · Risposte ancorate"
              title="Ogni risposta ha citazioni e estratti dalla fonte"
              body="Niente risposte 'a memoria'. Ogni paragrafo riporta il numero di circolare, la data e l'estratto rilevante, con link al testo ufficiale."
              points={[
                "Badge di copertura fonti su ogni risposta",
                "Estratti evidenziati nel testo originale",
                "Esportazione PDF con citazioni",
              ]}
              align="right"
            />
            <FeatureRow
              icon={Bell}
              kicker="03 · Monitoraggio"
              title="Avvisi per topic e nuovi atti pubblicati"
              body="Segui ADI, SFL, NASpI, Assegno Unico, pensioni, contributi. Ricevi solo ciò che riguarda davvero il tuo studio."
              points={[
                "Regole di avviso per topic e tipo atto",
                "Email, in-app e Slack",
                "Timeline degli aggiornamenti recenti",
              ]}
              align="left"
            />
            <FeatureRow
              icon={Briefcase}
              kicker="04 · Workspace"
              title="Memoria condivisa per il tuo ufficio"
              body="Salva ricerche, prendi note interne, costruisci la prassi dello studio. Tutto privato, tutto ricercabile."
              points={[
                "Note interne collegate alle fonti",
                "Ricerche salvate condivise",
                "Ruoli admin, operatore e sola lettura",
              ]}
              align="right"
            />
          </div>
        </div>
      </section>

      {/* Topics */}
      <section id="topic" className="border-b bg-surface-muted">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">Topic coperti</p>
              <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
                Le aree che gestisci ogni giorno.
              </h2>
            </div>
            <Layers className="hidden h-10 w-10 text-primary md:block" />
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              "ADI · Assegno di Inclusione",
              "SFL · Supporto Formazione e Lavoro",
              "NASpI",
              "Assegno Unico e Universale",
              "Pensioni e rivalutazioni",
              "ISEE precompilato",
              "Contributi e aziende",
              "Adempimenti UniEmens",
              "Domande di disoccupazione agricola",
              "Bonus assunzioni",
            ].map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="rounded-full border bg-surface px-3.5 py-1.5 text-sm font-normal"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prezzi" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">Prezzi</p>
            <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              Pensato per studi di ogni dimensione.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <PricingCard
              name="Solo"
              price="49"
              tagline="Per il professionista singolo."
              features={[
                "1 utente",
                "Ricerca illimitata",
                "Avvisi per 5 topic",
                "Note interne personali",
              ]}
            />
            <PricingCard
              name="Studio"
              price="129"
              tagline="Per CAF e patronati con team."
              featured
              features={[
                "Fino a 10 utenti",
                "Workspace condiviso",
                "Avvisi illimitati",
                "Esportazione PDF",
                "Ruoli e permessi",
              ]}
            />
            <PricingCard
              name="Enterprise"
              price="Su misura"
              tagline="Per reti nazionali e federazioni."
              features={[
                "Utenti illimitati",
                "SSO e audit log",
                "Integrazione gestionale",
                "SLA dedicato",
                "Onboarding assistito",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">
              Pronto a smettere di cercare?
            </h2>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              30 giorni di prova. Nessuna carta di credito richiesta.
            </p>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/dashboard">
              Entra in INPS Copilot
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>INPS Copilot · Strumento privato per intermediari ed esperti</span>
          </div>
          <div>© 2026 · Non affiliato a INPS</div>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  kicker,
  title,
  body,
  points,
  align,
}: {
  icon: typeof Search;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  align: "left" | "right";
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <div className={align === "right" ? "md:order-2" : ""}>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <Icon className="h-3.5 w-3.5" />
          {kicker}
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold md:text-3xl">{title}</h3>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <ul className="mt-5 space-y-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <Card className={`overflow-hidden border-border/70 bg-surface p-6 shadow-sm ${align === "right" ? "md:order-1" : ""}`}>
        <FeatureMock kind={kicker} />
      </Card>
    </div>
  );
}

function FeatureMock({ kind }: { kind: string }) {
  if (kind.includes("Ricerca")) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Nuove regole ADI 2026 per nuclei con minori</span>
        </div>
        {["Circolare n. 14/2026 — ADI", "Messaggio n. 2104/2026 — PAD", "Circolare n. 9/2026 — Pensioni"].map(
          (r, i) => (
            <div key={i} className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r}</span>
                <span>{18 - i} mag 2026</span>
              </div>
              <div className="mt-1 line-clamp-1 text-foreground">
                {"Aggiornamento dei requisiti reddituali e delle modalità di rinnovo…"}
              </div>
            </div>
          ),
        )}
      </div>
    );
  }
  if (kind.includes("Risposte")) {
    return (
      <div className="space-y-3 text-sm">
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          Basato su 3 fonti ufficiali INPS
        </Badge>
        <p className="leading-relaxed">
          A decorrere dal <strong>1° giugno 2026</strong> il limite ISEE per l'accesso all'ADI è elevato a{" "}
          <strong>10.140 €</strong>
          <sup className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] text-primary">[1]</sup>.
        </p>
        <div className="rounded-md border-l-2 border-primary bg-surface-muted p-3 text-xs">
          <div className="font-medium">[1] Circolare n. 14/2026</div>
          <div className="mt-1 text-muted-foreground">
            "Il valore dell'ISEE in corso di validità non deve essere superiore a 10.140 euro…"
          </div>
        </div>
      </div>
    );
  }
  if (kind.includes("Monitoraggio")) {
    return (
      <div className="space-y-2 text-sm">
        {[
          { t: "ADI", n: 4, p: "Alta" },
          { t: "NASpI", n: 2, p: "Alta" },
          { t: "Assegno Unico", n: 1, p: "Media" },
          { t: "Pensioni", n: 3, p: "Media" },
        ].map((a) => (
          <div key={a.t} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <div className="flex items-center gap-3">
              <Bell className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{a.t}</span>
              <Badge variant="secondary" className="text-[10px]">{a.p}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">{a.n} nuovi</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {[
        "Checklist ADI – rinnovo PAD",
        "NASpI · soglia 5.000 € occasionale",
        "AU · domande dopo 30/06",
      ].map((n) => (
        <div key={n} className="rounded-md border bg-background p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Nota interna</span>
            <span>aggiornata oggi</span>
          </div>
          <div className="mt-1 font-medium text-foreground">{n}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <Card className="overflow-hidden border-border/70 bg-surface p-0 shadow-xl">
      <div className="flex items-center gap-1.5 border-b bg-surface-muted px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-border" />
        <div className="h-2.5 w-2.5 rounded-full bg-border" />
        <div className="h-2.5 w-2.5 rounded-full bg-border" />
        <div className="ml-3 text-xs text-muted-foreground">copilot.inps.app / cruscotto</div>
      </div>
      <div className="grid grid-cols-[140px_1fr]">
        <div className="border-r bg-surface-muted/60 p-3 text-xs">
          <div className="mb-2 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-3 w-3 text-primary" /> INPS Copilot
          </div>
          {["Cruscotto", "Ricerca", "Fonti", "Avvisi", "Workspace"].map((n, i) => (
            <div
              key={n}
              className={`rounded px-2 py-1.5 ${i === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
            >
              {n}
            </div>
          ))}
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: "Aggiornamenti", v: "12" },
              { l: "Fonti salvate", v: "84" },
              { l: "Avvisi attivi", v: "5" },
              { l: "Note non lette", v: "3" },
            ].map((k) => (
              <div key={k.l} className="rounded-md border bg-background p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <div className="mt-0.5 font-display text-lg font-semibold">{k.v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ultimi aggiornamenti INPS
            </div>
            {[
              ["Messaggio n. 2104/2026", "ADI · 22 mag"],
              ["Circolare n. 14/2026", "ADI · 18 mag"],
              ["Messaggio n. 1987/2026", "NASpI · 12 mag"],
            ].map(([t, m]) => (
              <div key={t} className="flex items-center justify-between border-t py-2 first:border-0 first:pt-0">
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">{t}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PricingCard({
  name,
  price,
  tagline,
  features,
  featured,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <Card
      className={`p-7 ${featured ? "border-primary bg-surface shadow-lg ring-1 ring-primary/30" : "border-border/70 bg-surface"}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-display text-xl font-semibold">{name}</div>
        {featured && <Badge className="bg-primary text-primary-foreground">Consigliato</Badge>}
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold">
          {price === "Su misura" ? price : `€${price}`}
        </span>
        {price !== "Su misura" && <span className="text-sm text-muted-foreground">/ mese</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full" variant={featured ? "default" : "outline"} asChild>
        <Link to="/dashboard">Inizia</Link>
      </Button>
    </Card>
  );
}
