import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import appDashboard from "@/assets/app-dashboard.png.asset.json";
import appSearch from "@/assets/app-search.png.asset.json";
import appSources from "@/assets/app-sources.png.asset.json";
import appAlerts from "@/assets/app-alerts.png.asset.json";

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
      { property: "og:image", content: appDashboard.url },
      { name: "twitter:image", content: appDashboard.url },
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
              <Link to="/login">Accedi</Link>
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

      {/* Hero — Stripe-like aurora, large display, real product shot */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-90" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mx-auto mb-6 w-fit gap-1.5 border-primary/30 bg-surface/70 text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Basato su fonti ufficiali INPS
            </Badge>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Trova la fonte INPS giusta<br className="hidden md:block" /> in pochi secondi.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Il copilot AI per CAF, patronati e consulenti del lavoro. Cerca circolari,
              messaggi e normativa INPS in linguaggio naturale, con risposte sempre
              ancorate alla fonte ufficiale.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="shadow-elevated" asChild>
                <Link to="/dashboard">
                  Inizia ora
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/search">Vedi una ricerca demo</Link>
              </Button>
            </div>
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-x-7 gap-y-2 text-sm text-muted-foreground">
              {[
                "Citazioni alla fonte",
                "Monitoraggio per topic",
                "Workspace privato",
                "Conforme GDPR",
              ].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Real product shot */}
          <BrowserFrame
            src={appDashboard.url}
            alt="Cruscotto INPS Copilot — aggiornamenti, KPI e azioni rapide"
            urlLabel="copilot.inps.app / cruscotto"
            className="mt-16"
            priority
          />
        </div>
      </section>

      {/* Problems */}
      <section id="prodotto" className="border-b bg-surface-muted/60">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Il problema</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Restare aggiornati sull'INPS oggi costa ore al giorno.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { t: "Troppi aggiornamenti", d: "Decine di circolari e messaggi al mese, sparsi tra portali, PEC e archivi." },
              { t: "Documenti difficili da leggere", d: "Linguaggio normativo denso, rimandi multipli, allegati tecnici da incrociare." },
              { t: "Interpretazioni incoerenti", d: "Ogni operatore arriva a risposte diverse, senza una memoria condivisa dello studio." },
            ].map((p) => (
              <Card key={p.t} className="border-border/70 p-7 shadow-card">
                <div className="font-display text-lg font-semibold tracking-tight">{p.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features — real product shots */}
      <section id="funzioni" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">La soluzione</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Un copilot operativo, non un chatbot generico.
            </h2>
          </div>

          <div className="mt-20 space-y-28">
            <FeatureRow
              kicker="01 · Ricerca"
              title="Cerca in linguaggio naturale sulle fonti ufficiali INPS"
              body="Digita una domanda come 'requisiti ADI 2026 per nuclei con minori'. Il copilot interroga circolari, messaggi e normativa indicizzati ogni giorno."
              points={[
                "Indice ufficiale INPS aggiornato quotidianamente",
                "Filtri per tipo atto, periodo, topic",
                "Suggerimenti di query frequenti per area",
              ]}
              align="left"
              image={appSearch.url}
              imageAlt="Schermata Ricerca: composer in linguaggio naturale con esempi e Memoria AI"
              urlLabel="copilot.inps.app / ricerca"
            />
            <FeatureRow
              kicker="02 · Fonti ufficiali"
              title="Archivio completo di circolari, messaggi e normativa"
              body="Ogni atto INPS indicizzato e collegato a topic, scadenze, riferimenti. Naviga con filtri precisi o lascia che il copilot ti porti dove serve."
              points={[
                "Tutti gli atti INPS dal 2000 a oggi",
                "Schede fonte con estratto, tag e cronologia",
                "Citazioni dirette in ogni risposta del copilot",
              ]}
              align="right"
              image={appSources.url}
              imageAlt="Schermata Fonti: archivio circolari e messaggi INPS con filtri"
              urlLabel="copilot.inps.app / fonti"
            />
            <FeatureRow
              kicker="03 · Monitoraggio"
              title="Avvisi per topic e nuovi atti pubblicati"
              body="Segui ADI, SFL, NASpI, Assegno Unico, pensioni, contributi. Ricevi solo ciò che riguarda davvero il tuo studio."
              points={[
                "Regole di avviso per topic e tipo atto",
                "Email, in-app e Slack",
                "Timeline degli aggiornamenti recenti",
              ]}
              align="left"
              image={appAlerts.url}
              imageAlt="Schermata Avvisi: regole di monitoraggio per topic e notifiche recenti"
              urlLabel="copilot.inps.app / avvisi"
            />
            <FeatureRow
              kicker="04 · Workspace"
              title="Memoria condivisa per il tuo ufficio"
              body="Salva ricerche, prendi note interne, costruisci la prassi dello studio. Tutto privato, tutto ricercabile dal cruscotto."
              points={[
                "Note interne collegate alle fonti",
                "Ricerche salvate condivise",
                "Ruoli admin, operatore e sola lettura",
              ]}
              align="right"
              image={appDashboard.url}
              imageAlt="Cruscotto INPS Copilot: workspace con KPI, aggiornamenti e topic"
              urlLabel="copilot.inps.app / cruscotto"
            />
          </div>
        </div>
      </section>

      {/* Topics */}
      <section id="topic" className="border-b bg-surface-muted/60">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Topic coperti</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
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
                className="rounded-full border bg-surface px-3.5 py-1.5 text-sm font-normal shadow-card"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Non una chat generalista. L'AI per il mondo INPS.
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Le AI generiche inventano, confondono, espongono i tuoi dati. INPS Copilot no.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <Card className="rounded-2xl border-border/70 bg-surface-muted/60 p-8 shadow-card">
              <div className="font-display text-xl font-semibold tracking-tight">Chat AI generica</div>
              <ul className="mt-6 divide-y divide-border/60">
                {[
                  "Inventa circolari e numeri di protocollo",
                  "I tuoi dati addestrano il modello",
                  "Nessuna certificazione e niente sicurezza",
                  "Risposte generiche, senza citazioni",
                  "Nessuna memoria condivisa dello studio",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 py-4 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/80">{t}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="relative overflow-hidden rounded-2xl border-0 bg-navy-gradient p-8 text-primary-foreground shadow-premium">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(60% 80% at 100% 0%, oklch(0.85 0.12 50 / 0.45), transparent 60%), radial-gradient(40% 60% at 0% 100%, oklch(0.75 0.14 30 / 0.30), transparent 70%)",
                }}
                aria-hidden
              />
              <div className="relative flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
                <ShieldCheck className="h-6 w-6" />
                INPS COPILOT
              </div>
              <ul className="relative mt-6 divide-y divide-primary-foreground/20">
                {[
                  "Fonti ufficiali INPS, sempre citate",
                  "Zero training. Zero retention dei tuoi dati",
                  "Conforme GDPR · AI Act",
                  "Progettata per CAF, patronati e consulenti",
                  "Workspace condiviso integrato nel tuo flusso",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 py-4 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prezzi" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Prezzi</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Pensato per studi di ogni dimensione.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <PricingCard
              name="Solo"
              price="49"
              tagline="Per il professionista singolo."
              features={["1 utente", "Ricerca illimitata", "Avvisi per 5 topic", "Note interne personali"]}
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
      <section className="relative overflow-hidden bg-navy-gradient text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 100% 0%, oklch(0.85 0.12 50 / 0.45), transparent 60%), radial-gradient(40% 60% at 0% 100%, oklch(0.75 0.14 30 / 0.30), transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Pronto a smettere di cercare?
            </h2>
            <p className="mt-3 max-w-xl text-primary-foreground/80 md:text-lg">
              30 giorni di prova. Nessuna carta di credito richiesta.
            </p>
          </div>
          <Button size="lg" variant="secondary" className="shadow-elevated" asChild>
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

function BrowserFrame({
  src,
  alt,
  urlLabel,
  className,
  priority,
}: {
  src: string;
  alt: string;
  urlLabel: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-6xl ${className ?? ""}`}>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-premium ring-1 ring-foreground/[0.04]">
        <div className="flex items-center gap-2 border-b bg-surface-muted/70 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto rounded-md border bg-surface px-3 py-1 text-xs text-muted-foreground">
            {urlLabel}
          </div>
        </div>
        <img
          src={src}
          alt={alt}
          className="block h-auto w-full"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
    </div>
  );
}

function FeatureRow({
  kicker,
  title,
  body,
  points,
  align,
  image,
  imageAlt,
  urlLabel,
}: {
  kicker: string;
  title: string;
  body: string;
  points: string[];
  align: "left" | "right";
  image: string;
  imageAlt: string;
  urlLabel: string;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
      <div className={align === "right" ? "lg:order-2" : ""}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {kicker}
        </div>
        <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h3>
        <p className="mt-4 text-muted-foreground md:text-lg">{body}</p>
        <ul className="mt-6 space-y-2.5 text-sm">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={align === "right" ? "lg:order-1" : ""}>
        <BrowserFrame src={image} alt={imageAlt} urlLabel={urlLabel} />
      </div>
    </div>
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
      className={`p-8 ${featured ? "border-primary/30 bg-surface shadow-elevated ring-1 ring-primary/20" : "border-border/70 bg-surface shadow-card"}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-display text-xl font-semibold tracking-tight">{name}</div>
        {featured && <Badge className="bg-primary text-primary-foreground">Consigliato</Badge>}
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-5xl font-semibold tracking-tight">
          {price === "Su misura" ? price : `€${price}`}
        </span>
        {price !== "Su misura" && <span className="text-sm text-muted-foreground">/ mese</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-7 w-full" variant={featured ? "default" : "outline"} asChild>
        <Link to="/dashboard">Inizia</Link>
      </Button>
    </Card>
  );
}
