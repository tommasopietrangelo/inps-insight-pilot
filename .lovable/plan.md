## Obiettivo
Quando i crediti Firecrawl torneranno disponibili, recuperare velocemente i ~1333 URL in errore senza dover ricreare il batch manualmente.

## Cosa costruire

### 1. Server function `retryInpsErrors` (in `src/lib/inps-operational.functions.ts`)
Una server function autenticata (admin-only via `has_role`) che:
- Accetta input opzionale `{ scope: "all" | "transient" | "credits" }` (default `"all"`).
- Resetta le righe di `inps_ingest_queue` con `status='error'` a `status='pending'`, azzerando `external_id=NULL`, `error=NULL`, `attempts=0`.
- Filtri per `scope`:
  - `"credits"` → solo errori che contengono `402` o `Insufficient credits`.
  - `"transient"` → solo errori con `429`, `408`, `502`, `503`, `504`, `timeout`, `ECONNRESET`.
  - `"all"` → tutti gli errori.
- Ritorna `{ reset: number }`.

### 2. UI in `src/routes/_appshell.settings.tsx`
Nella sezione INPS già esistente, aggiungere una card "Recupero errori" con:
- Conteggio live degli errori in coda, suddiviso per categoria (crediti / transitori / altri), letto via una piccola server function `getInpsErrorBreakdown`.
- Tre pulsanti:
  - **"Riprova errori da crediti esauriti"** (utile dopo la ricarica Firecrawl).
  - **"Riprova errori transitori"** (429/timeout/5xx).
  - **"Riprova tutti gli errori"** (azione secondaria, con conferma).
- Toast con il numero di righe resettate; dopo il reset basta che il worker di ingest giri (cron o pulsante batch già esistente) per riprocessarle.

### 3. Nessuna modifica al worker
Il worker esistente legge già le righe `pending` — non serve toccarlo. Il fix sui retry automatici in-loop (opzione A della discussione precedente) viene **rimandato**: il pulsante manuale copre il caso d'uso richiesto ed è più trasparente.

## Dettagli tecnici
- Le due server function usano `requireSupabaseAuth` + check `has_role(_, 'admin')` prima di scrivere.
- Update SQL via `supabase.from('inps_ingest_queue').update(...).eq('status','error').or(...)` con pattern `ilike` sui codici di errore.
- La card mostra anche un hint: "Dopo il reset, lancia il batch di ingest per riprocessare le righe".

## File toccati
- `src/lib/inps-operational.functions.ts` — aggiungere `retryInpsErrors` e `getInpsErrorBreakdown`.
- `src/routes/_appshell.settings.tsx` — aggiungere card "Recupero errori".
