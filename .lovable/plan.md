# Promemoria: attivazione cron INPS — 31 luglio 2026

Oggi è il 6 luglio 2026. Non posso eseguire azioni "in differita" da solo: il 31 luglio 2026 dovrai riaprire la chat e dirmi "esegui il piano cron INPS". Salvo questo piano nella memoria del progetto così è pronto.

## Cosa fare quel giorno

Tre cron da (ri)attivare tramite SQL su `pg_cron` + `pg_net`, tutti con timezone Europe/Rome (schedulati in UTC coprendo CEST/CET, gate `romeHour` già presente negli handler).

### 1. Circolari INPS — giornaliero 06:00 Rome
- Endpoint esistente: `POST /api/public/hooks/ingest-inps` (già include gate `romeHour === 6` e ri-embedding).
- Fonte: `https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa.html`
- Job name: `ingest-inps-circolari-daily`
- Schedule: `0 4,5 * * *` (04:00 e 05:00 UTC → 06:00 Rome in CEST/CET).
- Body: `{}`

### 2. Notizie INPS — giornaliero 06:30 Rome
- Endpoint esistente: `POST /api/public/hooks/ingest-inps-news` (gate `romeHour === 6`; usa `ingestNewsDaily` con `scrapeLimit=30, concurrency=3`; entra nella singola notizia e salva `full_text` in `sources` con `source_type='notizia'`, `corpus_layer='operativo'`; poi `ingestEmbeddings`).
- Fonte: `https://www.inps.it/it/it/inps-comunica/notizie.html`
- Job name: `ingest-inps-news-daily`
- Nota: il gate attuale accetta solo l'ora esatta 06 → per farlo girare alle 06:30 Rome va **rilassato il gate** a `romeHour === 6` con qualunque minuto (già ok) e schedulato `30 4,5 * * *`. Se preferiamo lasciare intatto il gate, va bene anche `0 4,5 * * *` (parte insieme alle circolari). Confermerai al momento.
- Body: `{}`

### 3. Layer operativo INPS — mensile, 1° del mese 07:00 Rome
- Da creare: nuovo endpoint `POST /api/public/hooks/rediscover-inps-operational` che invoca la rediscovery per-sezione già presente in `src/lib/inps-operational.functions.ts` (oggi lanciata manualmente da Impostazioni). Solo **discovery + diff**: enqueue di eventuali nuove URL, nessun re-scrape delle sezioni già in corpus.
- Gate: `romeHour === 7`, giorno del mese = 1 (già implicito nello schedule).
- Job name: `rediscover-inps-operational-monthly`
- Schedule: `0 5,6 1 * *` (05:00 e 06:00 UTC del 1° del mese → 07:00 Rome).
- Body: `{}`

## Passi operativi (da eseguire il 31/07/2026)

1. Verificare che i tre endpoint rispondano 200 in `?force=1` (smoke test manuale).
2. Creare l'endpoint operativo mensile se non esiste ancora (piccola route + funzione wrapper su `ingestInpsOperationalDaily`/equivalente per-sezione, con flag "solo diff").
3. Eseguire via `supabase--insert` gli SQL `cron.schedule(...)` per i tre job (usando `apikey` = publishable key nel header, come da convenzione del progetto).
4. Verificare `SELECT * FROM cron.job;` che i tre job siano presenti; controllare `cron.job_run_details` dopo la prima finestra.

## Cosa faccio ora

- **Non** attivo nulla oggi (mancano 25 giorni; attivarlo prima farebbe girare i cron a vuoto e brucerebbe crediti Firecrawl/AI).
- **Salvo** questo piano nella memoria del progetto (`mem://features/cron-inps-2026-07-31.md`) così il 31/07 basta dirmi "vai" e lo eseguo pari pari.

## Cosa devi fare tu il 31 luglio 2026

Aprire la chat e scrivere: **"Esegui il piano cron INPS del 31 luglio"**. Io recupero questo file di memoria e procedo.
