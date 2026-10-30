# Foto del tablet – piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un pulsante "Foto tablet" nel nuovo intervento che legge sul dispositivo la schermata "Missione" di SaveOnBoard e riempie il modulo, con i campi letti evidenziati da confermare a mano; in più la regola India/Mike per mezzo e orario, anche nell'inserimento a mano.

**Architecture:** la logica pura sta in `js/core/`: la regola India/Mike in `controlli.js` e `modulo.js`, l'interpretazione della lettura in un modulo nuovo, `tablet.js`, che riceve parole con la loro posizione e restituisce i valori nel formato dell'app. `js/ui/fototablet.js` gestisce foto, ritocco su canvas e Tesseract (in `vendor/`, caricato al primo uso); `inserimento.js` applica i valori ed evidenzia i campi. Il service worker tiene i file di Tesseract in una cache separata che sopravvive agli aggiornamenti dell'app.

**Tech Stack:** JavaScript vanilla (ES modules), Tesseract.js 7.0.0 e tesseract.js-core 7.0.0 copiati in `vendor/`, test `node --test`, prove end-to-end con Playwright 1.64 installato sul computer (WebKit e Chromium), Python 3 (stdlib).

**Spec:** `docs/superpowers/specs/2026-10-30-foto-tablet-design.md` (contesto e motivi: `docs/superpowers/specs/2026-10-30-foto-tablet-decisioni.md`)

## Global Constraints

- Nessuna dipendenza npm nel progetto, nessun build step. Tesseract si copia in `vendor/tesseract-7.0.0/` da tesseract.js 7.0.0, tesseract.js-core 7.0.0 e @tesseract.js-data/ita 1.0.0 (file `4.0.0_best_int/ita.traineddata.gz`), scaricati con `npm pack` in una cartella temporanea fuori dal progetto.
- Nessuna richiesta fuori dall'origine dell'app: `workerPath`, `corePath` e `langPath` di Tesseract sono sempre locali.
- Interfaccia, messaggi, nomi di funzioni e variabili in italiano, come il codice esistente.
- Solo dati inventati in test, fixture e screenshot (missioni `99ZZ....`). **La foto vera dell'utente non entra nel repository**, nemmeno i valori letti da essa; mai screenshot della foto vera.
- Commit solo in locale, sul branch `foto-tablet`. Nessun push né pubblicazione senza l'ok esplicito dell'utente.
- Ogni file nuovo dell'app va nell'elenco `FILE` di `sw.js` nello stesso task; i file di Tesseract vanno in `FILE_LETTORE`.
- Versione: `VERSIONE = 'interventi118-v1.3.0'` in `sw.js`, `VERSIONE_APP = '1.3.0'` in `js/app.js`.
- Messaggi di commit in italiano, chiusi da `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Testi esatti dell'interfaccia:
  - pulsante: `Foto tablet`; durante la lettura: `Leggo la foto… n%`;
  - riquadro: `Letti n campi` (`Letto 1 campo`), `Non letti: …` (nomi separati da virgola), `Togli foto`;
  - avviso fisso: `Se l'hai presa dalla Libreria foto, resta nel Rullino: cancellala da Foto quando hai finito.`;
  - evidenziazione: `dalla foto`;
  - errori: `Il lettore non è ancora disponibile: apri l'app una volta con la rete e riprova.` e `Non trovo i dati della schermata Missione: riprova con la foto dritta, intera e senza riflessi.`

## Review Focus

1. **Foto sbagliata** (un'altra schermata, un'altra cosa, una foto vuota): nessun campo del tablet letto, quindi il modulo non cambia, nemmeno la data, e compare il secondo messaggio di errore. Test nei Task 2 e 4.
2. **Ora della barra di stato del tablet** (es. `06:15` in alto): non deve diventare l'ora allert., né contare tra i sei orari della fila in basso. Test nel Task 2.
3. **File che non si apre** (HEIC in Chromium, file non immagine): messaggio `Non riesco ad aprire questa foto: riprova con un'altra.` (testo non previsto dalla specifica, aggiunto qui) invece di un errore senza spiegazione. Test nel Task 4.
4. **Uscire dal modulo durante la lettura**: il lettore si chiude, il risultato arrivato dopo si ignora, nessun errore in console. Test nel Task 4.
5. **Seconda foto dopo valori scritti a mano**: i campi letti dalla nuova foto prendono il nuovo valore e l'evidenziazione; quelli che la nuova foto non legge tengono il valore scritto e non sono evidenziati. Test nel Task 4.

---

### Task 1: Regola India/Mike e voci di sistema 3050 e 6021

**Files:**
- Modify: `js/core/controlli.js`, `js/core/modulo.js:25`, `js/core/campi.js` (`SISTEMA.mezzo`), `tools/xlsx_to_json.py` (`VOCI_SISTEMA`)
- Test: `tests/modulo.test.js`, `tests/campi.test.js`

**Interfaces:**
- Produces (in `js/core/controlli.js`):
  - `MEZZI_A_ORARIO = { '3050': { mikeDalle: '08:00', mikeAlle: '20:00' }, '6021': { mikeDalle: '20:00', mikeAlle: '08:00' } }`: Mike da `mikeDalle` compreso a `mikeAlle` escluso, anche oltre la mezzanotte; India negli altri orari.
  - `tipologiaDelMezzo(mezzo: string, oraAllert: string): '' | 'India' | 'Mike'`: `''` per mezzo vuoto e per 3050/6021 senza ora valida; India per `MEZZI_SOLO_INDIA`; Mike per tutti gli altri.
- `impostaCampo` (in `modulo.js`): cambiando `mezzo` a un valore non vuoto la tipologia diventa `tipologiaDelMezzo(mezzo, r.oraAllert)`; cambiando `oraAllert` si ricalcola solo se `r.mezzo` è in `MEZZI_A_ORARIO`.

- [ ] **Step 1: Crea il branch e metti nel commit specifica e documento delle decisioni**

```bash
git switch -c foto-tablet
git add docs/superpowers/specs/2026-10-30-foto-tablet-design.md docs/superpowers/specs/2026-10-30-foto-tablet-decisioni.md docs/superpowers/plans/2026-10-30-foto-tablet.md
git commit -m "Foto del tablet: specifica, decisioni e piano"
```

- [ ] **Step 2: Write the failing tests** in `tests/modulo.test.js` (importa anche `tipologiaDelMezzo` da `../js/core/controlli.js`)

```js
test('tipologia per mezzo e orario: 3050 Mike di giorno, 6021 Mike di notte', () => {
  assert.deepEqual(['07:59', '08:00', '19:59', '20:00'].map((o) => tipologiaDelMezzo('3050', o)), ['India', 'Mike', 'Mike', 'India']);
  assert.deepEqual(['07:59', '08:00', '19:59', '20:00'].map((o) => tipologiaDelMezzo('6021', o)), ['Mike', 'India', 'India', 'Mike']);
  assert.deepEqual([tipologiaDelMezzo('3050', ''), tipologiaDelMezzo('6021', '25:00'), tipologiaDelMezzo('', '10:00')], ['', '', '']);
  assert.deepEqual(['3040', '5022', '5024'].map((m) => tipologiaDelMezzo(m, '10:00')), ['India', 'India', 'India']);
  assert.deepEqual(['3030', 'V-ECHO', '9999'].map((m) => tipologiaDelMezzo(m, '')), ['Mike', 'Mike', 'Mike']);
});

test('impostaCampo: il mezzo mette la tipologia, l\'ora la ricalcola solo per 3050 e 6021', () => {
  const r = { ...recordVuoto('x', ADESSO), oraAllert: '21:05' };
  assert.equal(impostaCampo(r, 'mezzo', '3050').tipologia, 'India');
  assert.equal(impostaCampo(r, 'mezzo', '3030').tipologia, 'Mike');
  const notte = impostaCampo(r, 'mezzo', '6021');
  assert.equal(notte.tipologia, 'Mike');
  assert.equal(impostaCampo(notte, 'oraAllert', '09:30').tipologia, 'India');
  const aMano = { ...impostaCampo(r, 'mezzo', '3030'), tipologia: 'India' };
  assert.equal(impostaCampo(aMano, 'oraAllert', '09:30').tipologia, 'India', 'scelta a mano non toccata');
  assert.equal(impostaCampo(aMano, 'mezzo', '').tipologia, 'India', 'mezzo svuotato: tipologia com\'era');
  assert.equal(impostaCampo({ ...recordVuoto('y', ADESSO), tipologia: 'Mike' }, 'mezzo', '3050').tipologia, '', '3050 senza ora');
});
```

In `tests/campi.test.js`:
- nel test "le voci di sistema includono…" l'atteso per `mezzo` diventa `['3040', '3050', '5022', '5024', '6021', 'V-ECHO', 'T-ECHO', 'C-ECHO', 'A-ECHO']`;
- nuovo test: `allineaVociSistema` su una lista salvata con `{ id: 'mezzo-3050', voce: '3050', attiva: false, sistema: false, … }` restituisce la voce con `sistema: true` e `attiva: true`;
- nel test "le liste predefinite dell'app sono quelle del foglio Liste" `semplifica` toglie il campo `sistema` alle voci `3050` e `6021`, perché sono diventate di sistema dopo la creazione di `data/interventi_import.json` (come già fa `dopo` per C-ECHO e A-ECHO).

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/modulo.test.js tests/campi.test.js`
Expected: FAIL (`tipologiaDelMezzo` non esportata; voci di sistema diverse)

- [ ] **Step 4: Implementa** `MEZZI_A_ORARIO` e `tipologiaDelMezzo` in `controlli.js` (con `isOraValida` e `minutiDaOra` di `campi.js`), sostituisci la regola di `modulo.js:25`, aggiungi `'3050'` e `'6021'` a `SISTEMA.mezzo` in `campi.js` e a `VOCI_SISTEMA["mezzo"]` in `tools/xlsx_to_json.py`.

- [ ] **Step 5: Run all unit tests**

Run: `npm test`
Expected: PASS, nessun test esistente rotto (l'avviso "Mezzo solo India" non cambia)

- [ ] **Step 6: Commit**

```bash
git add js/core/controlli.js js/core/modulo.js js/core/campi.js tools/xlsx_to_json.py tests/modulo.test.js tests/campi.test.js
git commit -m "Tipologia India/Mike per mezzo e orario; 3050 e 6021 voci di sistema"
```

---

### Task 2: Interpretazione della schermata (`js/core/tablet.js`)

**Files:**
- Create: `js/core/tablet.js`
- Modify: `sw.js` (aggiungi `js/core/tablet.js` a `FILE`)
- Test: `tests/tablet.test.js`

**Interfaces:**
- Consumes: `impostaCampo`, `dataLocale` (`modulo.js`); `isOraValida`, `minutiDaOra` (`campi.js`).
- Produces (in `js/core/tablet.js`):
  - tipi: `Parola = { testo: string, x0: number, y0: number, x1: number, y1: number }`, `Riga = { testo: string, parole: Parola[] }`, `Lettura = { righe: Riga[] }`.
  - `daTesseract(data): Lettura`: da `data.blocks[].paragraphs[].lines[]` (risultato di `recognize(…, {}, { blocks: true })`), una riga per `line` con `line.text` ripulito e le parole da `line.words[]` (`text`, `bbox.x0…y1`).
  - `spostaLettura(lettura: Lettura, { scala: number, dx: number, dy: number }): Lettura`: coordinate `x / scala + dx`, `y / scala + dy`, per riportare una lettura di un ritaglio ingrandito sulla foto intera.
  - `unisciLetture(...letture: Lettura[]): Lettura`: le righe di tutte, in ordine.
  - `etichetta(lettura: Lettura, nome: 'ALLARME' | 'OPERATIVO' | 'ARRIVO H'): Parola | null`: la prima etichetta con quel nome che ha un orario sotto (vedi regole), altrimenti la prima trovata.
  - `orarioDa(testo: string): string | null`: correzioni `O`→`0`, `I`/`l`/`L`→`1`, `.` `-` `;` o spazio al posto di `:`, 4 cifre senza separatore; restituisce `hh:mm` solo se valida per `isOraValida`.
  - `CAMPI_TABLET: [chiave: string, nome: string][]` = missione `Missione`, mezzo `Mezzo`, oraAllert `Ora allert.`, liberoOperativo `Libero operativo`, comune `Comune`, codiceInvio `Codice`, patologiaInvio `Patologia`, luogoInvio `Luogo`, eta `Età`, sesso `Sesso`.
  - `leggiSchermata(lettura: Lettura, { liste, adesso: Date, comuniNoti: string[] }): { valori: object, nonLetti: string[] }`. `nonLetti` sono i nomi di `CAMPI_TABLET` non letti, nell'ordine della costante. Se nessun campo di `CAMPI_TABLET` è letto, `valori` è `{}`.
  - `ORDINE_APPLICAZIONE = ['data', 'oraAllert', 'liberoOperativo', 'missione', 'comune', 'mezzo', 'codiceInvio', 'codiceRientro', 'patologiaInvio', 'patologiaRientro', 'luogoInvio', 'luogoRientro', 'eta', 'sesso', 'esito', 'ospedale']`.
  - `applicaLettura(r: object, valori: object): object`: `impostaCampo` per ogni chiave presente in `valori`, nell'ordine di `ORDINE_APPLICAZIONE`.

Regole (testo confrontato in maiuscolo e senza accenti; i valori finali nel formato delle liste):

- **Missione**: dopo `MISSIONE IN CORSO`, il codice prima di `/` + cifra, spazi tolti; nei primi 2 e negli ultimi 4 caratteri `O`→`0`, `I`/`L`→`1`; valida solo se di 8 caratteri `[A-Z0-9]`.
- **Mezzo**: `N` + `0` (o `O`) + 4 cifre (`O`→`0`); valido solo se è una voce della lista `mezzo`, attiva o no.
- **Orari**: per ogni etichetta (`ALLARME`, `OPERATIVO`, `ARRIVO` seguita da una parola `H` nella stessa riga, oppure `ARRIVOH`), l'orario è il primo gettone sotto di essa: centro orizzontale tra `x0 − larghezza` e `x1 + larghezza` dell'etichetta, `y0` tra metà altezza e 4 altezze sotto l'etichetta. Se sotto la stessa etichetta ci sono due orari validi **diversi** (letture unite), il campo non si legge. Senza etichetta Allarme né Operativo: i gettoni orari validi della fascia più bassa (entro 2 altezze dal gettone più in basso), ordinati per x, valgono come Allarme…Operativo solo se sono esattamente sei.
- **Arrivo H**: basta un gettone con almeno 4 cifre dopo le correzioni → `esito: 'Trasportato'`.
- **Data**: `dataLocale(adesso)`; il giorno prima se l'ora allert. letta è più avanti di `adesso`. Messa in `valori` solo se almeno un campo di `CAMPI_TABLET` è letto.
- **Comune**: la riga dell'indirizzo è quella subito prima della riga con `SCALA` o `PIANO`, tagliata al primo `|` o a `COSCIENZA`; comune = il testo dopo `, numero` (con lettera o `/x` facoltativi). Senza civico: il più lungo tra `comuniNoti` con cui finisce la riga.
- **Codice**: prima occorrenza di lettera in `V G R B` + 2 cifre + lettera in `K S L P Q Y Z`, spazi facoltativi. V/G/R → VERDE/GIALLO/ROSSO in invio e rientro; B → codice non letto. Patologia: la voce che inizia con `NN -`; luogo: la voce che inizia con `L -`; entrambi in invio e rientro.
- **Età**: `N ANNI` → N + 1, tra 0 e 120. **Sesso**: `SESSO` seguito da `M` o `F`.
- **Ospedale**: solo con esito Trasportato; la voce della lista `ospedale` più lunga contenuta nella riga dopo `OSPEDALE` (senza accenti, maiuscole ignorate).

- [ ] **Step 1: Write the failing tests** in `tests/tablet.test.js`

Lettura inventata costruita nel test, con le posizioni della schermata:

```js
const p = (testo, x, y, w = 90, h = 24) => ({ testo, x0: x, y0: y, x1: x + w, y1: y + h });
const riga = (...parole) => ({ testo: parole.map((q) => q.testo).join(' '), parole });
const frase = (testo, y) => riga(p(testo, 40, y, 700));
const ETICHETTE = riga(p('Allarme', 100, 600), p('Partenza', 250, 600), p('Arrivo', 400, 600), p('Partenza', 550, 600),
  p('H', 645, 600, 20), p('Arrivo', 700, 600), p('H', 795, 600, 20), p('Operativo', 850, 600));
const orari = (valori) => riga(...valori.map((o, i) => o && p(o, 100 + 150 * i, 640)).filter(Boolean));

function schermata({ missione = '99ZZ0042/3', mezzo = 'N03050', indirizzo = 'VIA DELLE PROVE, 12 NOVARA | Coscienza SI',
  codice = 'R 04 S', eta = '40 anni', sesso = 'F', ospedale = 'OSPEDALE MAGGIORE NOVARA',
  tempi = ['21:05', '21:07', '21:20', '21:40', '21:52', '22:10'], conEtichette = true } = {}) {
  return { righe: [
    riga(p('06:15', 40, 10, 60), p('Sab 31 Ott', 110, 10, 120)),
    frase(`SaveOnBoard | Missione in corso: ${missione}`, 40), riga(p(mezzo, 900, 40), p('Operativo', 1000, 40)),
    frase(`TARGET VALUTAZIONE ${codice}`, 100), frase(indirizzo, 160), frase('SCALA --, PIANO 2 Respiro SI', 190),
    frase(`Sesso ${sesso}`, 400), frase(`Data di nascita ${eta}`, 430), frase('OSPEDALE', 460), frase(ospedale, 490),
    ...(conEtichette ? [ETICHETTE] : []), orari(tempi),
  ] };
}
const ADESSO = new Date(2026, 9, 31, 6, 15);
const OPZ = { liste: LISTE_PREDEFINITE, adesso: ADESSO, comuniNoti: ['NOVARA', 'TRECATE'] };
```

Test (nomi e asserzioni):

- `legge tutti i campi della schermata Missione`: `leggiSchermata(schermata(), OPZ)` dà esattamente
  `{ data: '2026-10-30', oraAllert: '21:05', liberoOperativo: '22:10', missione: '99ZZ0042', comune: 'NOVARA', mezzo: '3050', codiceInvio: 'ROSSO', codiceRientro: 'ROSSO', patologiaInvio: '04 - Neuro', patologiaRientro: '04 - Neuro', luogoInvio: 'S - Sierra', luogoRientro: 'S - Sierra', eta: 41, sesso: 'Femmina', esito: 'Trasportato', ospedale: 'Novara' }` e `nonLetti` `[]`.
- `missione: parte prima della barra, O e I corrette solo dove vanno cifre`: `'99ZZ0042/1'`, `'99ZZ0042/4'` e `'99ZZ 0042/2'` → `'99ZZ0042'`; `'O9ZZOO42/2'` → `'09ZZ0042'`; `'99ZZ042/1'` → nessuna missione e `nonLetti` contiene `'Missione'`.
- `mezzo: le 4 cifre dopo N0, solo se in lista`: `'N03030'` e `'NO3O30'` → `'3030'`; `'N09999'` → `nonLetti` contiene `'Mezzo'`.
- `data: oggi, o ieri se l'allarme è più avanti dell'ora attuale`: con `adesso` 2026-10-31 06:15 → `'2026-10-30'`; 2026-10-31 23:30 → `'2026-10-31'`; 2026-11-01 00:20 con allarme `23:55` → `'2026-10-31'`; senza orari → `'2026-10-31'` e `nonLetti` contiene `'Ora allert.'` e `'Libero operativo'`.
- `orarioDa corregge solo dove il formato è certo`: `'22-47'`→`'22:47'`, `'2l.O5'`→`'21:05'`, `'2105'`→`'21:05'`, `'21 05'`→`'21:05'`, `'25:10'`→`null`, `'a 031'`→`null`, `'00:'`→`null`.
- `l'ora della barra di stato non è l'ora allert.`: `schermata({ tempi: [null, null, null, null, null, null] })` → nessun `oraAllert`; `schermata({ conEtichette: false, tempi: ['21:05', '21:07', '21:20', '21:40', '21:52', '22:10'] })` → `oraAllert` `'21:05'` e `liberoOperativo` `'22:10'` (la barra di stato non conta); con cinque orari e senza etichette → nessuno dei due.
- `Arrivo H: basta un orario impreciso per Trasportato`: Arrivo H `'2l5Z2'` → `esito` `'Trasportato'`; Arrivo H vuoto → né `esito` né `ospedale`, e `nonLetti` non li cita.
- `letture unite: due orari diversi sotto la stessa etichetta non si leggono`: `unisciLetture(schermata(), { righe: [riga(p('23:10', 850, 641))] })` → nessun `liberoOperativo`, `nonLetti` contiene `'Libero operativo'`; con `'22:10'` al posto di `'23:10'` → `'22:10'`.
- `spostaLettura riporta un ritaglio ingrandito sulla foto intera`: `p('22:10', 1700, 80)` con `{ scala: 2, dx: 0, dy: 600 }` → `x0: 850, y0: 640`.
- `codice in invio e rientro; B lascia vuoto il codice`: `'V 09L'` → VERDE, `'09 - Gastro'`, `'L - Lavoro'` in invio e rientro; `'B 19 Z'` → nessun codice (`nonLetti` contiene `'Codice'`), patologia `'19 - Altro'`, luogo `'Z - Altro'`.
- `età +1 tra 0 e 120, mesi non letti`: `'40 anni'`→41, `'0 anni'`→1, `'119 anni'`→120, `'120 anni'` e `'8 mesi'` → `nonLetti` contiene `'Età'`. Sesso `'M'`→`'Maschio'`.
- `comune: dopo il civico, colonna di destra tagliata, senza civico un comune noto`: `'VIA DELLE PROVE, 12 NOVARA | Coscienza SI'`→`'NOVARA'`; `'VIA ROMA, 3/B SAN PIETRO MOSEZZO'`→`'SAN PIETRO MOSEZZO'`; `'STRADA PROVINCIALE TRECATE'`→`'TRECATE'`; `'STRADA DEL BOSCO'` → `nonLetti` contiene `'Comune'`.
- `ospedale: voce più lunga contenuta nel testo, accenti ignorati`: `'OSPEDALE DI CIRIE'`→`'Ciriè'`; con una lista `ospedale` di prova `['Torino', 'Torino CTO']` e testo `'PRESIDIO TORINO CTO'` → `'Torino CTO'`; `'--'` → nessun ospedale ma esito Trasportato.
- `foto sbagliata: nessun campo, nemmeno la data`: `leggiSchermata({ righe: [frase('LISTA DELLA SPESA 12 UOVA', 100)] }, OPZ)` → `valori` `{}` e `nonLetti` lungo 10.
- `applicaLettura: ordine del form e regole`: `applicaLettura(recordVuoto('x', ADESSO), valori)` con i valori del primo test → `tipologia` `'India'` (3050 alle 21:05), `ospedale` `'Novara'`, `data` `'2026-10-30'`; con `oraAllert` `'10:00'` → `'Mike'`.
- `daTesseract`: da `{ blocks: [{ paragraphs: [{ lines: [{ text: ' Allarme \n', words: [{ text: 'Allarme', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }] }] }` → `{ righe: [{ testo: 'Allarme', parole: [{ testo: 'Allarme', x0: 1, y0: 2, x1: 3, y1: 4 }] }] }`; `{ blocks: null }` → `{ righe: [] }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/tablet.test.js`
Expected: FAIL (modulo `js/core/tablet.js` mancante)

- [ ] **Step 3: Implementa** `js/core/tablet.js` con le interfacce e le regole qui sopra; aggiungi `'js/core/tablet.js'` a `FILE` in `sw.js`.

- [ ] **Step 4: Run all unit tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/core/tablet.js tests/tablet.test.js sw.js
git commit -m "Lettura della schermata Missione del tablet: regole e test con dati inventati"
```

---

### Task 3: Tesseract in `vendor/` e cache del lettore

**Files:**
- Create: `vendor/tesseract-7.0.0/` con `tesseract.min.js`, `worker.min.js`, `tesseract-core-relaxedsimd-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js`, `ita.traineddata.gz`, `LICENSE-tesseract.txt` (Apache 2.0, da `tesseract.js/LICENSE.md`)
- Modify: `sw.js`, `js/app.js` (`VERSIONE_APP`), `js/ui/file.js`
- Test: `tests/pwa.test.js`

**Interfaces:**
- Produces:
  - in `js/ui/file.js`: `CARTELLA_TESSERACT = 'vendor/tesseract-7.0.0/'`, `TESSERACT = 'vendor/tesseract-7.0.0/tesseract.min.js'`;
  - in `sw.js`: `LETTORE = 'lettore-testo-7.0.0'`, `FILE_LETTORE = ['vendor/tesseract-7.0.0/tesseract.min.js', 'vendor/tesseract-7.0.0/worker.min.js', 'vendor/tesseract-7.0.0/ita.traineddata.gz']`, `varianteCore(): string` (nome del file del core da mettere in cache).

- [ ] **Step 1: Copia i file** da una cartella temporanea fuori dal progetto

```bash
T=$(mktemp -d) && cd "$T" && npm pack tesseract.js@7.0.0 tesseract.js-core@7.0.0 @tesseract.js-data/ita@1.0.0 --silent && for f in *.tgz; do mkdir "${f%.tgz}" && tar -xzf "$f" -C "${f%.tgz}"; done && ls
```

Copia in `vendor/tesseract-7.0.0/`: `dist/tesseract.min.js` e `dist/worker.min.js` (tesseract.js), le tre varianti `*-lstm.wasm.js` (tesseract.js-core), `4.0.0_best_int/ita.traineddata.gz`, la licenza. Nessun file `.map`.

- [ ] **Step 2: Write the failing tests** in `tests/pwa.test.js`

- il test "il service worker mette in cache ogni file dell'app" esclude da `necessari` i file sotto `vendor/tesseract-7.0.0/`;
- nuovo `il lettore ha la sua cache: file esistenti, fuori da FILE, varianti del core presenti`: `FILE_LETTORE` (letto da `sw.js` come `FILE`) è uguale all'elenco dell'interfaccia, ogni file esiste, nessuno è anche in `FILE`; `sw.js` cita `tesseract-core-relaxedsimd-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js` e `tesseract-core-lstm.wasm.js`, che esistono in `vendor/tesseract-7.0.0/`;
- nuovo `l'attivazione non cancella la cache del lettore`: `sw.js` contiene `const LETTORE = 'lettore-testo-7.0.0'` e il filtro di `activate` esclude sia `VERSIONE` sia `LETTORE` (controllo sul testo: `/n !== VERSIONE && n !== LETTORE/`);
- nuovo `la versione dell'app è la 1.3.0 ovunque`: `VERSIONE` è `'interventi118-v1.3.0'` e `VERSIONE_APP` in `js/app.js` è `'1.3.0'`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/pwa.test.js`
Expected: FAIL sui tre test nuovi

- [ ] **Step 4: Implementa la cache del lettore in `sw.js`**

- `varianteCore()` usa le stesse prove di wasm-feature-detect 1.9.0, la libreria con cui Tesseract sceglie il core:

```js
const RELAXED_SIMD = [0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,15,1,13,0,65,1,253,15,65,2,253,15,253,128,2,11];
const SIMD = [0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11];
// relaxed SIMD → tesseract-core-relaxedsimd-lstm.wasm.js, SIMD → tesseract-core-simd-lstm.wasm.js, altrimenti tesseract-core-lstm.wasm.js
```

- `install`: come oggi per `FILE`; in più apre `LETTORE` e aggiunge (con `cache: 'reload'`) solo i file di `FILE_LETTORE` e della variante scelta che non ci sono già. Un errore del lettore non fa fallire l'installazione (`.catch(() => {})`): i file mancanti arrivano al primo uso.
- `activate`: cancella le cache che non sono né `VERSIONE` né `LETTORE`.
- `fetch`: le richieste sotto `vendor/tesseract-` si cercano in `LETTORE` e, se mancano, si scaricano e si salvano in `LETTORE`; le altre come oggi.
- `VERSIONE` → `'interventi118-v1.3.0'`; `VERSIONE_APP` → `'1.3.0'`; `CARTELLA_TESSERACT` e `TESSERACT` in `file.js`.

- [ ] **Step 5: Run all unit tests**

Run: `npm test`
Expected: PASS (anche "nessuna risorsa esterna" e la pubblicazione: `vendor` è già in `tools/pubblica.sh`)

- [ ] **Step 6: Commit**

```bash
git add vendor/tesseract-7.0.0 sw.js js/app.js js/ui/file.js tests/pwa.test.js
git commit -m "Tesseract 7.0.0 in vendor, in una cache che resta tra gli aggiornamenti; versione 1.3.0"
```

---

### Task 4: Pulsante "Foto tablet" nel modulo

**Files:**
- Create: `js/ui/fototablet.js`, `tests/fixtures/tablet-finto.html`
- Modify: `js/ui/inserimento.js`, `js/app.js` (`naviga`), `js/ui/dom.js` (icona `fotocamera` in `TRATTI`), `css/app.css`, `sw.js` (`FILE`)
- Test: `tests/e2e/app.e2e.mjs`

**Interfaces:**
- Consumes: `leggiSchermata`, `applicaLettura`, `daTesseract`, `spostaLettura`, `unisciLetture`, `etichetta`, `CAMPI_TABLET` (Task 2); `caricaScript`, `TESSERACT`, `CARTELLA_TESSERACT` (Task 3); `stato`, `trova`; `suggerimentiComuni`.
- Produces (in `js/ui/fototablet.js`):
  - `creaFotoTablet({ dopoLettura }): { elemento: HTMLElement, chiudiPannello(): void, smonta(): void }`. `dopoLettura({ valori, nonLetti })` è chiamata solo con `valori` non vuoti; il pannello si disegna dopo.
  - `preparaFoto(file: File): Promise<HTMLCanvasElement>`: `createImageBitmap(file, { imageOrientation: 'from-image' })`, lato lungo al massimo 2000 px, scala di grigi, contrasto allungato tra il 2° e il 98° percentile.
  - worker: `Tesseract.createWorker('ita', 1, { workerPath, corePath, langPath, cacheMethod: 'none', workerBlobURL: false, logger })`, con percorsi assoluti costruiti da `new URL(CARTELLA_TESSERACT, location.href)` (dentro il worker i percorsi relativi si risolvono dalla cartella del worker). Creato al primo tocco, chiuso da `smonta()`.
  - lettura: `recognize(canvas, {}, { blocks: true })` → `daTesseract`. Se mancano `oraAllert` o `liberoOperativo` e c'è l'etichetta Allarme: seconda lettura del ritaglio da un'altezza sopra a 5 sotto l'etichetta, largo quanto la foto, ingrandito 2 volte, una volta normale e una invertita; le due letture passano da `spostaLettura` e si uniscono alla prima con `unisciLetture`.
- In `inserimento.js`: ogni contenitore di campo ha `data-campo="<chiave>"`; un `Set` `evidenziati` in memoria dà la classe `da-foto`; `cambia(campo)` toglie `campo` (con `_copia` toglie codice, patologia e luogo del rientro); salvataggio e "Svuota" svuotano il set e chiamano `chiudiPannello()`; `costruisci` restituisce anche `smonta()`, che `naviga` in `app.js` chiama prima di cambiare schermata.

- [ ] **Step 1: Scrivi la pagina finta** `tests/fixtures/tablet-finto.html`: un `<div class="tablet">` di 1280×800 px che imita la schermata Missione con i dati del Task 2 (barra di stato `06:15 Sab 31 Ott`, `Missione in corso: 99ZZ0042/3`, riquadro `N03050`, indirizzo `VIA DELLE PROVE, 12 NOVARA`, riquadro giallo `R 04 S`, `Sesso F`, `Data di nascita 40 anni`, `OSPEDALE MAGGIORE NOVARA`, fila di sei riquadri con Arrivo, Partenza H e Arrivo H bianco su blu). Una classe `storta` aggiunge `transform: rotate(-3deg)`, `filter: blur(0.6px) contrast(0.85)` e un riflesso a gradiente.

- [ ] **Step 2: Write the failing e2e tests** in `tests/e2e/app.e2e.mjs`, in un `describe('foto tablet')` per ogni browser e viewport, con un contesto suo (`serviceWorkers: 'block'`, demo importata): l'orologio fissato non deve toccare le altre prove. Una funzione `fotoFinta(ctx, { storta, indirizzo })` apre la pagina finta in una scheda nuova con `setContent`, fa lo screenshot PNG e restituisce il buffer; `daFoto(page, buffer)` la passa con il `filechooser` di `Foto tablet` e aspetta il riquadro.

- `foto tablet: modulo riempito, campi evidenziati, avviso sul Rullino`: `page.clock.setFixedTime(new Date('2026-10-31T06:15:00'))`, foto dritta. Atteso: data 30/10/2026, Ora allert. `21:05`, Libero operativo `22:10`, Missione `99ZZ0042`, Comune `NOVARA`, mezzo `3050` e tipologia `India` premuti, `ROSSO` in invio e rientro, `04 - Neuro` e `S - Sierra` scelti in invio e rientro, Età `41`, `Femmina`, `Trasportato`, `Novara`; testo `Letti 16 campi`; nessun `Non letti`; l'avviso sul Rullino visibile; `.da-foto` su 16 contenitori; `Tipologia` non evidenziata. Un tocco sulla miniatura apre il `<dialog>` con la foto intera, un altro lo chiude. Cambiando a mano l'età, quel campo perde `da-foto`. "Togli foto" chiude il riquadro e lascia valori ed evidenziazione; rileggi la foto e "Salva intervento" toglie riquadro ed evidenziazione.
- `foto tablet: la missione già salvata si segnala subito`: dopo il test precedente, la stessa foto di nuovo → messaggio `La missione 99ZZ0042 è già registrata` con il link `Apri` verso l'intervento salvato.
- `foto tablet storta: nessun valore inventato`: foto `storta`; per ogni campo dell'atteso del primo test, il valore nel modulo è quello atteso **oppure** il campo è vuoto e il suo nome compare in `Non letti`.
- `foto tablet: seconda foto dopo valori scritti a mano` (Review Focus 5): scrivi a mano Comune `TRECATE` ed Età `70`, poi una foto finta con indirizzo senza comune riconoscibile (variante della pagina con `STRADA DEL BOSCO`) → Comune resta `TRECATE` senza `da-foto`, Età diventa `41` con `da-foto`.
- `foto tablet: file che non si apre, foto sbagliata, lettore assente` (Review Focus 1 e 3): un file `nota.jpg` con testo → `Non riesco ad aprire questa foto: riprova con un'altra.`; lo screenshot di una pagina con solo `LISTA DELLA SPESA` → `Non trovo i dati della schermata Missione…` e data del modulo invariata; con `page.route('**/vendor/tesseract-7.0.0/**', (r) => r.abort())` in un contesto nuovo → `Il lettore non è ancora disponibile…`.
- `foto tablet: uscire durante la lettura` (Review Focus 4): scegli la foto e vai subito a `#/elenco`; torna a `#/nuovo` → nessun riquadro, nessun valore letto, nessun `pageerror`.
- Dopo il test offline esistente, per ogni viewport: `foto tablet offline`: service worker attivo, attesa che `caches.open('lettore-testo-7.0.0')` contenga 4 file, `ctx.setOffline(true)`, ricarica, foto dritta → Missione `99ZZ0042`. Nella corsa WebKit, screenshot `390-foto-tablet` e `1440-foto-tablet` con `scattaSchermata`.

- [ ] **Step 3: Run e2e to verify they fail**

Run: `npm run e2e`
Expected: FAIL sui test nuovi (pulsante `Foto tablet` assente), i test esistenti passano

- [ ] **Step 4: Implementa** `fototablet.js`, le modifiche a `inserimento.js`, `smonta` in `app.js`, l'icona `fotocamera`, lo stile (`.foto-tablet`, `.miniatura`, `.campo.da-foto` con bordo `var(--selezione)` e la scritta `dalla foto`, la foto intera in un `<dialog>` che si chiude con un tocco) e aggiungi `'js/ui/fototablet.js'` a `FILE`.

- Il pulsante e il riquadro stanno in cima al modulo, sopra "Identificazione", solo per il nuovo intervento.
- `input type="file" accept="image/*"` nascosto, senza `capture`.
- L'URL della miniatura (`URL.createObjectURL`) si rilascia in `chiudiPannello()` e `smonta()`; la foto non va nella bozza né altrove.
- Un risultato che arriva dopo `smonta()` o dopo una foto più recente si ignora (contatore delle letture).

- [ ] **Step 5: Run all tests**

Run: `npm test && npm run e2e`
Expected: PASS in WebKit e Chromium, 390 e 1440 px

- [ ] **Step 6: Commit**

```bash
git add js/ui/fototablet.js js/ui/inserimento.js js/app.js js/ui/dom.js css/app.css sw.js tests/fixtures/tablet-finto.html tests/e2e/app.e2e.mjs docs/screenshots/390-foto-tablet.png docs/screenshots/1440-foto-tablet.png
git commit -m "Pulsante Foto tablet: lettura sul dispositivo, campi evidenziati, avviso sul Rullino"
```

---

### Task 5: Taratura sulla foto vera (solo sul Mac)

**Files:**
- Create: `tests/e2e/foto-vera.e2e.mjs`
- Modify (se serve): `js/ui/fototablet.js` (parametri di `preparaFoto` e della seconda lettura)

**Interfaces:**
- Consumes: il pulsante e il riquadro del Task 4.

- [ ] **Step 1: Scrivi la prova** `tests/e2e/foto-vera.e2e.mjs`: parte solo se `FOTO_TABLET` indica un file esistente (altrimenti `skip` con il motivo), solo WebKit, contesto con `serviceWorkers: 'block'`; carica la foto da `#/nuovo` con il pulsante e stampa con `console.log` i valori del modulo, i "Non letti" e i secondi impiegati. Nessuno screenshot, nessun file scritto. Non è inclusa in `npm run e2e`.

- [ ] **Step 2: Prepara la foto fuori dal progetto e lancia la prova**

```bash
T=$(mktemp -d) && sips -s format jpeg ~/Downloads/IMG_0387.HEIC --out "$T/tablet.jpg" >/dev/null && FOTO_TABLET="$T/tablet.jpg" node --test tests/e2e/foto-vera.e2e.mjs
```

Expected: i valori stampati coincidono con quelli che si vedono nella foto (controllo a occhio; i valori non si scrivono in nessun file del repository). Allarme e Operativo devono essere giusti oppure tra i "Non letti", mai sbagliati.

- [ ] **Step 3: Se Allarme o Operativo sono sbagliati o mancano**, regola in `fototablet.js` soglie e misure del ritaglio (altezze sopra e sotto l'etichetta, ingrandimento, contrasto) e ripeti lo Step 2. Dopo ogni modifica: `npm run e2e` resta verde.

- [ ] **Step 4: Controlla che nessun dato vero sia entrato nei file tracciati e fai il commit**

```bash
git status --short
git grep -n -i -E "IMG_0387|tablet\.jpg" -- ':!docs/superpowers' ':!tests/e2e/foto-vera.e2e.mjs'
git add tests/e2e/foto-vera.e2e.mjs js/ui/fototablet.js
git commit -m "Prova della lettura su una foto vera, fuori dal repository; taratura del ritocco"
```

Expected: `git status` non mostra immagini nuove; `git grep` non trova nulla.

---

### Task 6: Documenti e controllo finale

**Files:**
- Modify: `README.md`, `PRODUCT.md`

- [ ] **Step 1: Aggiorna i documenti**: in `README.md` una sezione "Foto del tablet" (come si usa, cosa legge, che la foto non esce dal telefono, l'avviso sul Rullino, i circa 6 MB scaricati una volta, la prova `FOTO_TABLET` del Task 5) e la regola India/Mike; in `PRODUCT.md` la funzione in una riga.

- [ ] **Step 2: Controllo completo**

```bash
npm test && npm run e2e
node -e "const fs=require('fs'),{execSync}=require('child_process');const reali=new Set(JSON.parse(fs.readFileSync('data/interventi_import.json','utf8')).record.map(r=>r.missione).filter(Boolean));const t=execSync('git ls-files',{encoding:'utf8'}).split('\n').filter(f=>f&&!f.startsWith('vendor/')&&!/\.(png|ico)$/.test(f));const trovati=t.filter(f=>[...reali].some(m=>fs.readFileSync(f,'utf8').includes(m)));console.log(trovati.length?'CODICI REALI IN: '+trovati.join(', '):'nessun codice reale')"
```

Expected: tutti i test passano; `nessun codice reale`.

- [ ] **Step 3: Commit**

```bash
git add README.md PRODUCT.md
git commit -m "Documenti: foto del tablet e tipologia per orario"
```

Da fare poi con l'utente, non in questo piano: unione in `main`, pubblicazione con `npm run pubblica` dopo il suo ok (mostrando l'indirizzo esatto), prova sull'iPhone vero.
