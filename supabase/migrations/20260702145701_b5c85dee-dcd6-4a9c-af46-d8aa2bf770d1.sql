
CREATE OR REPLACE FUNCTION public.set_updated_at_flows() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.operational_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  query text NOT NULL DEFAULT '',
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  icon text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_flows TO authenticated;
GRANT ALL ON public.operational_flows TO service_role;

ALTER TABLE public.operational_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flows_select" ON public.operational_flows FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = operational_flows.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "flows_insert" ON public.operational_flows FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = operational_flows.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "flows_update" ON public.operational_flows FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = operational_flows.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "flows_delete" ON public.operational_flows FOR DELETE TO authenticated
  USING (workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = operational_flows.workspace_id AND wm.user_id = auth.uid()));

CREATE TRIGGER trg_operational_flows_updated_at BEFORE UPDATE ON public.operational_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_flows();

CREATE INDEX idx_operational_flows_workspace ON public.operational_flows(workspace_id);

INSERT INTO public.operational_flows (workspace_id, title, description, query, checklist_items, icon, is_default) VALUES
(NULL, 'Nuova domanda ADI', 'Assegno di Inclusione: requisiti, documenti e passi per presentare la domanda.', 'Assegno di Inclusione ADI requisiti domanda ISEE nucleo familiare',
  '["ISEE in corso di validità (soglia ≤ 10.140 €)","Composizione nucleo familiare con almeno un componente tutelato (minore, disabile, over 60, presa in carico servizi socio-sanitari)","Residenza in Italia da almeno 5 anni (di cui ultimi 2 continuativi)","Iscrizione al PAD/Patto di Attivazione Digitale","Cittadinanza IT/UE o permesso di soggiorno UE per lungo periodo","Verifica assenza cause ostative (condanne, misure cautelari)","Trasmissione domanda tramite portale INPS o patronato","Sottoscrizione Patto di Inclusione presso Servizi Sociali"]'::jsonb,
  'FileText', true),
(NULL, 'Rinnovo Assegno Unico Universale', 'Verifica rinnovo AUU per l''anno in corso: ISEE, variazioni nucleo, importi.', 'Assegno Unico Universale AUU rinnovo ISEE 2026 importi arretrati',
  '["Presentazione nuovo ISEE entro il 28 febbraio per continuità importi","Verifica variazioni nucleo familiare (nascite, decessi, separazioni)","Aggiornamento IBAN beneficiario","Controllo maggiorazioni (madri under 21, disabilità, nuclei numerosi)","Verifica compatibilità con RdC/ADI","Controllo eventuali arretrati spettanti","Comunicazione redditi esteri se presenti"]'::jsonb,
  'RefreshCw', true),
(NULL, 'Valutazione NASpI dopo licenziamento', 'Requisiti contributivi e lavorativi per la NASpI, tempistiche di presentazione.', 'NASpI licenziamento requisiti contributivi 13 settimane termine 68 giorni',
  '["Cessazione involontaria del rapporto di lavoro (esclusi dimissioni volontarie non per giusta causa)","Almeno 13 settimane di contribuzione nei 4 anni precedenti","Stato di disoccupazione con DID sul portale ANPAL","Presentazione domanda entro 68 giorni dalla cessazione","Calcolo retribuzione media imponibile ultimi 4 anni","Verifica compatibilità con altri redditi (lavoro accessorio, autonomo occasionale)","Comunicazione eventuali nuovi rapporti di lavoro","Partecipazione a percorsi di politica attiva del lavoro"]'::jsonb,
  'Briefcase', true),
(NULL, 'Domanda pensione anticipata', 'Verifica requisiti contributivi e finestra mobile per pensione anticipata ordinaria.', 'pensione anticipata requisiti contributivi finestra mobile 2026',
  '["Contribuzione minima 42 anni e 10 mesi (uomini) o 41 anni e 10 mesi (donne)","Estratto conto contributivo aggiornato","Verifica contributi figurativi, riscatti, ricongiunzioni","Rispetto finestra mobile di 3 mesi dalla maturazione","Domanda telematica tramite portale INPS o patronato","Scelta decorrenza e calcolo importo (retributivo/misto/contributivo)","Verifica cumulo con eventuali redditi da lavoro"]'::jsonb,
  'Clock', true),
(NULL, 'Congedo parentale', 'Fruizione congedo parentale: requisiti, durata, indennità e modalità di richiesta.', 'congedo parentale indennità 80% mesi fruizione lavoratori dipendenti',
  '["Verifica età del figlio (entro 12 anni)","Calcolo mesi residui spettanti al nucleo (max 9 mesi complessivi)","Determinazione indennità (80% primo mese, 30% mesi successivi ordinari)","Comunicazione preventiva al datore di lavoro (almeno 5 giorni)","Domanda telematica INPS entro l''inizio del congedo","Allegare eventuale documentazione (certificato nascita, dichiarazione altro genitore)","Verifica compatibilità con altre prestazioni (bonus asilo nido, AUU)"]'::jsonb,
  'Heart', true);
