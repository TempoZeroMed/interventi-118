# Volo e operazioni speciali (elisoccorso) – design

Data: 2026-10-30. Stato: approvato a voce in chat, da rivedere in forma scritta.

## Obiettivo

L'app sostituisce anche il secondo foglio di lavoro, `Report Voli HEMS 2026.xlsx`, per la sola parte che non è già nella
scheda di intervento: **tempo di volo, tipo di missione e manovre**. Codici colore, patologie, luoghi, orari ed esito di
una missione in elicottero restano quelli del 118, già registrati e già contati nelle statistiche esistenti.

Criteri di riuscita:

- registrare il volo di una missione V-ECHO o T-ECHO richiede pochi tocchi in più nello stesso form;
- le statistiche di volo coincidono con le tabelle di volo del foglio "Statistiche" dell'Excel HEMS;
- le statistiche e i test del 118 restano invariati, salvo i nuovi avvisi (scelta confermata);
- nessun dato si perde nel passaggio dei backup tra un dispositivo aggiornato e uno non ancora aggiornato.

## Fonte: cosa c'è nell'Excel HEMS

Foglio "Voli": una riga per missione, con gli stessi campi del foglio "Interventi" più:

| Colonna | Contenuto | Regole |
|---|---|---|
| TIPO MISSIONE | HEMS, HSR, IFT | menu a tendina dal foglio "Liste" |
| TEMPO VOLO (min) | minuti totali di volo, scritti a mano | intero 0–600; comprende il rientro in base, può superare la durata |
| HD, VD, HS, VS, VSP, VSB | una X se la manovra è stata fatta | HD Hovering Discesa, VD Verricello Discesa, HS Hovering Salita, VS Verricello Salita, VSP Verricello Salita Pannolone, VSB Verricello Salita Barella |
| N. MANOVRE (calcolata) | numero di X sulla riga | |

Controlli della colonna CONTROLLI ripresi nell'app: "Tipo missione mancante", "Tempo volo mancante".
Gli altri controlli del foglio HEMS riguardano la scheda di intervento e restano quelli del 118.

## Scelte confermate (2026-10-30)

1. **Solo volo e operazioni speciali.** Nessuna tabella clinica in più: priorità, patologie, luoghi, esito, ospedale,
   età e sesso delle missioni in elicottero sono già nelle statistiche del 118.
2. **Import dei dati esistenti con uno script**, che completa le missioni già presenti nell'app; quelle che non trova le
   elenca, per completarle a mano dal form.
3. **I nuovi controlli sono avvisi normali**: badge nell'elenco, filtro "righe con avvisi", KPI e tabella dei controlli.
   Il confronto automatico con l'Excel 118 li esclude, perché lì non esistono.

## 1. Modello dati

Tre campi nuovi nel record. Per i mezzi che non sono elicotteri restano vuoti.

| Chiave | Tipo | Vuoto |
|---|---|---|
| `tipoMissione` | testo, voce della lista `tipoMissione` | `''` |
| `tempoVolo` | numero di minuti (un testo non numerico resta testo, per l'avviso) | `null` |
| `manovre` | array di codici tra `HD, VD, HS, VS, VSP, VSB` | `[]` |

- `normalizzaRecord` aggiunge i tre campi a ogni record. `tempoVolo` si normalizza come l'età: `''` diventa `null`,
  un numero scritto come testo (anche con la virgola) diventa numero. `manovre` tiene solo i codici noti, senza
  ripetizioni, nell'ordine fisso HD, VD, HS, VS, VSP, VSB.
- I record letti da IndexedDB passano da `normalizzaRecord` al caricamento, solo in memoria: i record salvati prima
  dell'aggiornamento hanno così i campi nuovi vuoti, senza riscrivere l'archivio.
- **Elicotteri**: `MEZZI_ELICOTTERO = ['V-ECHO', 'T-ECHO']`. Diventano voci di sistema della lista `mezzo`, come 3040,
  5022 e 5024: non si rinominano né si disattivano. Il blocco si decide dal nome della voce, non dal flag salvato,
  così vale anche per le liste già salvate sui dispositivi.
- **Lista nuova `tipoMissione`**: HEMS, HSR, IFT, nell'ordine del foglio "Liste". Si modifica dalle Impostazioni come le
  altre, senza voci di sistema: le statistiche la leggono dalla lista. Sui dispositivi esistenti viene aggiunta al
  caricamento, come già succede per una lista mancante.
- **Manovre**: costante `MANOVRE` con codice e nome; non è una lista modificabile.

## 2. Form

- Scegliendo V-ECHO o T-ECHO compare la sezione **"Volo"**, dopo "Tempi". Per gli altri mezzi è nascosta.
  - **Tipo missione**: pulsanti HEMS / HSR / IFT (le voci attive della lista), come gli altri campi a scelta.
  - **Tempo di volo (min)**: campo numerico con tastiera numerica (`inputmode="numeric"`).
  - **Manovre**: 6 pulsanti da accendere e spegnere, con codice e nome (per esempio "VD · Verricello discesa"),
    `aria-pressed` per lo stato.
- Cambiando mezzo verso un mezzo che non è un elicottero, `tipoMissione`, `tempoVolo` e `manovre` si svuotano, come
  l'ospedale quando l'esito non è "Trasportato" (regola in `impostaCampo`, coperta dai test).
- Nessun campo nuovo è obbligatorio.

## 3. Controlli di qualità

Tre avvisi nuovi, aggiunti in fondo a `TIPI_AVVISO`:

| Avviso | Quando |
|---|---|
| Tipo missione mancante | mezzo V-ECHO o T-ECHO e `tipoMissione` vuoto |
| Tempo volo mancante | mezzo V-ECHO o T-ECHO e `tempoVolo` vuoto |
| Tempo volo non valido | `tempoVolo` compilato ma non intero, negativo o oltre 600 (convalida dell'Excel HEMS) |

Valgono come gli altri avvisi: badge nell'elenco, filtro "righe con avvisi", KPI "avvisi da controllare", tabella dei
controlli, colonna CONTROLLI dell'export. Il test di confronto con l'Excel 118 conta solo i tipi di avviso del 118.

## 4. Backup e merge

- Il formato del backup passa alla **versione 2**. L'app legge le versioni 1 e 2; scrive la 2.
- Un'app non ancora aggiornata rifiuta un backup versione 2 con "aggiorna l'app e riprova" (comportamento già presente):
  così non importa i record togliendo in silenzio i dati di volo.
- Il confronto tra due versioni di un record nel merge (`contenuto`) usa i record normalizzati: un record senza i campi
  nuovi e lo stesso record con i campi nuovi vuoti risultano uguali, quindi non contano come aggiornati o in conflitto.
- `tools/xlsx_to_json.py` non cambia: produce un backup versione 1, che l'app continua a leggere.

## 5. Script di import: `tools/hems_to_json.py`

Solo libreria standard di Python, come gli altri strumenti. Non modifica mai i file di partenza.

- **Ingressi**:
  - l'Excel HEMS (argomento; predefinito `Report Voli HEMS 2026.xlsx` nella cartella del progetto, esclusa da git);
  - un backup JSON dell'app (opzione `--base`; predefinito `data/interventi_import.json`). Consigliato: un backup
    appena esportato dal telefono, così lo script lavora sui dati di oggi.
- **Abbinamento**: per MISSIONE (spazi tolti, maiuscolo) tra i record non eliminati del backup.
  - Trovato una volta: copia `tipoMissione`, `tempoVolo`, `manovre` dall'Excel e mette `updatedAt` all'istante
    dell'esecuzione. Se i campi di volo sono già uguali, il record non viene incluso.
  - Se data, mezzo o comune del record non coincidono con la riga HEMS, lo segnala ma completa comunque il volo.
  - Non trovato, trovato più volte o riga HEMS senza MISSIONE: nessuna scrittura, la riga va nell'elenco finale da
    completare a mano.
- **Uscita**: `data/voli_import.json`, backup versione 2 con i soli record completati (nessuna lista), da importare da
  **Impostazioni → Importa backup**. Il merge li aggiorna perché sono più recenti.
- Se uno di quei record è stato modificato sul dispositivo dopo il backup usato come base, la versione dello script
  vince e il riepilogo dell'import lo elenca tra i conflitti. Per evitarlo si parte da un backup appena esportato.
- A video: quante righe lette, quante completate, quali saltate e perché (con il numero di riga dell'Excel).

## 6. Statistiche: vista "Volo"

Sotto il selettore del periodo, un interruttore **Interventi | Volo**. Il periodo è condiviso e la scelta resta finché
l'app è aperta. La vista "Interventi" non cambia.

La vista "Volo" usa una funzione pura nuova, `calcolaStatisticheVolo(records, liste, periodo)`, in un modulo separato.
**Base**: gli interventi del periodo (stessa `filtraPeriodo` del 118) con mezzo V-ECHO o T-ECHO. Le formule sono quelle
del foglio "Statistiche" HEMS; i nomi tra parentesi sono le celle di origine.

Basi di calcolo:

- **M** missioni = interventi del periodo con mezzo elicottero (C13);
- **T** missioni con tempo di volo = M con `tempoVolo` numerico (C15).

KPI (riga 4–6):

| KPI | Valore | Sotto |
|---|---|---|
| Missioni | M | "V-ECHO n · T-ECHO n" |
| Ore di volo | somma dei minuti, mostrata in ore:minuti | "su T missioni con tempo" |
| Volo medio | media dei minuti, una cifra decimale; vuoto se T = 0 | "mediana n min" |
| Con manovre | missioni con almeno una manovra | "n% delle missioni" (TEXT "0%") |

Tabelle:

1. **Tempo di volo** (righe 23–27): totale (ore:minuti), media, mediana, minimo, massimo; base T.
2. **Per mezzo** (righe 34–35): per ogni elicottero missioni, % su M, ore di volo, volo medio (sulle missioni del mezzo
   con tempo; vuoto se nessuna), missioni con tempo.
3. **Tipo di missione** (righe 40–43): per ogni voce della lista `tipoMissione` (attive, più le disattivate se usate, più
   i valori fuori lista) missioni, % sulle missioni con tipo compilato, ore di volo; riga "Non compilato" = M − compilati.
4. **Manovre** (righe 55–63): per ognuna delle 6 manovre missioni e % su M; poi "Almeno una manovra", "Più di una
   manovra", "Nessuna manovra", con % su M.
5. **Per mese** (righe 184–195): mesi del periodo, come la tabella per mese del 118 (con l'anno se il periodo ne copre
   più di uno); per ogni mese missioni, ore di volo, volo medio, missioni con manovre.

Grafici (gli stessi tre dell'Excel HEMS, con Chart.js come gli altri):

- **Ore di volo per mese**: colonne, ore con una cifra decimale (ROUND(ore × 24; 1)).
- **Manovre**: barre orizzontali, % delle missioni per ognuna delle 6 manovre.
- **Missioni per mezzo**: colonne.

Se M = 0: messaggio "Nessuna missione in elicottero in questo periodo" al posto di KPI, grafici e tabelle.

Restano fuori, per la scelta 1: TRASPORTATI, DURATA MEDIA, durata missione media, tipologia India/Mike e tutte le
tabelle cliniche del foglio HEMS.

## 7. Export Excel

Nel foglio "Interventi" dell'export, subito dopo LIBERO OPERATIVO, una sezione **VOLO** con 8 colonne:
TIPO MISSIONE, TEMPO VOLO (min), HD, VD, HS, VS, VSP, VSB. Le manovre fatte hanno una X, come nell'Excel HEMS.
Le colonne calcolate e CONTROLLI si spostano a destra. Per i mezzi che non sono elicotteri le colonne VOLO sono vuote.

## 8. Test e verifiche

- **Unitari** (`node --test`, dati inventati):
  - normalizzazione dei campi di volo (vuoti, testo, virgola, manovre sconosciute o ripetute, ordine);
  - svuotamento dei campi di volo cambiando mezzo; nessuno svuotamento passando da V-ECHO a T-ECHO;
  - i tre nuovi avvisi, compresi i limiti 0 e 600;
  - V-ECHO e T-ECHO bloccati anche in una lista salvata senza il flag di sistema;
  - `calcolaStatisticheVolo`: basi, KPI, le 5 tabelle, periodo senza voli, mesi su più anni;
  - merge: record versione 1 contro lo stesso record versione 2 con campi vuoti = invariato; lettura dei backup 1 e 2;
    rifiuto della versione 3;
  - export: posizione e contenuto delle colonne VOLO;
  - file della PWA: eventuali file nuovi presenti in `sw.js`.
- **Confronto con l'Excel HEMS** (dati reali, solo in locale): `tools/attese_volo.py` legge le righe del foglio "Voli"
  e i valori del foglio "Statistiche" e scrive `data/volo_attese.json`. Il test calcola `calcolaStatisticheVolo` su
  quelle righe e confronta ogni valore delle tabelle di volo. Senza il file, il test viene saltato con il motivo, come il
  confronto con l'Excel 118.
- **Confronto con l'Excel 118**: invariato, sui soli tipi di avviso del 118.
- **End-to-end** (WebKit e Chromium, 390 e 1440 px, dati inventati): inserimento di una missione V-ECHO con tipo,
  tempo e manovre; la sezione Volo sparisce passando a un'ambulanza; vista Volo delle statistiche; export e reimport
  conservano i dati di volo. Screenshot nuovi in `docs/screenshots/`.

## 9. Chiusura

- README: sezione Volo (uso, statistiche, script di import), struttura del progetto, limiti noti aggiornati.
- DESIGN.md: sezione Volo del form, pulsanti delle manovre, interruttore Interventi | Volo.
- Versione dell'app 1.1.0; `VERSIONE` nuova in `sw.js`.
- Prima di qualunque push: ricerca dei codici missione reali nei file tracciati e conferma esplicita dell'utente.

## Fuori dallo scopo

- Tabelle cliniche separate per l'elisoccorso; filtri dell'elenco per tipo di missione o manovra.
- Import diretto dell'Excel HEMS dentro l'app.
- Unione campo per campo nel merge.
