# Backup con nome fisso – specifica e piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Data: 2026-10-30. Stato: decisioni confermate a voce dall'utente il 2026-10-30, una domanda per volta. Questo documento contiene **sia la specifica sia il piano**, perché va consegnato insieme a un'altra modifica: chi lo esegue lo legge tutto prima di toccare il codice.

**Goal:** le esportazioni (backup JSON ed Excel) producono sempre lo stesso file per dispositivo, così il sistema propone "Sostituisci" e non si accumulano file; la copia con data resta disponibile come azione secondaria; su Chrome ed Edge l'app ricorda dove ha salvato e riscrive lì senza chiedere.

**Architecture:** i nomi dei file sono funzioni pure in `js/core/merge.js`. Il salvataggio sta tutto in `js/ui/file.js`: su iOS il foglio di condivisione come oggi; dove esiste `window.showSaveFilePicker` (Chrome, Edge) la finestra di salvataggio con il riferimento al file ricordato nei metadati di IndexedDB; altrove il download come oggi. `js/ui/impostazioni.js` cambia solo i nomi, i testi e aggiunge l'azione secondaria. Nessun server, nessun backup automatico: decisione presa e motivata nella memoria del progetto (l'app sarà usata da altre persone, nessuno storage comune).

**Tech Stack:** JavaScript vanilla (ES modules), File System Access API solo come miglioramento progressivo, test `node --test`, prove end-to-end con Playwright (WebKit e Chromium) già presenti in `tests/e2e/`.

**Spec:** la sezione "Specifica" qui sotto.

---

## Specifica

### Cosa cambia per chi usa l'app

1. **"Esporta backup"** crea sempre `interventi118_iPhone.json` su iPhone e `interventi118_Mac.json` sul Mac. Il nome non ha più data e ora. Salvandolo nella stessa cartella, iOS e macOS chiedono di sostituire il file: il backup resta uno solo per dispositivo.
2. **"Esporta Excel"** segue la stessa regola: `interventi118_iPhone.xlsx` / `interventi118_Mac.xlsx`.
3. **"Esporta copia con data"** è una nuova azione secondaria in Impostazioni, meno in vista dei tre pulsanti principali: crea il file con il nome di oggi, `interventi118_AAAA-MM-GG_HHMM.json`, per chi vuole conservare una copia storica. Conta come backup (azzera il promemoria) come l'altro.
4. **Scambio tra iPhone e Mac:** i due file fissi sono anche i file di scambio. Dall'iPhone si esporta `interventi118_iPhone.json` e sul Mac si importa quello; dal Mac si esporta `interventi118_Mac.json` e sull'iPhone si importa quello. Nessun file intermedio. L'import non cambia.
5. **Mac con Safari:** Safari scarica nei Download e, se il nome esiste, rinomina in `-1`, `-2`. L'app non può evitarlo; il testo di Impostazioni e il README spiegano di attivare in Safari **Impostazioni → Generali → Posizione download → "Chiedi per ogni download"**: a ogni esportazione si sceglie la cartella di iCloud Drive e il Mac propone di sostituire il file.
6. **Mac con Chrome o Edge:** la prima volta l'app apre la finestra di salvataggio con il nome già scritto; l'utente sceglie la cartella (per esempio in iCloud Drive). Le volte dopo l'app riscrive quel file **senza chiedere nulla**. Se il file ricordato non esiste più (spostato, rinominato, cartella cancellata) o il browser nega il permesso, l'app riapre la finestra di scelta **senza messaggi di errore** e ricorda la nuova posizione. Il file ricordato è separato per backup ed Excel. La copia con data non viene ricordata: finestra di scelta ogni volta.
7. **iPhone:** nessun cambiamento nel gesto: foglio di condivisione, "Salva su File", stessa cartella dell'altra volta, iOS chiede "Sostituisci".
8. Il promemoria giallo (7 giorni / 10 modifiche) non cambia.

### Testi esatti dell'interfaccia (Impostazioni → Backup e passaggio dei dati)

Paragrafo sotto il titolo, uno dei tre a seconda del dispositivo:

- iOS: `Esporta: si apre la condivisione, scegli "Salva su File" e la stessa cartella di iCloud Drive dell'altra volta: iOS chiede di sostituire interventi118_iPhone.json. Sul Mac importa quel file: i dati si uniscono, nessuno viene sovrascritto.`
- Mac con finestra di salvataggio (`'showSaveFilePicker' in window`): `Esporta: la prima volta scegli dove salvare interventi118_Mac.json, per esempio in iCloud Drive; le volte dopo l'app lo riscrive lì da sola. Sull'iPhone importa quel file: i dati si uniscono, nessuno viene sovrascritto.`
- Mac senza (Safari): `Esporta: il file si chiama interventi118_Mac.json e finisce nei Download. In Safari attiva Impostazioni → Generali → Posizione download → "Chiedi per ogni download": così scegli la cartella di iCloud Drive e il Mac chiede di sostituirlo. Sull'iPhone importa quel file: i dati si uniscono, nessuno viene sovrascritto.`

Pulsanti, nell'ordine: `Esporta backup` (primario), `Importa backup`, `Esporta Excel`. Sotto, da solo, con classe `bottone piccolo`: `Esporta copia con data`.

Toast: `Backup salvato` (Chrome, scrittura sul file ricordato o scelto), `Backup scaricato` (download), `Backup pronto: controlla di averlo salvato su File` (iOS, come oggi). Per l'Excel: `File Excel salvato` / `File Excel scaricato` / `File Excel pronto`. Per la copia con data gli stessi toast del backup.

### Nomi dei file

- `nomeFileBackup(dispositivo, estensione = 'json')` → `interventi118_${dispositivo}.${estensione}`, con `dispositivo` uguale a `'iPhone'` o `'Mac'`.
- `nomeFileDatato(d = new Date())` → `interventi118_AAAA-MM-GG_HHMM.json` (è la funzione di oggi, rinominata).

Il tipo di dispositivo è `isIOS() ? 'iPhone' : 'Mac'`: nel nome **non** va il codice di 4 caratteri di `nomeDispositivo()`, che resta per il campo `dispositivo` dentro il backup.

### Documentazione

- README, sezione "Backup e passaggio dei dati tra Mac e iPhone": riscritta sul giro con i due file fissi, il consiglio per Safari e il comportamento in Chrome/Edge; "Esporta copia con data" descritta in "Promemoria e archivio".
- `PRODUCT.md`, riga 29 ("Data moves between iPhone and Mac through JSON files on iCloud Drive"): aggiungere che i file hanno nome fisso per dispositivo e che non c'è backup automatico per scelta.
- Il testo di versione in `impostazioni.js` ("I dati restano solo su questo dispositivo…") non cambia.

### Fuori ambito

Backup automatico, storage in rete, account, cartella scelta una volta con `showDirectoryPicker`.

---

## Global Constraints

- Nessuna dipendenza npm, nessun build step, nessuna richiesta fuori dall'origine dell'app.
- Interfaccia, messaggi, nomi di funzioni e variabili in italiano, come il codice esistente. Testi dell'interfaccia esattamente come nella Specifica.
- Solo dati inventati in test e screenshot (missioni `99ZZ....`).
- Commit solo in locale. Nessun push né pubblicazione senza l'ok esplicito dell'utente (si pubblica solo con `npm run pubblica`, mai con wrangler dalla cartella del progetto).
- Nessun file nuovo dell'app è previsto; se se ne aggiunge uno va nell'elenco `FILE` di `sw.js` nello stesso task.
- **Versione:** questo lavoro si unisce a un'altra modifica. La versione la fissa chi unisce le due; se nessun'altra indicazione la fissa, usare `1.4.0` (`VERSIONE = 'interventi118-v1.4.0'` in `sw.js`, `VERSIONE_APP = '1.4.0'` in `js/app.js`, `Interventi 118, versione 1.4.0.` in `js/ui/impostazioni.js`, e le costanti in `tests/pwa.test.js` e `tests/sw.test.js`). Un solo cambio di versione per le due modifiche, nell'ultimo task.
- Messaggi di commit in italiano, chiusi da `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- La finestra di salvataggio di Chrome richiede un gesto dell'utente recente (circa 5 secondi): chiamarla **prima** di costruire il file quando la costruzione può essere lenta (Excel: prima la finestra, poi `caricaScript(SHEETJS)` e la scrittura).

## Review Focus

1. Un utente Chrome sposta il file ricordato in un'altra cartella: `createWritable()` fallisce con `NotFoundError`; deve comparire la finestra di scelta, non un toast d'errore. Test nel Task 2 (`finto handle che rifiuta`).
2. Un utente Chrome chiude la finestra di scelta senza salvare: `AbortError` → `'annullato'`, nessun toast, il promemoria non si azzera. Test nel Task 2 e nel Task 3.
3. Il permesso di scrittura sul file ricordato è `'prompt'` dopo il riavvio del browser: `requestPermission({ mode: 'readwrite' })` va chiamato dentro il gesto; se risponde `'denied'`, si ricade sulla finestra di scelta. Test nel Task 2.
4. Un backup importato porta `dispositivo: 'iPhone a1b2'`: il nome del file **non** usa quel campo, altrimenti un backup rifatto sul Mac dopo un import si chiamerebbe come quello dell'iPhone. Test nel Task 1 (`nomeFileBackup` prende solo `'iPhone'`/`'Mac'`).
5. In Safari su Mac l'ordine e i nomi dei pulsanti restano quelli di oggi: le prove end-to-end esistenti usano `getByRole('button', { name: 'Esporta backup' })` e `'Esporta Excel'` e devono passare senza modifiche ai selettori; cambia solo il nome atteso del file. Test nel Task 3.

---

### Task 1: nomi dei file in `js/core/merge.js`

**Files:**
- Modify: `js/core/merge.js:153-157`
- Modify: `js/stato.js:94-96` (aggiunta accanto a `nomeDispositivo`)
- Test: `tests/merge.test.js:163-166`

**Interfaces:**
- Produces: `nomeFileBackup(dispositivo, estensione = 'json'): string` e `nomeFileDatato(d = new Date()): string` esportate da `js/core/merge.js`; `tipoDispositivo(): 'iPhone' | 'Mac'` esportata da `js/stato.js`.

- [ ] **Step 1: Sostituire il test esistente con i due nuovi**

```js
test('nome fisso del file di backup per dispositivo', () => {
  assert.equal(nomeFileBackup('iPhone'), 'interventi118_iPhone.json');
  assert.equal(nomeFileBackup('Mac'), 'interventi118_Mac.json');
  assert.equal(nomeFileBackup('Mac', 'xlsx'), 'interventi118_Mac.xlsx');
});

test('nome della copia con data e ora locali', () => {
  assert.equal(nomeFileDatato(new Date(2026, 9, 25, 9, 5)), 'interventi118_2026-10-25_0905.json');
  assert.equal(nomeFileDatato(new Date(2026, 0, 3, 23, 59)), 'interventi118_2026-01-03_2359.json');
});
```

Aggiungere `nomeFileDatato` all'import in testa al file di test.

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `node --test tests/merge.test.js`
Expected: FAIL, `nomeFileDatato is not a function` (o `nomeFileBackup('iPhone')` che restituisce un nome con la data).

- [ ] **Step 3: Implementare**

In `merge.js`: rinominare la funzione attuale in `nomeFileDatato`, aggiungere `nomeFileBackup(dispositivo, estensione = 'json')`. In `stato.js`: `export function tipoDispositivo() { return isIOS() ? 'iPhone' : 'Mac'; }` e usarla dentro `nomeDispositivo()`.

- [ ] **Step 4: Eseguire tutti i test unitari**

Run: `node --test`
Expected: PASS tranne eventuali test che importano il vecchio nome; non ce ne sono fuori da `merge.test.js` (verificare con `grep -rn nomeFileBackup tests js`).

- [ ] **Step 5: Commit**

```bash
git add js/core/merge.js js/stato.js tests/merge.test.js
git commit -m "Backup: nome del file fisso per dispositivo, copia datata a parte"
```

---

### Task 2: salvataggio con file ricordato in `js/ui/file.js`

**Files:**
- Modify: `js/ui/file.js:1-26`
- Test: `tests/file.test.js` (nuovo; i test unitari di questo progetto girano in Node, quindi `window`, `navigator` e `document` vanno simulati come fa `tests/dom.test.js`: leggere quel file prima e seguirne lo stile)

**Interfaces:**
- Consumes: `impostaMeta(valori)` e `stato.meta` da `js/stato.js`; `isIOS()` da `js/stato.js`.
- Produces: `salvaFile(blob, nome, { ricordo } = {}): Promise<'condiviso' | 'salvato' | 'scaricato' | 'annullato'>`. `ricordo` è la chiave dei metadati in cui tenere il riferimento al file (`'fileBackup'` o `'fileExcel'`); se manca, niente ricordo. Il riferimento (`FileSystemFileHandle`) si salva con `impostaMeta({ [ricordo]: handle })` e si rilegge da `stato.meta[ricordo]`: IndexedDB lo accetta così com'è (structured clone).

Ordine delle strade dentro `salvaFile`:

1. iOS con `navigator.canShare({ files })` → condivisione, come oggi → `'condiviso'` / `'annullato'`.
2. `typeof window.showSaveFilePicker === 'function'` →
   a. se `ricordo` e `stato.meta[ricordo]` esiste: `await handle.requestPermission({ mode: 'readwrite' })`; se `'granted'`, `await (await handle.createWritable()).write(blob)` poi `close()` → `'salvato'`. Qualunque eccezione qui (NotFoundError, NotAllowedError, TypeError) porta al punto b, senza toast.
   b. `window.showSaveFilePicker({ suggestedName: nome, types: [{ accept: { [blob.type]: ['.' + estensione] } }] })`; `AbortError` → `'annullato'`; altrimenti scrivere come in a, poi, se `ricordo`, `impostaMeta({ [ricordo]: handle })` → `'salvato'`.
3. Altrimenti download come oggi → `'scaricato'`.

- [ ] **Step 1: Scrivere i test (finti `window.showSaveFilePicker` e finti handle)**

```js
test('senza finestra di salvataggio scarica come oggi', async () => { /* window.showSaveFilePicker assente → 'scaricato', un <a download> cliccato */ });
test('con file ricordato e permesso concesso riscrive senza aprire la finestra', async () => { /* stato.meta.fileBackup = handle finto granted; showSaveFilePicker non chiamato; esito 'salvato'; write ricevuto il blob */ });
test('file ricordato che non esiste più: riapre la finestra e ricorda il nuovo', async () => { /* createWritable rifiuta con DOMException NotFoundError → showSaveFilePicker chiamato con suggestedName 'interventi118_Mac.json'; impostaMeta chiamato con il nuovo handle */ });
test('permesso negato sul file ricordato: riapre la finestra', async () => { /* requestPermission → 'denied' */ });
test('finestra chiusa senza salvare: annullato e niente ricordo', async () => { /* AbortError → 'annullato'; impostaMeta non chiamato */ });
test('senza chiave di ricordo non salva il riferimento', async () => { /* ricordo assente → showSaveFilePicker chiamato, impostaMeta non chiamato */ });
```

Simulare `stato.meta` e `impostaMeta` con un modulo finto o passando per `js/stato.js` con IndexedDB finta, secondo quanto fa già `tests/aiuti.js`: leggerlo prima di scegliere.

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `node --test tests/file.test.js`
Expected: FAIL (esiti `'scaricato'` dove si attende `'salvato'`, `showSaveFilePicker` mai chiamato).

- [ ] **Step 3: Implementare `salvaFile` con le tre strade sopra**

- [ ] **Step 4: Eseguire i test**

Run: `node --test tests/file.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/ui/file.js tests/file.test.js
git commit -m "Salvataggio: finestra di salvataggio con file ricordato dove il browser la offre"
```

---

### Task 3: Impostazioni, testi e copia con data

**Files:**
- Modify: `js/ui/impostazioni.js:20-70` (`esportaBackup`, `esportaExcel`, paragrafo e pulsanti della sezione backup)
- Modify: `js/app.js:64` resta `impostazioni.esportaBackup()` (nessun cambio, verificare solo che funzioni)
- Test: `tests/e2e/app.e2e.mjs:47-52, 620-710` (helper `esporta` e prove di backup/Excel)

**Interfaces:**
- Consumes: `nomeFileBackup`, `nomeFileDatato`, `tipoDispositivo`, `salvaFile(blob, nome, { ricordo })` dai task 1 e 2.
- Produces: `esportaBackup()` (esportata, usata dal promemoria) → nome fisso, `ricordo: 'fileBackup'`; nuova `esportaCopiaDatata()` → `nomeFileDatato()`, senza ricordo; `esportaExcel()` → `nomeFileBackup(tipoDispositivo(), 'xlsx')`, `ricordo: 'fileExcel'`, finestra aperta prima di `caricaScript(SHEETJS)` (vedi Global Constraints: il modo più semplice è caricare SheetJS **al disegno** della sezione Impostazioni, in background e senza attendere, così al clic è già pronto; in alternativa cambiare `salvaFile` per accettare una funzione che produce il blob. Scegliere il primo).

- [ ] **Step 1: Aggiornare le prove end-to-end**

Nell'helper `esporta` niente cambia. Nelle prove: dove oggi si controlla `nomeFile` con `/^interventi118_\d{4}-\d{2}-\d{2}_\d{4}\.json$/` (o simile), attendersi `'interventi118_Mac.json'` per il backup e `'interventi118_Mac.xlsx'` per l'Excel (le prove girano su desktop, `isIOS()` falso). Aggiungere una prova: `Esporta copia con data` produce un nome che rispetta `/^interventi118_\d{4}-\d{2}-\d{2}_\d{4}\.json$/`. Aggiungere una prova **solo Chromium**: con `page.addInitScript` definire `window.showSaveFilePicker` finto che restituisce un handle finto con `createWritable()` che raccoglie i byte in una variabile su `window`; cliccare `Esporta backup` due volte: la prima chiama il picker, la seconda no (contatore su `window`), e il toast dice `Backup salvato`. Verificare anche che il paragrafo della sezione contenga `le volte dopo l'app lo riscrive lì da sola` in Chromium e `Chiedi per ogni download` in WebKit.

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npm run e2e`
Expected: FAIL sui nomi dei file e sul pulsante `Esporta copia con data` assente.

- [ ] **Step 3: Implementare in `impostazioni.js`**

Testi, pulsanti e toast esattamente come nella Specifica. Il paragrafo sceglie tra i tre testi con `isIOS()` e `'showSaveFilePicker' in window`. `esportaCopiaDatata` chiama `registraEsportazione` come `esportaBackup`.

- [ ] **Step 4: Eseguire tutto**

Run: `node --test && npm run e2e`
Expected: PASS. Gli screenshot in `docs/screenshots/` si rigenerano da soli: controllare che quello delle Impostazioni mostri il nuovo pulsante.

- [ ] **Step 5: Commit**

```bash
git add js/ui/impostazioni.js tests/e2e/app.e2e.mjs docs/screenshots
git commit -m "Impostazioni: esportazioni con nome fisso, copia con data, istruzioni per Safari e Chrome"
```

---

### Task 4: documentazione e versione

**Files:**
- Modify: `README.md:295-330` (sezione backup) e la riga 6/11 se citano il nome con data
- Modify: `PRODUCT.md:29`
- Modify (solo se questo è l'ultimo task delle due modifiche unite): `sw.js:5`, `js/app.js:10`, `js/ui/impostazioni.js:192`, `tests/pwa.test.js:79-82`, `tests/sw.test.js:10`

- [ ] **Step 1: Riscrivere la sezione del README** sul giro a due file fissi: "Dall'iPhone al Mac" importa `interventi118_iPhone.json`, "Dal Mac all'iPhone" importa `interventi118_Mac.json`; sottosezione nuova "Sul Mac: Safari o Chrome" con l'impostazione di Safari e il comportamento di Chrome/Edge; in "Promemoria e archivio" la riga su `Esporta copia con data` e il nome fisso dell'Excel.

- [ ] **Step 2: Aggiornare `PRODUCT.md`** riga 29 con la frase: `Files have a fixed name per device (interventi118_iPhone.json, interventi118_Mac.json) so they overwrite instead of piling up; there is deliberately no automatic or cloud backup, because the app will be used by other nurses and no shared storage is acceptable.`

- [ ] **Step 3: Versione** secondo Global Constraints, poi `node --test` → PASS (il test `la versione dell'app è la X ovunque` deve citare la nuova versione).

- [ ] **Step 4: Commit**

```bash
git add README.md PRODUCT.md sw.js js/app.js js/ui/impostazioni.js tests/pwa.test.js tests/sw.test.js
git commit -m "Backup con nome fisso: istruzioni e versione 1.4.0"
```

---

## Autoverifica del piano (fatta il 2026-10-30)

- Copertura: punti 1-3 → Task 1 e 3; 4 → Task 3 e 4; 5 → Task 3 (testo) e 4 (README); 6 → Task 2 e 3; 7-8 → nessun codice, verificati dalle prove esistenti.
- Nomi coerenti tra task: `nomeFileBackup(dispositivo, estensione)`, `nomeFileDatato(d)`, `tipoDispositivo()`, `salvaFile(blob, nome, { ricordo })`, chiavi `fileBackup` / `fileExcel`, esito `'salvato'`.
- Il piano non scrive il codice: dà firme, test e valori; il corpo lo scrive chi esegue.
