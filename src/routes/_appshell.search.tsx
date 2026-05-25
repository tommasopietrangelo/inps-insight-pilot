import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  ShieldCheck,
  Bookmark,
  Download,
  PenSquare,
  ExternalLink,
  Sparkles,
  ListFilter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SOURCES } from "@/lib/mock-data";

export const Route = createFileRoute("/_appshell/search")({
  head: () => ({ meta: [{ title: "Ricerca · INPS Copilot" }] }),
  component: SearchPage,
});

const EXAMPLES = [
  "Nuove regole ADI 2026",
  "Messaggi INPS NASpI sospensione",
  "Assegno Unico domanda arretrati",
  "Rivalutazione pensioni 2026",
  "Contributi UniEmens nuovi codici",
];

function SearchPage() {
  const [q, setQ] = useState("Nuove regole ADI 2026 per nuclei con minori");
  const [submitted, setSubmitted] = useState(true);
  const cited = SOURCES.filter((s) => s.topic_tags.includes("ADI") || s.topic_tags.includes("ISEE")).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ricerca</p>
        <h1 className="font-display text-2xl font-semibold">Chiedi in linguaggio naturale.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le risposte sono sempre basate su circolari, messaggi e normativa ufficiale INPS.
        </p>
      </div>

      <Card className="p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="flex items-center gap-2"
        >
          <Search className="ml-3 h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="es. requisiti ADI 2026 per nuclei con minori"
            className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ListFilter className="h-4 w-4" /> Filtri
          </Button>
          <Button type="submit" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Cerca
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Esempi
        </span>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => {
              setQ(e);
              setSubmitted(true);
            }}
            className="rounded-full border bg-surface px-3 py-1 text-xs hover:border-primary/40 hover:text-foreground"
          >
            {e}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Answer */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                  <ShieldCheck className="h-3 w-3" />
                  Basato su 3 fonti ufficiali INPS
                </Badge>
                <Badge variant="secondary" className="gap-1">Copertura fonti 92%</Badge>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" /> Salva
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Esporta
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PenSquare className="h-3.5 w-3.5" /> A nota
                </Button>
              </div>
            </div>

            <h2 className="mt-5 font-display text-xl font-semibold">Sintesi</h2>
            <p className="mt-2 leading-relaxed text-foreground/90">
              A decorrere dal <strong>1° giugno 2026</strong> il valore ISEE per l'accesso all'Assegno di Inclusione è
              elevato a <strong>10.140 €</strong><Sup n={1} />. Il rinnovo è subordinato alla sottoscrizione del{" "}
              <strong>Patto di Attivazione Digitale (PAD)</strong> entro 120 giorni dalla scadenza del primo periodo
              <Sup n={1} />. Per i nuclei con minori restano validi i parametri della scala di equivalenza, con
              maggiorazione per ogni minore a carico.
            </p>

            <Section title="Cosa è cambiato">
              <ul className="space-y-1.5 text-sm">
                <li>• Soglia ISEE elevata da 9.360 € a 10.140 €<Sup n={1} />.</li>
                <li>• Introdotto il rinnovo telematico con sottoscrizione PAD obbligatoria<Sup n={2} />.</li>
                <li>• Sospensione automatica del beneficio in caso di mancata sottoscrizione PAD<Sup n={2} />.</li>
              </ul>
            </Section>

            <Section title="Chi è coinvolto">
              <p className="text-sm text-foreground/90">
                Nuclei familiari con almeno un componente minore di 18 anni, persona con disabilità o ultrasessantenne,
                in possesso dei requisiti reddituali aggiornati. Esclusi i nuclei già percettori di altre prestazioni
                incompatibili.
              </p>
            </Section>

            <Section title="Note operative per il CAF">
              <ul className="space-y-1.5 text-sm">
                <li>1. Verificare DSU aggiornata prima del rinnovo.</li>
                <li>2. Accompagnare l'utente alla sottoscrizione del PAD entro 120 giorni.</li>
                <li>3. Monitorare settimanalmente i nuclei in scadenza<Sup n={2} />.</li>
                <li>4. Per i nuclei con minori, ricalcolare la maggiorazione su scala di equivalenza.</li>
              </ul>
            </Section>

            <div className="mt-6 rounded-md border-l-2 border-primary bg-surface-muted p-4 text-sm">
              <div className="font-medium">Avvertenza</div>
              <p className="mt-1 text-muted-foreground">
                Questa sintesi è generata automaticamente sulla base delle fonti indicate. Verifica sempre il testo
                ufficiale prima di un atto formale.
              </p>
            </div>
          </Card>

          {/* Sources */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-semibold">Fonti citate</div>
                <p className="text-xs text-muted-foreground">3 atti ufficiali INPS</p>
              </div>
              <Badge variant="outline" className="text-xs">Ordine per pertinenza</Badge>
            </div>
            <div className="space-y-3">
              {cited.map((s, i) => (
                <div key={s.id} className="rounded-md border bg-surface p-4">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge className="bg-primary text-primary-foreground rounded-sm">[{i + 1}]</Badge>
                    <Badge variant="secondary" className="rounded-sm">{s.source_type}</Badge>
                    <span className="font-mono text-muted-foreground">{s.document_number}</span>
                  </div>
                  <Link
                    to="/source/$id"
                    params={{ id: s.id }}
                    className="mt-2 block text-sm font-medium hover:text-primary"
                  >
                    {s.title}
                  </Link>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">"{s.excerpt}"</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Pubblicato il{" "}
                      {new Date(s.publication_date).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <a
                      href={s.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      INPS.it <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{title}</div>
      {children}
    </div>
  );
}

function Sup({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">[{n}]</sup>
  );
}
