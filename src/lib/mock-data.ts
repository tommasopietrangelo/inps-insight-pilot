export type SourceType = "Circolare" | "Messaggio" | "Decreto" | "Pagina servizio";

export interface SourceDocument {
  id: string;
  title: string;
  source_type: SourceType;
  publication_date: string; // ISO
  document_number: string;
  topic_tags: string[];
  summary: string;
  excerpt: string;
  full_text: string;
  related_documents: string[];
  official_url: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  updates_count: number;
}

export interface Alert {
  id: string;
  topic: string;
  source_type: SourceType | "Tutti";
  frequency: "Immediata" | "Giornaliera" | "Settimanale";
  priority: "Alta" | "Media" | "Bassa";
  last_update: string;
  new_updates: number;
  channels: ("Email" | "In-app" | "Slack")[];
}

export interface InternalNote {
  id: string;
  title: string;
  author: string;
  updated_at: string;
  body: string;
  linked_source?: string;
  tags: string[];
}

export interface SavedSearch {
  id: string;
  query: string;
  created_at: string;
  results_count: number;
}

export const TOPICS: Topic[] = [
  { id: "adi", name: "ADI", description: "Assegno di Inclusione", updates_count: 12 },
  { id: "sfl", name: "SFL", description: "Supporto Formazione e Lavoro", updates_count: 8 },
  { id: "naspi", name: "NASpI", description: "Indennità di disoccupazione", updates_count: 21 },
  { id: "au", name: "Assegno Unico", description: "Assegno Unico e Universale", updates_count: 17 },
  { id: "pensioni", name: "Pensioni", description: "Pensioni e previdenza", updates_count: 9 },
  { id: "contributi", name: "Contributi", description: "Contribuzione e aziende", updates_count: 14 },
  { id: "isee", name: "ISEE", description: "Indicatore Situazione Economica", updates_count: 6 },
  { id: "aziende", name: "Aziende", description: "Adempimenti datori di lavoro", updates_count: 11 },
];

export const SOURCES: SourceDocument[] = [
  {
    id: "circ-2026-014",
    title: "Assegno di Inclusione (ADI) – Aggiornamento requisiti reddituali e nuove modalità di rinnovo 2026",
    source_type: "Circolare",
    publication_date: "2026-05-18",
    document_number: "Circolare n. 14/2026",
    topic_tags: ["ADI", "ISEE"],
    summary:
      "La circolare aggiorna i parametri reddituali per l'accesso all'ADI a decorrere dal 1° giugno 2026, introduce un nuovo iter di rinnovo telematico e chiarisce gli effetti della sospensione automatica nei casi di mancata sottoscrizione del PAD.",
    excerpt:
      "A decorrere dal 1° giugno 2026 il valore ISEE per l'accesso al beneficio è elevato a 10.140 euro. Il rinnovo è subordinato alla sottoscrizione del Patto di Attivazione Digitale entro 120 giorni dalla scadenza del primo periodo…",
    full_text:
      "1. Premessa\nCon il presente messaggio si forniscono le istruzioni operative per la corretta applicazione delle disposizioni di cui al decreto-legge n. 48/2023, come modificato dalla legge di bilancio 2026.\n\n2. Requisiti\nIl valore dell'ISEE in corso di validità non deve essere superiore a 10.140 euro. È richiesto un valore del reddito familiare inferiore a 6.500 euro annui, parametrato secondo la scala di equivalenza di cui all'art. 2, comma 4.\n\n3. Rinnovo\nIl rinnovo della prestazione è subordinato alla presentazione di una nuova DSU e alla sottoscrizione del Patto di Attivazione Digitale (PAD) entro 120 giorni dalla scadenza.\n\n4. Sospensione\nLa mancata sottoscrizione del PAD comporta la sospensione automatica del beneficio…",
    related_documents: ["msg-2026-2104", "circ-2025-098"],
    official_url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa.html",
  },
  {
    id: "msg-2026-2104",
    title: "ADI – Chiarimenti operativi sul Patto di Attivazione Digitale (PAD) e gestione delle sospensioni",
    source_type: "Messaggio",
    publication_date: "2026-05-22",
    document_number: "Messaggio n. 2104/2026",
    topic_tags: ["ADI"],
    summary:
      "Il messaggio fornisce chiarimenti operativi alle strutture territoriali sulla gestione delle sospensioni automatiche dell'ADI in caso di mancata sottoscrizione del PAD entro i termini previsti.",
    excerpt:
      "Le sedi territoriali sono tenute a verificare con cadenza settimanale i nuclei familiari per i quali risulti scaduto il termine di 120 giorni…",
    full_text: "Testo integrale del messaggio…",
    related_documents: ["circ-2026-014"],
    official_url: "https://www.inps.it/",
  },
  {
    id: "msg-2026-1987",
    title: "NASpI – Sospensione dell'indennità in caso di nuova attività di lavoro autonomo occasionale",
    source_type: "Messaggio",
    publication_date: "2026-05-12",
    document_number: "Messaggio n. 1987/2026",
    topic_tags: ["NASpI"],
    summary:
      "Vengono forniti chiarimenti sulla compatibilità tra indennità NASpI e prestazioni di lavoro autonomo occasionale di importo superiore a 5.000 euro annui.",
    excerpt:
      "Il superamento del limite di 5.000 euro lordi annui per prestazioni occasionali determina la decadenza dalla prestazione, salvo comunicazione preventiva…",
    full_text: "Testo integrale…",
    related_documents: ["circ-2024-077"],
    official_url: "https://www.inps.it/",
  },
  {
    id: "circ-2026-011",
    title: "Assegno Unico e Universale – Arretrati per domande presentate oltre il 30 giugno 2026",
    source_type: "Circolare",
    publication_date: "2026-05-05",
    document_number: "Circolare n. 11/2026",
    topic_tags: ["Assegno Unico"],
    summary:
      "Si chiariscono i criteri di liquidazione degli arretrati per le domande di Assegno Unico presentate oltre il termine ordinario del 30 giugno.",
    excerpt:
      "Per le domande presentate oltre il 30 giugno l'importo è riconosciuto a partire dal mese successivo alla presentazione, senza arretrati relativi alle mensilità precedenti…",
    full_text: "Testo integrale…",
    related_documents: [],
    official_url: "https://www.inps.it/",
  },
  {
    id: "circ-2026-009",
    title: "Pensioni – Rivalutazione automatica dei trattamenti previdenziali per l'anno 2026",
    source_type: "Circolare",
    publication_date: "2026-04-28",
    document_number: "Circolare n. 9/2026",
    topic_tags: ["Pensioni"],
    summary:
      "Si comunicano le percentuali di rivalutazione automatica dei trattamenti pensionistici a decorrere dal 1° gennaio 2026, sulla base dell'indice ISTAT.",
    excerpt:
      "La percentuale definitiva di perequazione è fissata allo 0,8% con conguaglio sulle mensilità di gennaio e febbraio 2026…",
    full_text: "Testo integrale…",
    related_documents: [],
    official_url: "https://www.inps.it/",
  },
  {
    id: "msg-2026-1854",
    title: "Supporto Formazione e Lavoro (SFL) – Estensione platea beneficiari e nuove causali",
    source_type: "Messaggio",
    publication_date: "2026-04-22",
    document_number: "Messaggio n. 1854/2026",
    topic_tags: ["SFL"],
    summary:
      "Vengono illustrate le nuove categorie di beneficiari ammessi al Supporto Formazione e Lavoro a seguito della modifica normativa di aprile 2026.",
    excerpt:
      "Sono ora ammessi al SFL i componenti di nuclei familiari con minori in età compresa tra 14 e 18 anni iscritti a percorsi di IeFP…",
    full_text: "Testo integrale…",
    related_documents: [],
    official_url: "https://www.inps.it/",
  },
  {
    id: "circ-2026-007",
    title: "Contribuzione aziende – Aliquote 2026 e nuove modalità di compilazione UniEmens",
    source_type: "Circolare",
    publication_date: "2026-04-10",
    document_number: "Circolare n. 7/2026",
    topic_tags: ["Contributi", "Aziende"],
    summary:
      "La circolare aggiorna le aliquote contributive 2026 per le aziende del settore privato e fornisce istruzioni sulla compilazione dei flussi UniEmens.",
    excerpt:
      "L'aliquota IVS resta fissata al 33%; sono introdotti i nuovi codici causale per la gestione dei contributi di solidarietà…",
    full_text: "Testo integrale…",
    related_documents: ["circ-2025-098"],
    official_url: "https://www.inps.it/",
  },
  {
    id: "msg-2026-1620",
    title: "ISEE precompilato 2026 – Tempistiche di rilascio e gestione delle anomalie",
    source_type: "Messaggio",
    publication_date: "2026-03-30",
    document_number: "Messaggio n. 1620/2026",
    topic_tags: ["ISEE"],
    summary:
      "Si forniscono indicazioni sulle tempistiche di rilascio del nuovo ISEE precompilato 2026 e sulle modalità di correzione delle anomalie più frequenti.",
    excerpt:
      "Il sistema rilascia la DSU precompilata entro 4 giorni lavorativi dalla richiesta. Eventuali anomalie sui dati patrimoniali devono essere segnalate tramite il servizio dedicato…",
    full_text: "Testo integrale…",
    related_documents: [],
    official_url: "https://www.inps.it/",
  },
];

export const ALERTS: Alert[] = [
  {
    id: "a1",
    topic: "ADI",
    source_type: "Tutti",
    frequency: "Immediata",
    priority: "Alta",
    last_update: "2026-05-22",
    new_updates: 4,
    channels: ["Email", "In-app"],
  },
  {
    id: "a2",
    topic: "NASpI",
    source_type: "Messaggio",
    frequency: "Giornaliera",
    priority: "Alta",
    last_update: "2026-05-12",
    new_updates: 2,
    channels: ["In-app"],
  },
  {
    id: "a3",
    topic: "Assegno Unico",
    source_type: "Circolare",
    frequency: "Settimanale",
    priority: "Media",
    last_update: "2026-05-05",
    new_updates: 1,
    channels: ["Email"],
  },
  {
    id: "a4",
    topic: "Pensioni",
    source_type: "Tutti",
    frequency: "Settimanale",
    priority: "Media",
    last_update: "2026-04-28",
    new_updates: 3,
    channels: ["Email", "Slack"],
  },
  {
    id: "a5",
    topic: "Contributi",
    source_type: "Circolare",
    frequency: "Giornaliera",
    priority: "Bassa",
    last_update: "2026-04-10",
    new_updates: 0,
    channels: ["In-app"],
  },
];

export const NOTES: InternalNote[] = [
  {
    id: "n1",
    title: "ADI – checklist rinnovo per operatori CAF",
    author: "Giulia Conti",
    updated_at: "2026-05-23",
    body:
      "Verificare prima della scadenza dei 120 giorni: 1) DSU aggiornata; 2) sottoscrizione PAD; 3) presenza componenti attivabili al lavoro…",
    linked_source: "circ-2026-014",
    tags: ["ADI", "procedura"],
  },
  {
    id: "n2",
    title: "NASpI e lavoro occasionale – soglia 5.000€",
    author: "Marco De Luca",
    updated_at: "2026-05-14",
    body:
      "Comunicare al beneficiario di trasmettere la comunicazione preventiva tramite il servizio dedicato. Allegare modulo interno IN-NAS-04.",
    linked_source: "msg-2026-1987",
    tags: ["NASpI"],
  },
  {
    id: "n3",
    title: "Assegno Unico – istruzioni per domande tardive",
    author: "Sara Bianchi",
    updated_at: "2026-05-06",
    body:
      "Le domande presentate dopo il 30/06 non danno diritto agli arretrati. Avvisare l'utente in fase di front office.",
    linked_source: "circ-2026-011",
    tags: ["Assegno Unico", "front office"],
  },
];

export const SAVED_SEARCHES: SavedSearch[] = [
  { id: "s1", query: "Nuove regole ADI 2026", created_at: "2026-05-22", results_count: 7 },
  { id: "s2", query: "Messaggi INPS NASpI sospensione", created_at: "2026-05-20", results_count: 4 },
  { id: "s3", query: "Assegno Unico domanda arretrati", created_at: "2026-05-18", results_count: 3 },
  { id: "s4", query: "Rivalutazione pensioni 2026", created_at: "2026-05-12", results_count: 5 },
];

export function getSource(id: string): SourceDocument | undefined {
  return SOURCES.find((s) => s.id === id);
}
