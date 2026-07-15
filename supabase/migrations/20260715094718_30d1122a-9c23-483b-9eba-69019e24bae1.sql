
-- Recategorize default operational flows into structured checklist items
UPDATE public.operational_flows
SET checklist_items = '[
  {"section":"requisiti","title":"ISEE in corso di validità (soglia ≤ 10.140 €)"},
  {"section":"requisiti","title":"Composizione nucleo familiare con almeno un componente tutelato (minore, disabile, over 60, presa in carico servizi socio-sanitari)"},
  {"section":"requisiti","title":"Residenza in Italia da almeno 5 anni (di cui ultimi 2 continuativi)"},
  {"section":"requisiti","title":"Cittadinanza IT/UE o permesso di soggiorno UE per lungo periodo"},
  {"section":"controlli","title":"Verifica assenza cause ostative (condanne, misure cautelari)"},
  {"section":"passi_successivi","title":"Iscrizione al PAD/Patto di Attivazione Digitale"},
  {"section":"passi_successivi","title":"Trasmissione domanda tramite portale INPS o patronato"},
  {"section":"passi_successivi","title":"Sottoscrizione Patto di Inclusione presso Servizi Sociali"}
]'::jsonb
WHERE is_default = true AND title = 'Nuova domanda ADI';

UPDATE public.operational_flows
SET checklist_items = '[
  {"section":"requisiti","title":"Verifica compatibilità con RdC/ADI"},
  {"section":"documenti","title":"Presentazione nuovo ISEE entro il 28 febbraio per continuità importi"},
  {"section":"documenti","title":"Aggiornamento IBAN beneficiario"},
  {"section":"controlli","title":"Verifica variazioni nucleo familiare (nascite, decessi, separazioni)"},
  {"section":"controlli","title":"Controllo maggiorazioni (madri under 21, disabilità, nuclei numerosi)"},
  {"section":"controlli","title":"Controllo eventuali arretrati spettanti"},
  {"section":"controlli","title":"Comunicazione redditi esteri se presenti"}
]'::jsonb
WHERE is_default = true AND title = 'Rinnovo Assegno Unico Universale';

UPDATE public.operational_flows
SET checklist_items = '[
  {"section":"requisiti","title":"Cessazione involontaria del rapporto di lavoro (esclusi dimissioni volontarie non per giusta causa)"},
  {"section":"requisiti","title":"Almeno 13 settimane di contribuzione nei 4 anni precedenti"},
  {"section":"requisiti","title":"Stato di disoccupazione con DID sul portale ANPAL"},
  {"section":"documenti","title":"Calcolo retribuzione media imponibile ultimi 4 anni"},
  {"section":"controlli","title":"Verifica compatibilità con altri redditi (lavoro accessorio, autonomo occasionale)"},
  {"section":"passi_successivi","title":"Presentazione domanda entro 68 giorni dalla cessazione"},
  {"section":"passi_successivi","title":"Comunicazione eventuali nuovi rapporti di lavoro"},
  {"section":"passi_successivi","title":"Partecipazione a percorsi di politica attiva del lavoro"}
]'::jsonb
WHERE is_default = true AND title = 'Valutazione NASpI dopo licenziamento';

UPDATE public.operational_flows
SET checklist_items = '[
  {"section":"requisiti","title":"Contribuzione minima 42 anni e 10 mesi (uomini) o 41 anni e 10 mesi (donne)"},
  {"section":"requisiti","title":"Rispetto finestra mobile di 3 mesi dalla maturazione"},
  {"section":"documenti","title":"Estratto conto contributivo aggiornato"},
  {"section":"controlli","title":"Verifica contributi figurativi, riscatti, ricongiunzioni"},
  {"section":"controlli","title":"Verifica cumulo con eventuali redditi da lavoro"},
  {"section":"passi_successivi","title":"Domanda telematica tramite portale INPS o patronato"},
  {"section":"passi_successivi","title":"Scelta decorrenza e calcolo importo (retributivo/misto/contributivo)"}
]'::jsonb
WHERE is_default = true AND title = 'Domanda pensione anticipata';

UPDATE public.operational_flows
SET checklist_items = '[
  {"section":"requisiti","title":"Verifica età del figlio (entro 12 anni)"},
  {"section":"requisiti","title":"Calcolo mesi residui spettanti al nucleo (max 9 mesi complessivi)"},
  {"section":"documenti","title":"Allegare eventuale documentazione (certificato nascita, dichiarazione altro genitore)"},
  {"section":"controlli","title":"Determinazione indennità (80% primo mese, 30% mesi successivi ordinari)"},
  {"section":"controlli","title":"Verifica compatibilità con altre prestazioni (bonus asilo nido, AUU)"},
  {"section":"passi_successivi","title":"Comunicazione preventiva al datore di lavoro (almeno 5 giorni)"},
  {"section":"passi_successivi","title":"Domanda telematica INPS entro l''inizio del congedo"}
]'::jsonb
WHERE is_default = true AND title = 'Congedo parentale';
