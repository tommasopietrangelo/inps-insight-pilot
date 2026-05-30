import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Normative cardine: corpus di leggi/decreti ancora vigenti rilevanti per
// CAF, patronati e consulenti del lavoro. Curato a mano (lista breve, ad
// alto valore), scaricato via Firecrawl (PDF/HTML su Normattiva, INPS o
// Gazzetta Ufficiale). Dedup su external_id.
// ---------------------------------------------------------------------------

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

function requireKey() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY non configurata");
  return k;
}

async function scrape(url: string): Promise<{ markdown: string; title?: string; description?: string }> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 2500,
      parsers: ["pdf"],
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { success?: boolean; data?: { markdown?: string; metadata?: { title?: string; description?: string } }; error?: string };
  if (!json.success || !json.data) throw new Error(`Firecrawl: ${json.error ?? "unknown"}`);
  return {
    markdown: (json.data.markdown ?? "").trim(),
    title: json.data.metadata?.title,
    description: json.data.metadata?.description,
  };
}

type Norma = {
  external_id: string;
  title: string;
  source_type: "normativa" | "decreto";
  document_number: string;
  publication_date: string;
  topic_tags: string[];
  official_url: string;
  summary: string;
};

// Lista curata. Ogni voce è una norma cardine ancora vigente, con riassunto
// operativo che funziona da fallback se lo scraping del testo integrale
// fallisce.
const NORMATIVE: Norma[] = [
  {
    external_id: "norma-dl-48-2023",
    title: "D.L. 4 maggio 2023, n. 48 — Decreto Lavoro (ADI e SFL)",
    source_type: "decreto",
    document_number: "DL 48/2023",
    publication_date: "2023-05-04",
    topic_tags: ["ADI", "SFL"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2023-05-04;48",
    summary:
      "Istituisce l'Assegno di Inclusione (ADI) dal 1° gennaio 2024 e il Supporto per la Formazione e il Lavoro (SFL) dal 1° settembre 2023, in sostituzione del Reddito di Cittadinanza. Definisce requisiti (ISEE ≤ 9.360 €, presenza di componenti vulnerabili per ADI), importo, durata, condizionalità e PAD.",
  },
  {
    external_id: "norma-dlgs-22-2015",
    title: "D.Lgs. 4 marzo 2015, n. 22 — NASpI e DIS-COLL (Jobs Act)",
    source_type: "decreto",
    document_number: "D.Lgs. 22/2015",
    publication_date: "2015-03-04",
    topic_tags: ["NASpI"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2015-03-04;22",
    summary:
      "Disciplina la Nuova Assicurazione Sociale per l'Impiego (NASpI): requisiti contributivi (13 settimane nei 4 anni precedenti), durata (max 24 mesi, pari a metà delle settimane contributive), importo (75% retribuzione media fino a 1.439,29 € + 25% eccedenza, con tetto), décalage del 3% mensile dal 6° mese. Disciplina anche la DIS-COLL per i co.co.co.",
  },
  {
    external_id: "norma-dpcm-159-2013",
    title: "DPCM 5 dicembre 2013, n. 159 — Regolamento ISEE",
    source_type: "normativa",
    document_number: "DPCM 159/2013",
    publication_date: "2013-12-05",
    topic_tags: ["ISEE"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.del.consiglio.dei.ministri:2013-12-05;159",
    summary:
      "Disciplina dell'Indicatore della Situazione Economica Equivalente (ISEE). Definisce nucleo familiare, ISR, ISP, scala di equivalenza, ISEE corrente, ISEE minorenni, ISEE socio-sanitario, ISEE università. Base normativa di tutte le prestazioni agevolate.",
  },
  {
    external_id: "norma-dlgs-230-2021",
    title: "D.Lgs. 29 dicembre 2021, n. 230 — Assegno Unico e Universale",
    source_type: "decreto",
    document_number: "D.Lgs. 230/2021",
    publication_date: "2021-12-29",
    topic_tags: ["Assegno Unico"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2021-12-29;230",
    summary:
      "Istituisce l'Assegno Unico e Universale per i figli a carico fino a 21 anni (senza limiti per figli disabili). Importi modulati su ISEE (da 57 € a 199,40 € per figlio minore senza ISEE/oltre soglia 45.939,56 €). Maggiorazioni per figli successivi al secondo, madri under 21, nuclei con disabili, entrambi i genitori con reddito da lavoro.",
  },
  {
    external_id: "norma-l-234-2021",
    title: "Legge 30 dicembre 2021, n. 234 — Legge di Bilancio 2022",
    source_type: "normativa",
    document_number: "L. 234/2021",
    publication_date: "2021-12-30",
    topic_tags: ["Pensioni", "Assegno Unico"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2021-12-30;234",
    summary:
      "Legge di Bilancio 2022. Introduce Quota 102 (64 anni + 38 contributi), proroga Opzione Donna e APE Sociale, riforma IRPEF (4 scaglioni), istituisce assegno unico universale (art. 1 c. 365). Rilevante per pensioni e fisco.",
  },
  {
    external_id: "norma-l-197-2022",
    title: "Legge 29 dicembre 2022, n. 197 — Legge di Bilancio 2023",
    source_type: "normativa",
    document_number: "L. 197/2022",
    publication_date: "2022-12-29",
    topic_tags: ["Pensioni"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2022-12-29;197",
    summary:
      "Legge di Bilancio 2023. Quota 103 (62 anni + 41 contributi), Opzione Donna riformata (60/59/58 anni con condizioni), rivalutazione pensioni differenziata, taglio cuneo fiscale, abolizione RdC dal 2024 con istituzione ADI/SFL (poi attuata con DL 48/2023).",
  },
  {
    external_id: "norma-l-213-2023",
    title: "Legge 30 dicembre 2023, n. 213 — Legge di Bilancio 2024",
    source_type: "normativa",
    document_number: "L. 213/2023",
    publication_date: "2023-12-30",
    topic_tags: ["Pensioni", "Contribuzione"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2023-12-30;213",
    summary:
      "Legge di Bilancio 2024. Proroga Quota 103 (con ricalcolo contributivo), Opzione Donna ulteriormente ristretta, APE Sociale, perequazione pensioni, taglio cuneo fiscale prorogato, decontribuzione lavoratrici madri.",
  },
  {
    external_id: "norma-l-207-2024",
    title: "Legge 30 dicembre 2024, n. 207 — Legge di Bilancio 2025",
    source_type: "normativa",
    document_number: "L. 207/2024",
    publication_date: "2024-12-30",
    topic_tags: ["Pensioni", "Contribuzione", "Bonus Asilo"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207",
    summary:
      "Legge di Bilancio 2025. Conferma Quota 103, Opzione Donna, APE Sociale. Rinnovo taglio cuneo (bonus IRPEF strutturale fino a 40.000 €). Bonus nuovi nati 1.000 € una tantum, ISEE escluso titoli di Stato fino 50.000 €. Decontribuzione lavoratrici madri estesa.",
  },
  {
    external_id: "norma-dlgs-81-2015",
    title: "D.Lgs. 15 giugno 2015, n. 81 — Disciplina dei contratti di lavoro",
    source_type: "decreto",
    document_number: "D.Lgs. 81/2015",
    publication_date: "2015-06-15",
    topic_tags: ["Contribuzione"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2015-06-15;81",
    summary:
      "Testo organico dei contratti di lavoro: tempo determinato (24 mesi max con causali oltre 12), part-time, apprendistato, somministrazione, lavoro intermittente, accessorio. Base per consulenti del lavoro su assunzioni e cessazioni.",
  },
  {
    external_id: "norma-l-104-1992",
    title: "Legge 5 febbraio 1992, n. 104 — Legge quadro disabilità",
    source_type: "normativa",
    document_number: "L. 104/1992",
    publication_date: "1992-02-05",
    topic_tags: ["Maternità"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1992-02-05;104",
    summary:
      "Legge quadro per l'assistenza, l'integrazione sociale e i diritti delle persone disabili. Art. 3 c. 3 (gravità), permessi mensili retribuiti (3 giorni o 2 ore/giorno), congedo straordinario 2 anni (D.Lgs. 151/2001 art. 42 c. 5), agevolazioni fiscali. Base per patronati su invalidità civile e handicap.",
  },
  {
    external_id: "norma-dlgs-151-2001",
    title: "D.Lgs. 26 marzo 2001, n. 151 — Testo Unico maternità e paternità",
    source_type: "decreto",
    document_number: "D.Lgs. 151/2001",
    publication_date: "2001-03-26",
    topic_tags: ["Maternità"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2001-03-26;151",
    summary:
      "Testo Unico delle disposizioni a tutela e sostegno della maternità e paternità. Congedo di maternità (5 mesi, 80% retribuzione), congedo di paternità obbligatorio (10 gg), congedo parentale (fino 11 mesi tra entrambi, indennità 30% poi 80% per i primi 3 mesi dal 2024), riposi giornalieri, congedi per malattia figlio.",
  },
  {
    external_id: "norma-l-335-1995",
    title: "Legge 8 agosto 1995, n. 335 — Riforma sistema pensionistico (Dini)",
    source_type: "normativa",
    document_number: "L. 335/1995",
    publication_date: "1995-08-08",
    topic_tags: ["Pensioni", "Contribuzione"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1995-08-08;335",
    summary:
      "Riforma Dini: introduce il sistema contributivo per i lavoratori con meno di 18 anni di contributi al 31/12/1995 e per i nuovi iscritti dal 1996. Gestione Separata INPS (art. 2 c. 26). Base di calcolo della pensione contributiva e dell'integrazione al minimo.",
  },
  {
    external_id: "norma-dl-201-2011",
    title: "D.L. 6 dicembre 2011, n. 201 — Riforma Fornero (Salva Italia)",
    source_type: "decreto",
    document_number: "DL 201/2011",
    publication_date: "2011-12-06",
    topic_tags: ["Pensioni"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2011-12-06;201",
    summary:
      "Riforma Fornero (art. 24): pensione di vecchiaia a 67 anni (con adeguamenti speranza di vita), pensione anticipata (42a10m uomini, 41a10m donne, ora 42a10m/41a10m + finestra). Estensione sistema contributivo pro-rata a tutti dal 2012.",
  },
  {
    external_id: "norma-dl-4-2019",
    title: "D.L. 28 gennaio 2019, n. 4 — Quota 100 e RdC",
    source_type: "decreto",
    document_number: "DL 4/2019",
    publication_date: "2019-01-28",
    topic_tags: ["Pensioni"],
    official_url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2019-01-28;4",
    summary:
      "Istituisce Quota 100 (62 anni + 38 contributi, sperimentale 2019-2021) e il Reddito/Pensione di Cittadinanza (abrogato dal 2024, sostituito da ADI/SFL con DL 48/2023). Resta rilevante per finestre e cumulo per chi ha maturato il diritto.",
  },
];

export const ingestNormativeCardine = createServerFn({ method: "POST" })
  .handler(async () => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { ext: string; reason: string }[] = [];

    for (const n of NORMATIVE) {
      try {
        // Dedup: già presente con full_text non vuoto? skip.
        const { data: existing } = await supabaseAdmin
          .from("sources")
          .select("id, full_text")
          .eq("external_id", n.external_id)
          .maybeSingle();
        if (existing && existing.full_text && existing.full_text.length > 1000) {
          skipped++;
          continue;
        }

        // Prova a scaricare il testo integrale; in fallback usa il summary curato.
        let fullText = n.summary;
        let titleFromScrape: string | undefined;
        try {
          const s = await scrape(n.official_url);
          if (s.markdown.length > 800) {
            fullText = `${n.summary}\n\n---\n\n${s.markdown}`.slice(0, 80000);
          }
          titleFromScrape = s.title;
        } catch (e) {
          console.warn(`scrape failed for ${n.external_id}:`, (e as Error).message);
        }

        const { error } = await supabaseAdmin
          .from("sources")
          .upsert(
            {
              external_id: n.external_id,
              title: n.title,
              source_type: n.source_type,
              document_number: n.document_number,
              publication_date: n.publication_date,
              topic_tags: n.topic_tags,
              summary: n.summary,
              excerpt: n.summary.slice(0, 800),
              full_text: fullText,
              official_url: n.official_url,
            },
            { onConflict: "external_id" },
          )
          .select("id")
          .single();
        if (error) {
          errors.push({ ext: n.external_id, reason: error.message });
          continue;
        }

        // Invalida chunks esistenti così il prossimo "Aggiorna indice" rigenera embeddings
        const { data: src } = await supabaseAdmin
          .from("sources").select("id").eq("external_id", n.external_id).maybeSingle();
        if (src) await supabaseAdmin.from("chunks").delete().eq("source_id", src.id);

        if (existing) updated++; else created++;
        void titleFromScrape;
      } catch (e) {
        errors.push({ ext: n.external_id, reason: (e as Error).message });
      }
    }

    return {
      total: NORMATIVE.length,
      created,
      updated,
      skipped,
      errors,
    };
  });
