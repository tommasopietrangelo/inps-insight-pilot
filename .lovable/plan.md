## Obiettivo
Aggiungere al corpus le ~3000 notizie del portale INPS (`/inps-comunica/notizie/...html`) usando Firecrawl, replicando il pattern già collaudato per il layer operativo (discovery → queue → batch).

## Architettura

### 1. Database (migrazione)
- Nuova tabella `inps_news_queue` (stessa shape di `inps_operational_queue`):
  - `id`, `url` (unique), `status` ('pending'|'done'|'error'|'skipped'), `error`, `discovered_at`, `processed_at`, `external_id`, `attempt`.
- Nuovo `source_type` consentito: `notizia` (aggiunto al check constraint di `sources`).
- GRANT su `inps_news_queue` per `authenticated` + `service_role`, RLS abilitata.

### 2. Server functions (`src/lib/inps-news.functions.ts`)
Tre `createServerFn`, tutte con `requireSupabaseAuth` + check ruolo admin:

- **`discoverInpsNews`** — Firecrawl `map` su `https://www.inps.it/it/it/inps-comunica/notizie.html` con `limit: 5000`, filtra link che matchano `/inps-comunica/notizie/...html` (regex sul pattern delle pagine notizia), upsert in `inps_news_queue` con `status='pending'`. Ritorna: trovati, nuovi, già in coda, già nel corpus.
- **`batchIngestNews`** — Prende N=20 URL `pending` dalla coda, per ciascuno: Firecrawl `scrape` (formats: markdown, no espansione accordion), estrae titolo/data/contenuto, upsert in `sources` con `source_type='notizia'`, `corpus_layer='operativo'`, `external_id = sha256(url)`. Marca `done`/`error` nella coda. Ritorna report del batch (`processed`, `created`, `errors`, `remaining`).
- **`getNewsQueueStats`** — Conta pending/done/error/skipped per la UI.

### 3. UI (`src/routes/_appshell.settings.tsx`)
Nuova sezione "Notizie INPS" accanto a quella operativa, con:
- Pulsante **Discovery notizie** (chiama `discoverInpsNews`).
- Statistiche coda (pending / done / error).
- Pulsante **Esegui batch (20)** che richiama `batchIngestNews` finché `remaining > 0` (come fanno già gli altri batch — loop client-side con toast progress).

### 4. Integrazione retrieval
Le notizie entrano in `sources` con `source_type='notizia'` e `corpus_layer='operativo'`, quindi vengono automaticamente:
- scansionate da `pickRelevantSources` in `/analyze`,
- indicizzate da `ingestEmbeddings` per la ricerca semantica,
- pescate dal FTS in `groundedSearch`.
Nessuna modifica alle funzioni di ricerca.

## Costi e tempi
- **Firecrawl**: 1 credito per `map` (discovery) + 1 credito per `scrape` per ogni notizia → ~3000 crediti Firecrawl totali (non Lovable).
- **Lovable AI**: 0 crediti durante l'ingest. Solo l'embedding successivo (`ingestEmbeddings`, già esistente) usa Lovable AI Gateway — costo trascurabile per item.
- Il batch va lanciato manualmente dalla UI in cicli da 20 (rate-limit friendly su Firecrawl).

## File toccati
- `supabase` migration (nuova tabella + nuovo source_type)
- `src/lib/inps-news.functions.ts` (nuovo)
- `src/routes/_appshell.settings.tsx` (nuova sezione UI)

Confermi che procedo?