# Foto del tablet – design

Data: 2026-10-30. Stato: approvata per iscritto dall'utente il 2026-10-30, dopo la revisione (vedi il documento delle decisioni). Piano: `docs/superpowers/plans/2026-10-30-foto-tablet.md`.

## Obiettivo

Un pulsante **"Foto tablet"** nel modulo di un nuovo intervento: si fotografa la schermata "Missione" del tablet
SaveOnBoard e l'app riempie da sola la parte della scheda che si legge sullo schermo. L'utente controlla i campi,
corregge quello che serve e salva come sempre.

Criteri di riuscita:

- dalla foto il modulo si riempie in pochi secondi, sul telefono, anche senza rete;
- la foto e il testo letto non escono mai dal dispositivo e l'app non salva la foto; una foto scelta dalla "Libreria
  foto" resta però nel Rullino, dove l'app non può toccarla, e un avviso ricorda di cancellarla;
- un valore che il lettore non riesce a leggere, o che non rispetta il formato atteso, resta vuoto ed è elencato tra i
  "non letti": mai un valore inventato al posto di uno illeggibile;
- sulla foto di esempio dell'utente (tenuta solo sul Mac, mai nel repository) tutti i campi della tabella del punto 1
  escono giusti; **gli orari che contano sono Allarme e Operativo** (diventano ora allert. e libero operativo e danno la
  durata), quindi la lettura va messa a punto prima di tutto su questi due;
- record, backup, export Excel e statistiche non cambiano formato: nessun campo nuovo.

## Scelte confermate (2026-10-30)

1. **Lettura sul dispositivo** con Tesseract (nessun servizio esterno), scaricato con l'app e disponibile offline.
2. **Solo nel modulo "Nuovo intervento"**, in cima. I valori letti prendono il posto di quelli presenti.
3. **Conferma nel modulo**: i campi presi dalla foto sono evidenziati e la foto resta in alto per il confronto.
4. **Menu di iOS** "Scatta foto" / "Libreria foto" (niente apertura diretta della fotocamera), con l'**avviso** che una
   foto presa dalla libreria resta nel Rullino e va cancellata a mano (aggiunto dopo la revisione; testo al capitolo 6).
5. **L'app non salva la foto**: né nell'intervento, né nella bozza, né nei backup.
6. **Missione già in archivio**: avviso subito, con "Apri".
7. **Regole del tablet** (indicate dall'utente): missione = parte prima della barra; mezzo = cifre dopo "N0"; l'età sul
   tablet è un anno indietro, quindi +1; il codice in alto va sia nell'invio sia nel rientro.
8. **Data**: oggi, oppure ieri se l'ora di allarme è più avanti dell'ora attuale. *Cambiata il 2026-10-31 (versione
   1.4.2)*: una foto presa dalla libreria giorni dopo riceveva la data del telefono. Ora la data è quella della barra di
   stato del tablet; la regola di prima resta solo se la barra non si legge, con la data tra i "non letti".
9. **Esito**: "Trasportato" se c'è un orario in "Arrivo H"; ospedale solo se corrisponde a una voce della lista.
10. **India/Mike per mezzo e orario**, anche nell'inserimento a mano, **senza avvisi nuovi** (punto 2).

## 1. Cosa si legge dalla schermata "Missione"

Esempi con dati inventati.

| Campo dell'app | Dove sul tablet | Regola | Esempio |
|---|---|---|---|
| Missione | testata, "Missione in corso: …" | la parte prima della `/`; valida solo se di 8 caratteri: 2 cifre, 2 lettere, 4 cifre (come `04AA0000`) | `04ZZ1234/2` → `04ZZ1234` |
| Mezzo | riquadro in alto a destra, "N0…" | le cifre dopo `N0`; valido solo se è una voce della lista `mezzo`, attiva o disattivata | `N03030` → `3030` |
| Data | barra di stato in alto (dal 2026-10-31) | data e ora della barra, anno che porta la data a oggi o prima, valida solo se il giorno della settimana torna; il giorno prima se l'ora di allarme è più avanti dell'ora della barra. Barra illeggibile: data del telefono come prima (ieri se l'allarme è più avanti dell'ora attuale) e "Data" tra i non letti | `06:15 Sab 31 Ott`, allarme 22:50 → 30/10 |
| Ora allert. | riquadro "Allarme" | ora `hh:mm` valida | `21:05` |
| Libero operativo | riquadro "Operativo" | ora `hh:mm` valida | `22:10` |
| Comune | riga dell'indirizzo sotto "TARGET" | il testo dopo il numero civico, solo se fatto di lettere (anche accentate, con apostrofo o trattino) o se è un comune già in archivio; senza numero civico, il comune già usato nell'archivio con cui finisce l'indirizzo | `VIA DELLE PROVE, 12 NOVARA` → `NOVARA` |
| Codice invio e codice rientro | riquadro "VALUTAZIONE" | prima lettera: V → VERDE, G → GIALLO, R → ROSSO, N → NERO (dal 2026-10-31, solo nel rientro: l'invio non ce l'ha); altre lettere: vuoto. Dal 2026-10-31: il codice è quello di rientro e il riquadro ha il suo colore (verde, giallo, rosso, nero), che controlla la lettera (in disaccordo: vuoto) e basta da solo senza lettera, tranne il nero; il riquadro si rilegge dalla foto a colori (canale più alto, e solo la scritta chiusa nel riquadro); due codici diversi tra le letture: vuoto | `V 09 L` → VERDE |
| Patologia invio e rientro | stesso riquadro | il numero → la voce della lista che inizia con quel numero | `09` → `09 - Gastro` |
| Luogo invio e rientro | stesso riquadro | l'ultima lettera → la voce della lista che inizia con quella lettera | `L` → `L - Lavoro` |
| Età | riga "Data di nascita" | "N anni" → N + 1, tra 0 e 120; altre scritte (date, mesi): non letta | `40 anni` → `41` |
| Sesso | riga "Sesso" | M → Maschio, F → Femmina | `M` → Maschio |
| Esito | riquadro "Arrivo H" | un orario sotto l'etichetta, anche letto in modo impreciso (bastano 4 cifre: serve solo sapere che c'è) → Trasportato; altrimenti non si tocca | `21:52` → Trasportato |
| Ospedale | riquadro "OSPEDALE" | la voce della lista contenuta nel testo (maiuscole e accenti ignorati; se più voci, la più lunga); solo con esito Trasportato | `OSP. MAGGIORE NOVARA` → Novara |
| Tipologia | non dal tablet | regola India/Mike del punto 2, dopo mezzo e ora allert. | 3030 → Mike |

- Gli orari si trovano per posizione: ogni orario è quello scritto sotto la sua etichetta. Se le etichette non si
  trovano, si usano i sei orari della fila in basso, nell'ordine Allarme, Partenza, Arrivo, Partenza H, Arrivo H,
  Operativo, solo se sono esattamente sei e tutti validi.
- Ogni valore passa dagli stessi controlli dell'app (ora valida, missione di 8 caratteri, voce di lista, età numerica).
  Se non li passa, il campo resta com'era e finisce tra i "non letti".
- Gli unici orari letti con il loro valore sono Allarme e Operativo; di Arrivo H conta solo la presenza.
- Partenza, Arrivo e Partenza H non servono: l'app non ha quei campi. Tipo missione, tempo di volo e manovre degli
  elicotteri non sono sullo schermo e restano da compilare a mano.

## 2. Regola India/Mike

| Mezzo | Tipologia |
|---|---|
| 3040, 5022, 5024 | India sempre |
| 3050 | Mike con ora allert. dalle 08:00 alle 19:59, India dalle 20:00 alle 07:59 |
| 6021 | Mike con ora allert. dalle 20:00 alle 07:59, India dalle 08:00 alle 19:59 |
| tutti gli altri, elicotteri compresi, e i mezzi aggiunti in futuro | Mike sempre |

- Funzione pura nuova `tipologiaDelMezzo(mezzo, oraAllert)`, con i mezzi a orario in una costante accanto a
  `MEZZI_SOLO_INDIA` in `controlli.js`. Restituisce `''` per un mezzo vuoto e per 3050/6021 senza ora allert. valida.
- In `impostaCampo`, al posto della regola di oggi (solo India per 3040/5022/5024):
  - **cambiando mezzo** la tipologia diventa quella della regola; con il mezzo svuotato resta com'era;
  - **cambiando ora allert.** la tipologia si ricalcola solo per 3050 e 6021, così una scelta fatta a mano su un altro
    mezzo non viene toccata.
- La tipologia si può sempre cambiare a mano. L'avviso "Mezzo solo India" resta com'è; nessun avviso nuovo per 3050 e
  6021 fuori orario.
- Gli interventi già salvati non cambiano: la regola agisce solo quando si cambia mezzo o ora nel modulo.
- **3050 e 6021 diventano voci di sistema** della lista `mezzo`, come 3040, 5022 e 5024: la regola si basa sul nome,
  quindi non si devono poter rinominare. Le liste già salvate si allineano al caricamento (`allineaVociSistema`).

## 3. Lettura della foto sul dispositivo

- **Libreria**: Tesseract.js 7.0.0 con tesseract.js-core 7.0.0, solo il motore LSTM, lingua italiana. File in
  `vendor/tesseract-7.0.0/`: `tesseract.min.js`, `worker.min.js`, le tre varianti LSTM del core
  (`tesseract-core-relaxedsimd-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js`:
  Tesseract sceglie quella adatta al dispositivo), `ita.traineddata.gz`, licenza Apache 2.0. Ogni dispositivo ne
  scarica circa 6 MB.
- Provata sulla foto di esempio con Node (senza ritocco): letti giusti missione, mezzo, codice, indirizzo, sesso, età e
  allarme; sbagliati gli orari sui riquadri blu e l'operativo. Il ritocco serve soprattutto a recuperare l'operativo.
- **Caricamento**: con `caricaScript` come Chart.js e SheetJS, solo al primo tocco di "Foto tablet". Il worker di
  Tesseract si crea a quel tocco e si chiude uscendo dal modulo. Opzioni: percorsi locali per worker, core e lingua;
  `cacheMethod: 'none'` (la copia sta già nella cache del service worker, non serve un doppione in IndexedDB).
- **Ritocco prima della lettura**, su un canvas: orientamento della foto corretto, lato lungo ridotto a circa 2000 px,
  scala di grigi e contrasto aumentato. Se Operativo resta illeggibile, una seconda lettura solo sulla fila degli orari
  (ritagliata dalla posizione dell'etichetta "Allarme", ingrandita, con i riquadri scuri invertiti). Il dettaglio del
  ritocco si decide nel piano, provandolo sulla foto di esempio.
- **Tempi**: sulla foto di esempio la lettura richiede circa 3 secondi sul Mac; sul telefono si mostra l'avanzamento.

## 4. Offline e aggiornamenti

- I file di Tesseract stanno in una **cache separata**, `lettore-testo-7.0.0`, che non dipende da `VERSIONE`:
  - all'installazione del service worker si scaricano solo i file che mancano in quella cache;
  - all'attivazione si cancellano le cache vecchie dell'app, ma non quella del lettore;
  - le risposte si cercano in entrambe le cache.
- Così i 6 MB si scaricano una volta sola e non a ogni aggiornamento dell'app. Cambiando versione di Tesseract cambia il
  nome della cache e la vecchia si cancella.
- In cache all'installazione vanno `tesseract.min.js`, `worker.min.js`, `ita.traineddata.gz` e **una sola** variante
  del core: il service worker la sceglie con la stessa verifica delle funzioni WebAssembly che usa Tesseract (relaxed
  SIMD, poi SIMD, poi nessuna delle due). Le altre varianti sono pubblicate ma non si scaricano. Il piano verifica in
  Chromium e WebKit che la variante in cache sia quella che Tesseract chiede.
- `VERSIONE` passa a `interventi118-v1.3.0`. `tools/pubblica.sh` pubblica già tutta la cartella `vendor`.

## 5. Interpretazione del testo

Modulo puro nuovo `js/core/tablet.js`, senza DOM, come gli altri moduli di `core/`:

`leggiSchermata(lettura, { liste, adesso, comuniNoti })` → `{ valori, nonLetti }`

- `lettura`: il testo e le parole con la loro posizione, come le restituisce Tesseract (testo, riquadro).
- `valori`: i campi letti, già nel formato dell'app (es. `{ missione: '04ZZ1234', mezzo: '3030', eta: 41, … }`).
- `nonLetti`: i campi della tabella del punto 1 che non è riuscito a leggere, con il nome da mostrare.
- Correzioni tipiche del lettore solo dove il formato è certo: negli orari `O` → `0`, `I`/`l` → `1`, `.` o spazio al
  posto di `:`; nella missione e nel mezzo `O` → `0` dove è atteso un numero.

## 6. Interfaccia

- In cima al modulo "Nuovo intervento", sopra "Identificazione", il pulsante **"Foto tablet"** (icona fotocamera)
  collegato a un `input type="file" accept="image/*"` senza `capture`. Sull'iPhone apre il menu "Scatta foto" /
  "Libreria foto"; sul Mac la scelta del file.
- **Durante la lettura**: pulsante disattivato con "Leggo la foto… n%"; il modulo resta usabile.
- **Dopo la lettura** compare un riquadro in cima al modulo con:
  - la miniatura della foto (un tocco la apre a tutto schermo per il confronto);
  - "Letti n campi" e, se ci sono, "Non letti: …";
  - se la missione è già in archivio, il messaggio di errore già usato per i duplicati ("La missione … è già
    registrata") con "Apri";
  - sempre, sotto la miniatura: "Se l'hai presa dalla Libreria foto, resta nel Rullino: cancellala da Foto quando hai
    finito." Si mostra a ogni foto perché l'app non può sapere con certezza se arriva dalla fotocamera o dalla
    libreria;
  - "Togli foto", che chiude il riquadro e lascia i valori nel modulo.
- I valori letti entrano nel modulo passando da `impostaCampo`, quindi valgono le regole del form (tipologia, ospedale
  svuotato se l'esito non è Trasportato). L'ordine conta: data, ora allert., libero operativo, missione, comune, mezzo
  (la tipologia usa l'ora già inserita), codici, patologie, luoghi, età, sesso, esito, ospedale.
- Senza ora di allarme letta, la data è quella di oggi.
- **Evidenziazione**: i campi riempiti dalla foto hanno un bordo nel colore d'accento e la scritta "dalla foto", finché
  non si tocca quel campo o non si salva. L'elenco dei campi evidenziati vive solo in memoria.
- Una seconda foto rifà tutto da capo con la nuova lettura.
- **La foto** si tiene solo in memoria (URL temporaneo per la miniatura, rilasciato chiudendo il riquadro, salvando o
  lasciando il modulo). La bozza salvata in automatico contiene i valori, non la foto. Scattata con "Scatta foto" dal
  menu, la foto non finisce nel Rullino; scelta con "Libreria foto" c'era già e ci resta (vedi l'avviso sopra).
- **Errori**:
  - lettore non disponibile (es. prima apertura senza rete): "Il lettore non è ancora disponibile: apri l'app una volta
    con la rete e riprova.";
  - nessun campo letto: "Non trovo i dati della schermata Missione: riprova con la foto dritta, intera e senza
    riflessi.".

## 7. Test

- **`tests/tablet.test.js`** (`node --test`), con letture inventate che imitano gli errori visti sulla foto di esempio
  (`V 09L`, orari spezzati): ogni riga della tabella del punto 1, missione con `/1` e `/4`, età +1, data oggi/ieri a
  cavallo della mezzanotte, codice in invio e rientro, ospedale trovato e non trovato, valori non validi tra i non letti.
- **`tests/modulo.test.js`**: regola India/Mike con i limiti 07:59, 08:00, 19:59, 20:00 per 3050 e 6021; 3050/6021
  senza ora; cambio di ora su 3030 che non tocca la tipologia; mezzo svuotato.
- **`tests/campi.test.js`**: 3050 e 6021 voci di sistema, anche nelle liste salvate prima.
- **`tests/pwa.test.js`**: i file del lettore esistono, sono nella loro cache, la cache del lettore sopravvive
  all'attivazione.
- **e2e (Chromium e WebKit)**: una pagina finta della schermata del tablet con dati inventati
  (`tests/fixtures/tablet-finto.html`), fotografata da Playwright e passata all'input del pulsante. Si controllano i
  valori nel modulo, l'evidenziazione, il riquadro con l'avviso sul Rullino, l'avviso del duplicato e la lettura
  offline dopo l'installazione del service worker.
- **Prova sulla foto vera**, solo sul Mac: una prova e2e che parte solo se la variabile `FOTO_TABLET` indica una foto
  (già convertita in JPEG), stampa i campi letti e non scrive nulla. La foto resta fuori dal repository.
- Le schermate per `docs/screenshots` usano la pagina finta, mai la foto vera.

## 8. File toccati

| File | Cosa cambia |
|---|---|
| `js/core/tablet.js` | nuovo: interpretazione della lettura |
| `js/ui/fototablet.js` | nuovo: input, ritocco, worker di Tesseract, riquadro della foto |
| `js/ui/inserimento.js` | pulsante, riquadro, evidenziazione dei campi letti |
| `js/core/modulo.js` | regola India/Mike in `impostaCampo` |
| `js/core/controlli.js` | `tipologiaDelMezzo` e i mezzi a orario |
| `js/core/campi.js` | 3050 e 6021 voci di sistema |
| `css/app.css` | riquadro della foto, evidenziazione |
| `sw.js` | cache del lettore, `VERSIONE` 1.3.0 |
| `vendor/tesseract-7.0.0/` | nuovo: file di Tesseract e licenza |
| `tests/…` | test del punto 7 |
| `README.md`, `PRODUCT.md`, `docs/screenshots/` | uso del pulsante, schermate con dati inventati |

## Fuori da questo lavoro

- Altre schermate del tablet (per esempio "Schede Paziente").
- Orari di partenza e arrivo come campi nuovi della scheda.
- Il pulsante nella modifica di un intervento già salvato.
- Conservare la foto.
- Servizi di lettura esterni.
