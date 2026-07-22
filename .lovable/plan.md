# Accesso a workspace condivisi + piano subscription

## Come funziona OGGI (già implementato)

Ogni utente ha **credenziali personali** (email/password o Google). Nessuno condivide login — sarebbe insicuro e romperebbe audit, RLS e attribuzione delle azioni. L'accesso condiviso al workspace funziona così:

1. Il "capo" (owner) si registra e crea un workspace da `/onboarding` → riga in `workspaces` + `workspace_members` con ruolo `owner`.
2. Da **Impostazioni → Team** invia inviti via email (tabella `workspace_invitations`, token univoco, scadenza, ruolo `admin`/`member`).
3. Il collega si registra con la SUA email → in `/onboarding` vede "Hai inviti in attesa" (`listMyPendingInvitations` filtra per email JWT) → clicca **Accetta** → RPC `accept_workspace_invitation` lo inserisce in `workspace_members`.
4. Da quel momento vede il workspace nel selector (header) e tutti i dati sono condivisi via RLS su `workspace_id`.

Ruoli attuali: `owner`, `admin`, `member`, `viewer`. Manca `viewer` UI-side ma esiste in enum.

**Quindi: già ora è "un utente = un account", niente credenziali condivise.** Quello che manca per il lancio è: (a) limiti/quota per piano, (b) billing, (c) gating features.

## Cosa aggiungere per il lancio

### 1. Modello subscription (a livello workspace, non utente)

Nuova tabella `workspace_subscriptions`:
- `workspace_id` (FK, unique)
- `plan` enum: `free` | `studio` | `pro` | `enterprise`
- `status`: `trialing` | `active` | `past_due` | `canceled`
- `seats_limit` int, `queries_limit_monthly` int, `sources_limit` int
- `features` jsonb (feature flags per pacchetto opzionale)
- `current_period_end`, `provider` (`stripe`/`paddle`), `provider_customer_id`, `provider_subscription_id`
- `trial_ends_at`

Nuova tabella `workspace_usage_monthly`:
- `workspace_id`, `period` (YYYY-MM), `queries_count`, `ai_tokens`, `firecrawl_calls`, `sources_added`
- Incrementata da server functions (chat, analyze, summarize, ingest) con `supabaseAdmin`.

Helper: `public.can_add_seat(_ws)`, `public.can_run_query(_ws)` security-definer da chiamare dagli entry point.

### 2. Piani proposti (ipotesi lancio)

| Piano | Prezzo/mese | Seats | Query AI/mese | Ingest INPS | Extra |
|---|---|---|---|---|---|
| **Free / Trial** | 0 (14gg) | 1 | 50 | solo lettura corpus | — |
| **Studio** | ~39€ | 3 | 500 | batch lite | Flussi, Reminders, Memory |
| **Pro** | ~99€ | 10 | 2.500 | batch Firecrawl | + Alerts, Cron, Priorità supporto |
| **Enterprise** | custom | illimitati* | custom | + SSO SAML | + audit log, onboarding, DPA |

Add-on pacchetti opzionali (feature flags): `alerts_advanced`, `bulk_import`, `api_access`, `white_label`.

### 3. Flusso billing (usa payments built-in di Lovable)

- Owner apre **Impostazioni → Piano** → sceglie tier → checkout Stripe (`enable_stripe_payments`, MOR).
- Webhook `/api/public/webhooks/stripe` aggiorna `workspace_subscriptions`.
- Portale cliente Stripe per cambio piano / metodo pagamento / fatture.
- Solo `owner` (e forse `admin`) può gestire billing.

### 4. Enforcement quota

- **Prima di ogni azione a costo**: server fn chiama `can_run_query()` / `can_add_seat()`. Se supera limite → errore strutturato → UI mostra dialog "Hai raggiunto il limite, fai upgrade".
- `createInvitation` conta membri attivi + inviti pending vs `seats_limit`.
- Cron mensile azzera contatori a inizio periodo (o calcolati per `current_period_start`).

### 5. UI da aggiungere

- `/settings` → nuova tab **Piano & Fatturazione** (piano corrente, uso mese, upgrade CTA, portale Stripe).
- `/settings` → tab **Team**: badge "X/Y posti", disabilita "Invita" se pieno.
- Banner globale se `status = past_due` o trial in scadenza.
- Selettore workspace già presente nell'header (utenti in più workspace switchano).

### 6. Sicurezza / edge cases

- RLS: `workspace_subscriptions` leggibile da membri, scrivibile solo da `service_role` (webhook).
- Owner unico per workspace: aggiungere "Trasferisci ownership" nel Team.
- Downgrade con troppi seats: blocca l'azione finché non rimuove membri.
- Cancellazione: passa a `canceled` a fine periodo, poi read-only.

## Dettagli tecnici (per implementazione futura)

- Migrations: 2 nuove tabelle + enum `subscription_plan`/`subscription_status` + funzioni `has_workspace_role`, `can_run_query`, `can_add_seat`, `increment_usage`.
- Nuovi server fn in `src/lib/billing.functions.ts`: `getMySubscription`, `getMonthlyUsage`, `createCheckoutSession`, `openBillingPortal`.
- Webhook: `src/routes/api/public/webhooks/stripe.ts` con verifica firma HMAC, gestione eventi `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.
- Feature gate helper `useFeature("alerts_advanced")` che legge da subscription + fallback.

## Ordine di implementazione consigliato

1. Schema + RLS + funzioni quota (1 migration).
2. Server fn billing + UI Piano (senza Stripe reale, solo mock/free).
3. Enforcement seats/queries.
4. Integrazione Stripe payments quando pronti al lancio (`recommend_payment_provider` → `enable_stripe_payments`).
5. Webhook + portale.

## Domande aperte per te

- Confermi i **prezzi/limiti** proposti o preferisci altri numeri?
- Vuoi **trial 14gg** automatico all'iscrizione o piano Free permanente?
- Preferisci **Stripe** (raccomandato: MOR possibile in Italia, gestisce IVA UE) o Paddle?
- Ownership: **un solo owner** per workspace o multi-owner?
