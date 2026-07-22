## Nessuna modifica al codice

L'utente voleva solo capire come funziona oggi l'aggiunta di utenti a un workspace. Il meccanismo attuale è:

1. **Capo-studio** entra in Impostazioni → Workspace, inserisce email + ruolo → viene creata riga in `workspace_invitations` con `token` (limiti posti disattivati in fase di prova).
2. **Invio del link**: oggi manuale — bisogna copiare `/accept-invite?token=...` e mandarlo al collega (nessun servizio email automatico collegato).
3. **Invitato** si registra/logga con la stessa email dell'invito (l'RPC `accept_workspace_invitation` verifica il match email ↔ JWT), poi:
   - apre il link `/accept-invite?token=...`, oppure
   - al primo login vede l'invito in `/onboarding` e clicca "Accetta".
4. L'accettazione lo inserisce in `workspace_members` con il ruolo previsto e marca l'invito come `accepted`.

Non esistono ancora: invio email automatico, link pubblico "chiunque-con-il-link", auto-join per dominio email. Credenziali condivise sono sconsigliate — ogni operatore ha il suo account, il workspace è l'oggetto condiviso.

L'utente ha scelto "Solo spiegazione, non modificare nulla ora", quindi non serve alcun intervento. Se in futuro vorrà attivare invio email automatico o link condivisibile, apriremo un piano dedicato.