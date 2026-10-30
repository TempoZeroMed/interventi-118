<ruolo>
Sei uno sviluppatore web senior esperto di PWA offline-first per Safari iOS. Lavori per un infermiere del 118 che registra le proprie uscite in ambulanza ed elisoccorso. Priorità: inserimento rapido da telefono, dati che non si perdono, statistiche identiche a quelle del foglio Excel attuale.
</ruolo>

<contesto>
- Nella cartella di progetto c'è `Report_Interventi_118_2026_v2.xlsx`. È la fonte di verità per struttura, liste e regole. Leggilo tutto prima di scrivere codice: fogli "Istruzioni", "Interventi", "Statistiche", "Liste", comprese le formule delle colonne calcolate e la convalida dati.
- Ci sono circa 212 interventi reali (gennaio–ottobre 2026), da importare.
- Dispositivi: Mac (Safari) e iPhone. Nuovi interventi inseriti da entrambi.
- Architettura scelta: PWA statica ospitata su GitHub Pages e installata nella schermata Home dell'iPhone. I dati restano solo nel dispositivo (IndexedDB). Backup e passaggio dei dati tra dispositivi tramite file JSON salvati su iCloud Drive. Nessun backend, nessun server che riceve dati.
- I dati sono sanitari pseudonimizzati (missione, data, comune, età, sesso, patologia). Non devono mai lasciare il dispositivo, salvo export esplicito dell'utente.
</contesto>

<vincoli_tassativi>
- Stack: HTML + CSS + JavaScript vanilla (ES modules), nessun build step. Librerie consentite solo in copia locale nella cartella `vendor/`: Chart.js per i grafici e SheetJS (xlsx) per import/export Excel. Nessuna CDN a runtime: l'app MUST funzionare completamente offline dopo il primo caricamento.
- Nessuna analytics, nessun font o script esterno, nessuna chiamata di rete, a parte il service worker che mette in cache i file dell'app. Eccezione aggiunta il 2026-10-30 con l'ok dell'utente: le domande all'archivio (riquadro nelle Statistiche), solo su azione esplicita, inviano al Worker dell'app il testo della domanda, le voci delle liste e i comuni distinti; gli interventi non escono mai dal dispositivo.
- Interfaccia in italiano, mobile-first (iPhone ~390px), usabile anche a 1440px su Mac. Supporto dark mode.
- NON modificare mai il file .xlsx originale.
- Costruisci solo quanto elencato qui. Niente login, account, backend, notifiche o funzioni extra.
</vincoli_tassativi>

<modello_dati>
Un record = una missione/paziente, con i campi del foglio "Interventi": DATA, ORA ALLERT., MISSIONE, COMUNE, MEZZO, TIPOLOGIA, CODICE invio, PATOLOGIA invio, LUOGO invio, ETÀ, SESSO, ESITO, OSPEDALE, CODICE rientro, PATOLOGIA rientro, LUOGO rientro, LIBERO OPERATIVO.
Campi tecnici aggiuntivi: `id` (UUID), `createdAt`, `updatedAt`, `deleted` (eliminazione logica). Servono per il merge tra dispositivi.
Le liste dei menu (codici, patologie, luoghi, tipologia, sesso, esiti, ospedali, mezzi) vanno estratte dal foglio "Liste" e rese modificabili da una schermata Impostazioni (aggiungi, rinomina, disattiva; mai cancellare una voce già usata).

Campi calcolati, da replicare esattamente come nelle formule Excel:
- DURATA (min) = LIBERO OPERATIVO − ORA ALLERT., gestendo il passaggio della mezzanotte (MOD 1440)
- MESE, ORA DEL GIORNO (dall'ora di allertamento)
- Δ CODICE = posizione rientro − posizione invio nella scala VERDE < GIALLO < ROSSO; vuoto se manca uno dei due o se il rientro è NERO

Controlli di qualità (avvisi non bloccanti, salvo dove indicato):
data o ore non valide; MISSIONE diversa da 8 caratteri; MISSIONE duplicata (bloccante, con possibilità di aprire il duplicato); mezzi 3040, 5022, 5024 con tipologia Mike; OSPEDALE compilato con ESITO diverso da "Trasportato"; ETÀ non intera o negativa.
</modello_dati>

<funzionalita>
1. Inserimento rapido. Form a schermo singolo ottimizzato per il pollice, sezioni come nel foglio (Identificazione, Mezzo, Invio CO, Paziente, Esito, Rientro, Tempi).
   - Codici colore come pulsanti colorati, non menu a tendina.
   - DATA predefinita a oggi; pulsante "adesso" per le ore.
   - COMUNE: testo libero, convertito in MAIUSCOLO, con autocompletamento dai valori già usati.
   - Scegliendo i mezzi 3040, 5022 o 5024 la TIPOLOGIA viene impostata su India.
   - Pulsante "copia da invio" per riportare codice, patologia e luogo nel rientro.
   - Il campo OSPEDALE compare solo se l'esito è "Trasportato".
   - Nessun campo obbligatorio, eccetto DATA o MISSIONE (almeno uno).
2. Consultazione. Elenco cronologico con ricerca (missione, comune) e filtri combinabili: periodo, mezzo, tipologia, codici, patologia, esito, ospedale, righe con avvisi. Ogni intervento si apre in un dettaglio modificabile o eliminabile (con conferma).
3. Statistiche. Ricalcolate dal vivo su un periodo selezionabile (anno, mese, intervallo libero). Devono riprodurre le 12 tabelle e i 6 grafici del foglio "Statistiche", usando le definizioni del foglio "Istruzioni":
   - interventi totali = righe con DATA o MISSIONE
   - pazienti valutati = totali − "Annullato da CO" − "Non Raggiungibile"
   - percentuali degli ospedali calcolate sui soli trasportati
   - NERO escluso dal confronto invio/rientro
   In alto, i KPI della dashboard Excel: interventi, trasportati, rossi al rientro, durata mediana, età mediana, avvisi da controllare.
4. Dati e sincronizzazione.
   - Import iniziale: script `tools/xlsx_to_json.py` (oppure equivalente in Node) che converte il foglio "Interventi" nel formato JSON dell'app, insieme a un'importazione dal JSON dentro l'app.
   - Export JSON: su iPhone tramite Web Share API con file, così l'utente sceglie "Salva su File" → iCloud Drive; su Mac tramite download. Nome file: `interventi118_AAAA-MM-GG_HHMM.json`.
   - Import JSON con MERGE, non sostituzione: unione per `id`, vince l'`updatedAt` più recente, le eliminazioni logiche vengono propagate. A fine import mostra il riepilogo (nuovi, aggiornati, invariati, conflitti).
   - Export .xlsx con la stessa struttura di colonne del foglio "Interventi", per l'archivio.
   - Promemoria visibile se l'ultimo backup è più vecchio di 7 giorni o se ci sono più di 10 modifiche non esportate.
   - Chiama `navigator.storage.persist()` all'avvio e mostra l'esito nelle Impostazioni.
5. PWA. Manifest, icone, service worker cache-first, installabile da Safari iOS con "Aggiungi alla schermata Home". Nelle Impostazioni metti una breve guida all'installazione.
</funzionalita>

<processo>
1. Leggi il file Excel e presentami un piano breve: struttura delle cartelle, schema dati, elenco delle 12 statistiche con la loro definizione, eventuali ambiguità trovate nelle formule. ATTENDI la mia conferma prima di scrivere codice.
2. Implementa per prima la logica pura (campi calcolati, controlli, statistiche, merge) in moduli separati dalla UI, con test `node --test`.
   Test obbligatori:
   - le statistiche calcolate sui 212 record importati coincidono con i valori che il foglio "Statistiche" mostra per gli stessi dati (calcola i valori attesi in Python dalle stesse regole e confrontali)
   - durata a cavallo della mezzanotte
   - merge con conflitti ed eliminazioni
3. Poi UI, PWA e import/export.
4. Verifica con Playwright a 390px e 1440px: inserimento, modifica, filtro, statistiche, export, reimport con merge, funzionamento offline. Salva gli screenshot in `docs/screenshots/`.
5. Scrivi un `README.md` in italiano con: avvio in locale, pubblicazione su GitHub Pages, installazione su iPhone, procedura di backup e passaggio dei dati tra Mac e iPhone.

Dopo ogni fase scrivi: ✅ [cosa è completato] + i risultati dei test o delle verifiche effettivamente eseguiti.
</processo>

<stop_e_conferme>
Fermati e chiedimi conferma prima di: creare o pubblicare un repository GitHub, fare push, aggiungere qualsiasi dipendenza non elencata, cancellare file, cambiare l'architettura scelta.
Se un test di coerenza con l'Excel fallisce e la causa è un'ambiguità della formula originale, non scegliere da solo: mostrami il caso e chiedi.
Se lo stesso errore persiste dopo 3 tentativi di correzione, fermati e riportami il problema.
</stop_e_conferme>

<done>
Il lavoro è finito quando:
- tutti i test passano
- le statistiche sui dati importati coincidono con l'Excel
- l'app funziona offline a 390px e 1440px
- export e reimport con merge non perdono né duplicano record
- il README è completo
Consegna finale: riepilogo dei file creati, risultati dei test e limiti noti.
</done>
