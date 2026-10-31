# Intervento con più pazienti – piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** registrare più pazienti sulla stessa MISSIONE con la spunta "Paziente multiplo" sulla prima scheda, collegamento automatico delle schede successive, statistiche che contano un'uscita come un intervento, colonna PAZIENTI in Excel, proposta (mai automatica) per i duplicati già in archivio, versione 1.5.0.

**Architecture:** un campo nuovo `pazienti` nel record (null = singolo, intero ≥ 2 = multiplo) e un modulo puro nuovo `js/core/pazienti.js` che definisce gruppo, prima scheda e le operazioni di collegamento; `controlli`, `modulo`, `statistiche`, `volo`, `domande`, `elenco`, `merge` ed `excel` lo usano. La UI aggiunge interruttore e numero al modulo, il riquadro verde condiviso tra modulo e foto tablet, il pulsante "Aggiungi paziente" (rotta `#/nuovo/<id>`), l'etichetta nell'elenco, due righe nelle statistiche e la sezione delle decisioni in Impostazioni.

**Tech Stack:** HTML, CSS, JavaScript vanilla (ES modules), SheetJS CE 0.20.3 in `vendor/`, test `node --test`, prove end-to-end Playwright (`npm run e2e`), Python 3 stdlib per `tools/xlsx_to_json.py`.

**Spec:** `docs/superpowers/specs/2026-10-31-paziente-multiplo-design.md`

## Global Constraints

- Nessuna dipendenza nuova, nessun build step, nessuna chiamata di rete.
- Interfaccia, messaggi, nomi di funzioni e variabili in italiano, come il codice esistente.
- `pazienti`: `null` oppure intero ≥ 2; un testo non numerico resta testo (avviso "Numero pazienti non valido").
- Chiave del gruppo: `String(missione ?? '').trim().toUpperCase()`; ordine delle schede: `createdAt` crescente, poi `id` crescente. Gruppo collegato = la prima scheda ha `pazienti !== null`. Una scheda nuova si salva con `createdAt` = istante del salvataggio, quindi la prima scheda è la prima salvata; finché non è salvata conta come ultima del suo gruppo.
- Testi fissi: errore "La MISSIONE X è già registrata." + "Se è un altro paziente dello stesso intervento, apri la prima scheda e attiva Paziente multiplo."; riquadro verde "Collegata all'intervento del GG/MM/AAAA, COMUNE: paziente multiplo (N pazienti)" con link "Apri la prima scheda"; nota "Collegata a 1 altra scheda" / "Collegata a N altre schede"; errori della prima scheda collegata "Questa scheda è collegata a 1 altra scheda: la MISSIONE non si può cambiare." e "Questa scheda è collegata a 1 altra scheda: Paziente multiplo resta attivo." ("N altre schede" al plurale); errore "Scrivi il numero di pazienti, oppure togli Paziente multiplo."; etichetta "Paziente n di N"; pulsante "Aggiungi paziente"; sezione "Stessa missione registrata più volte" con pulsanti "Stesso intervento", "Refuso", "Scollega".
- Avvisi nuovi: `TIPI_AVVISO_PAZIENTI = ['Numero pazienti non valido', 'Schede in più rispetto ai pazienti', 'Mancano schede paziente', 'Numero pazienti diverso tra le schede']`, in `TIPI_AVVISO` subito dopo 'Missione duplicata'; 'Tempo volo diverso tra le schede' in coda a `TIPI_AVVISO_VOLO`. Nessuno dei due gruppi esiste nell'Excel 118: il confronto con i dati reali (`tests/excel.test.js`, che su questo Mac gira davvero perché `data/` c'è) li toglie, come fa già con quelli di volo.
- Backup: `VERSIONE = 3`, `VERSIONI_LEGGIBILI = [1, 2, 3]`. Nessuna migrazione di IndexedDB (`normalizzaRecord` al caricamento).
- Versione app 1.5.0 in `js/app.js`, `sw.js`, Impostazioni → Informazioni, README e `tests/pwa.test.js`. La 1.5.0 contiene anche la foto del tablet girata (1.4.5, pronta nell'albero di lavoro, descritta in `HANDOFF.md`): la 1.4.5 da sola non esce.
- **Passo 0, prima del Task 1:** commit locale della 1.4.5 su `main` (solo i file della foto girata elencati in `HANDOFF.md`; non `HANDOFF.md`, non la spec e il piano del paziente multiplo, non `.gitignore`: la sua riga `.court/` va nel commit del Task 1), poi `git checkout -b paziente-multiplo`. Se `main` è già oltre la 1.4.5, partire da lì. `HANDOFF.md` si cancella a lavoro ripreso.
- Branch `paziente-multiplo`, commit solo in locale, nessun push e nessuna pubblicazione senza l'ok esplicito dell'utente (`wrangler` mai dalla cartella del progetto).
- Test, fixture e screenshot solo con dati inventati (missioni `99ZZ…`, `DEMO…`, `E2E…`). I dati reali stanno in `data/`, esclusa da git.
- Ogni file nuovo dell'app va in `FILE` di `sw.js` nello stesso task (`tests/pwa.test.js`).
- Messaggi di commit in italiano, chiusi dalla riga `Co-Authored-By` del modello che scrive il codice (oggi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## Review Focus

1. **Record salvati prima della 1.5.0** (senza `pazienti`): avvisi, statistiche, merge, Excel li trattano come `pazienti: null`; un backup v2 reimportato non produce aggiornamenti né conflitti. Test nei Task 1 e 6.
2. **Numero pazienti cancellato o sbagliato con la spunta accesa** (campo svuotato per riscriverlo, "1", "2,5", "tre"): la spunta resta accesa e il campo resta visibile; vuoto blocca il salvataggio con "Scrivi il numero di pazienti, oppure togli Paziente multiplo."; un numero non valido si salva con l'avviso "Numero pazienti non valido". Test nei Task 2, 3 e 10.
3. **Refuso con la stessa MISSIONE di un gruppo collegato** (una scheda di un altro intervento scritta per sbaglio): si collega senza errore; la difesa è "Schede in più rispetto ai pazienti" e il riquadro verde che dice data e comune. Test nel Task 2 (avviso) e nel Task 10 (riquadro con il comune).
4. **Unione Mac/iPhone con schede dello stesso gruppo nate su due dispositivi** (una con `pazienti`, una senza): nessun record perso, avviso "Numero pazienti diverso tra le schede" sulla scheda senza numero, gruppo escluso da "Stessa missione registrata più volte" del riepilogo import. Test nei Task 2 e 6.
5. **Bozza lasciata a metà, più vecchia della prima scheda** (il `createdAt` della bozza viene dall'apertura del modulo): la scheda nuova si collega lo stesso e al salvataggio prende l'istante del salvataggio, quindi resta dopo la prima. Test nei Task 2 e 3.

---

### Task 1: Campo `pazienti`, backup v3 e modulo `js/core/pazienti.js`

**Files:**
- Create: `js/core/pazienti.js`
- Modify: `js/core/campi.js` (CAMPI, normalizzaRecord), `js/core/merge.js` (VERSIONE, VERSIONI_LEGGIBILI, chiaveMissione importata), `js/core/excel.js` (SEZIONI, indici dei formati), `tools/xlsx_to_json.py`, `sw.js` (FILE), `tests/fixtures/record-domande.js` e il `VUOTO` di `tests/esporta-excel.test.js`, `tests/merge.test.js`, `tests/elenco.test.js`, `tests/volo.test.js` (`pazienti: null`)
- Test: `tests/pazienti.test.js` (nuovo), `tests/campi.test.js`, `tests/merge.test.js`, `tests/esporta-excel.test.js`

**Interfaces:**
- Produces (in `js/core/campi.js`): `CAMPI` con `{ chiave: 'pazienti', intestazione: 'PAZIENTI', sezione: 'Identificazione' }` subito dopo `missione`; `normalizzaRecord(r).pazienti` via `normalizzaNumero` (come `eta`).
- Produces (in `js/core/pazienti.js`):
  - `chiaveMissione(m: unknown): string`
  - `ordinaSchede(schede: Record[]): Record[]` copia ordinata per `createdAt` poi `id`
  - `gruppiMissione(records: Record[]): Map<string, Record[]>` solo non eliminati con chiave non vuota, ogni gruppo ordinato
  - `schedeDi(records, missione, { escludi = null } = {}): Record[]` gruppo ordinato senza il record con `id === escludi`
  - `primaScheda(records, missione, { escludi = null } = {}): Record | null`
  - `isMultiplo(r): boolean` (`pazienti !== null && pazienti !== undefined`), `pazientiValidi(r): boolean` (intero ≥ 2)
  - `isCollegato(schede: Record[]): boolean` = `schede.length > 0 && isMultiplo(schede[0])`
  - `unaPerMissione(records: Record[]): Record[]` dei gruppi collegati (calcolati sui record passati) tiene solo la prima; il resto resta, nell'ordine di arrivo
  - `collegaGruppo(schede, adesso: Date): Record[]` copie con `pazienti: schede.length` e `updatedAt: adesso.toISOString()`
  - `scollegaGruppo(schede, adesso): Record[]` copie con `pazienti: null`
  - `propagaPazienti(prima, records, adesso): Record[]` le altre schede del gruppo di `prima` con `pazienti !== prima.pazienti`, copiate con `pazienti: prima.pazienti` e `updatedAt` aggiornato
- Produces (in `js/core/merge.js`): `VERSIONE = 3`; `chiaveMissione` importata da `./pazienti.js` (la copia locale sparisce).
- Produces (in `js/core/excel.js`): `INTESTAZIONI` segue `CAMPI` (PAZIENTI in posizione 4); `SEZIONI = [['IDENTIFICAZIONE', 0, 4], ['MEZZO', 5, 7], ['INVIO DALLA CO', 8, 10], ['PAZIENTE', 11, 12], ['ESITO', 13, 14], ['RIENTRO (valutazione sul posto)', 15, 17], ['TEMPI', 18, 18], ['VOLO', 19, 26], ['CALCOLATE – non scrivere', 27, 31]]`; formato `hh:mm` sulla colonna 18 (LIBERO OPERATIVO) invece di 17; `cella(r, 'pazienti')` = numero o `null`.
- Produces (in `tools/xlsx_to_json.py`): legge l'intestazione della riga 2 del foglio "Interventi"; se la cella E2 vale `PAZIENTI` usa un tracciato con `"E": "pazienti"` e le lettere da F in poi spostate di una (F comune … S liberoOperativo), altrimenti il tracciato attuale; `pazienti` convertito come `eta` (`converti_eta`), assente dal record quando il tracciato non ha la colonna.

- [ ] **Step 1: Write the failing tests** in `tests/pazienti.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chiaveMissione, ordinaSchede, gruppiMissione, schedeDi, primaScheda, isMultiplo, pazientiValidi, isCollegato,
  unaPerMissione, collegaGruppo, scollegaGruppo, propagaPazienti,
} from '../js/core/pazienti.js';

const T0 = '2026-10-01T10:00:00.000Z';
const T1 = '2026-10-01T10:05:00.000Z';
const rec = (id, campi = {}) => ({ id, createdAt: T0, updatedAt: T0, deleted: false, missione: '99ZZ0001', pazienti: null, ...campi });

test('chiave: spazi tolti e maiuscolo', () => {
  assert.equal(chiaveMissione(' 99zz0001 '), '99ZZ0001');
  assert.equal(chiaveMissione(null), '');
});

test('ordine delle schede: createdAt poi id, deterministico', () => {
  const b = rec('b', { createdAt: T0 });
  const a = rec('a', { createdAt: T1 });
  const c = rec('c', { createdAt: T0 });
  assert.deepEqual(ordinaSchede([a, b, c]).map((r) => r.id), ['b', 'c', 'a']);
});

test('gruppi: solo non eliminati con missione, ordinati; prima scheda senza l\'esclusa', () => {
  const r = [rec('x', { missione: '' }), rec('2', { createdAt: T1 }), rec('1'), rec('3', { deleted: true }), rec('9', { missione: '99ZZ0002' })];
  assert.deepEqual([...gruppiMissione(r).keys()], ['99ZZ0001', '99ZZ0002']);
  assert.deepEqual(schedeDi(r, '99zz0001').map((s) => s.id), ['1', '2']);
  assert.equal(primaScheda(r, '99ZZ0001').id, '1');
  assert.equal(primaScheda(r, '99ZZ0001', { escludi: '1' }).id, '2');
  assert.equal(primaScheda(r, '99ZZ0003'), null);
});

test('multiplo e validità del numero', () => {
  assert.ok(!isMultiplo(rec('a')) && isMultiplo(rec('a', { pazienti: 2 })) && isMultiplo(rec('a', { pazienti: 'due' })));
  assert.ok(!isMultiplo({ id: 'v' }), 'record salvato prima della 1.5.0, senza il campo');
  assert.ok(pazientiValidi(rec('a', { pazienti: 2 })) && !pazientiValidi(rec('a', { pazienti: 1 })) && !pazientiValidi(rec('a', { pazienti: 2.5 })));
  assert.ok(isCollegato([rec('1', { pazienti: 3 }), rec('2')]) && !isCollegato([rec('1'), rec('2', { pazienti: 3 })]) && !isCollegato([]));
});

test('una per missione: i gruppi collegati contano una volta, i duplicati non collegati restano tutti', () => {
  const r = [rec('2', { createdAt: T1, pazienti: 2 }), rec('1', { pazienti: 2 }), rec('a', { missione: '99ZZ0002' }), rec('b', { missione: '99ZZ0002' }), rec('s', { missione: '' })];
  assert.deepEqual(unaPerMissione(r).map((x) => x.id), ['1', 'a', 'b', 's']);
});

test('collega, scollega e propaga: copie con updatedAt nuovo, originali intatti', () => {
  const adesso = new Date(T1);
  const s = [rec('1'), rec('2')];
  const collegate = collegaGruppo(s, adesso);
  assert.deepEqual(collegate.map((x) => [x.pazienti, x.updatedAt]), [[2, T1], [2, T1]]);
  assert.equal(s[0].pazienti, null);
  assert.deepEqual(scollegaGruppo(collegate, adesso).map((x) => x.pazienti), [null, null]);
  const prima = rec('1', { pazienti: 3 });
  const altre = propagaPazienti(prima, [prima, rec('2', { pazienti: 2 }), rec('3', { pazienti: 3 }), rec('z', { missione: '99ZZ0009' })], adesso);
  assert.deepEqual(altre.map((x) => [x.id, x.pazienti, x.updatedAt]), [['2', 3, T1]]);
});
```

In `tests/campi.test.js` aggiungere:

```js
test('pazienti: null se vuoto, numero, testo conservato', () => {
  assert.equal(normalizzaRecord({ id: 'a' }).pazienti, null);
  assert.equal(normalizzaRecord({ id: 'a', pazienti: '3' }).pazienti, 3);
  assert.equal(normalizzaRecord({ id: 'a', pazienti: 'tre' }).pazienti, 'tre');
  assert.equal(CAMPI.findIndex((c) => c.chiave === 'pazienti'), CAMPI.findIndex((c) => c.chiave === 'missione') + 1);
});
```

In `tests/esporta-excel.test.js` ogni indice di colonna da COMUNE in poi cresce di uno, in tutti i test che li usano (righe, colonne VOLO, file SheetJS): intestazioni con PAZIENTI dopo MISSIONE, `righe[0][19] === 'VOLO'`, `righe[0][27] === 'CALCOLATE – non scrivere'`, `null` in posizione 4 nella riga 2, `righe[3][6] === 'V-ECHO'`, `righe[3][27] === 30`, `righe[3][30] === null`, `righe[4][31]` per CONTROLLI, merge e formato ora sulla colonna 18. `RECORD` non cambia (il test conta le sue righe). In più:

```js
test('colonna PAZIENTI: il numero sulle schede collegate, vuota per l\'intervento singolo', () => {
  const righe = righeExcel([r({ id: 'p', data: '2026-02-01', missione: '99ZZ0300', pazienti: 2 }), r({ id: 's', data: '2026-02-02', missione: '99ZZ0301' })]);
  assert.equal(righe[1][4], 'PAZIENTI');
  assert.deepEqual(righe.slice(2).map((x) => x[4]), [2, null]);
});
```

Nel test di rilettura con Python esportare `[...RECORD, r({ id: 'p', data: '2026-01-05', missione: '99ZZ0300', pazienti: 2 })]` (anche negli attesi) e lasciare `pazienti` tra i campi confrontati.

In `tests/merge.test.js` aggiungere:

```js
test('backup v3: si scrive 3, si leggono 1, 2 e 3; record v2 senza pazienti e stesso record v3 con null: invariato', () => {
  assert.equal(creaBackup({ record: [], liste: {}, dispositivo: 'x' }).versione, 3);
  const v2 = { ...rec('1', PRIMA) };
  delete v2.pazienti;
  const esito = unisci([rec('1', PRIMA, { pazienti: null })], [v2], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 0, invariati: 1, eliminati: 0 });
  assert.deepEqual(leggiBackup(JSON.stringify({ formato: 'interventi118', versione: 2, record: [v2] })).record[0].pazienti, null);
  assert.throws(() => leggiBackup(JSON.stringify({ formato: 'interventi118', versione: 4, record: [] })), /più recente/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pazienti.test.js tests/campi.test.js tests/merge.test.js tests/esporta-excel.test.js`
Expected: FAIL (`pazienti.js` non esiste; `pazienti` non in `CAMPI`; versione 2; colonna PAZIENTI assente).

- [ ] **Step 3: Implement** `js/core/pazienti.js` con le firme sopra; aggiungere la voce a `CAMPI` e il ramo `pazienti` in `normalizzaRecord` (stesso ramo di `eta`/`tempoVolo`); `VERSIONE = 3` e `VERSIONI_LEGGIBILI = [1, 2, 3]` in `merge.js`, con il commento `// 3: pazienti (intervento con più pazienti)`; `'js/core/pazienti.js'` in `FILE` di `sw.js` (ordine alfabetico, dopo `modulo.js`); `pazienti: null` nei `VUOTO` delle fixture indicate; `excel.js` e `tools/xlsx_to_json.py` come da Interfaces.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. Poi, solo se `data/` esiste sul Mac: `python3 tools/xlsx_to_json.py` sull'Excel originale e `node --test tests/excel.test.js` → PASS (tracciato senza PAZIENTI ancora letto).

- [ ] **Step 5: Commit**

```bash
git add .gitignore js/core/pazienti.js js/core/campi.js js/core/merge.js js/core/excel.js tools/xlsx_to_json.py sw.js tests/pazienti.test.js tests/campi.test.js tests/merge.test.js tests/esporta-excel.test.js tests/elenco.test.js tests/volo.test.js tests/fixtures/record-domande.js
git commit -m "Paziente multiplo: campo pazienti, gruppo e prima scheda, backup v3, colonna PAZIENTI in Excel"
```

---

### Task 2: Controlli: gruppi nell'indice, avvisi nuovi, collegamento e blocchi al salvataggio

**Files:**
- Modify: `js/core/controlli.js`, `tests/excel.test.js` (`statistiche118` toglie anche `TIPI_AVVISO_PAZIENTI`)
- Test: `tests/controlli.test.js`

**Interfaces:**
- Consumes: `gruppiMissione`, `schedeDi`, `primaScheda`, `ordinaSchede`, `isMultiplo`, `pazientiValidi`, `isCollegato` da `./pazienti.js`.
- Produces:
  - `indiceMissioni(records): Map<string, Record[]>` = `gruppiMissione(records)` (il valore passa da numero a elenco ordinato; chi lo usa lo passa ad `avvisi` senza guardarci dentro)
  - `avvisi(r, indice): string[]` nell'ordine di `TIPI_AVVISO`, con le regole: 'Missione duplicata' se il gruppo ha ≥ 2 schede e non è collegato; se è collegato: 'Numero pazienti non valido' se `isMultiplo(r) && r.pazienti !== '' && !pazientiValidi(r)` (il numero cancellato nel modulo lo ferma già il salvataggio, con il suo messaggio); con `pazientiValidi(prima)`: 'Schede in più rispetto ai pazienti' se `schede.length > prima.pazienti`, 'Mancano schede paziente' se `schede.length < prima.pazienti`; 'Numero pazienti diverso tra le schede' se `r.pazienti !== prima.pazienti`; 'Tempo volo diverso tra le schede' se `isElicottero(r.mezzo)`, `r` non è la prima, entrambi i tempi numerici e diversi. 'Numero pazienti non valido' vale anche fuori da un gruppo (scheda singola con la spunta e un numero sbagliato).
  - `verificaSalvataggio(record, records, originale = null): { ok, errori, duplicatoDi, collegataA, bloccata }`:
    - `altre = schedeDi(records, record.missione, { escludi: record.id })`; se la MISSIONE è nuova o cambiata e `altre` non è vuoto: `isCollegato(altre)` e il record non sarebbe la prima scheda (una scheda nuova, `originale === null`, è sempre l'ultima; una già salvata lo è se `ordinaSchede([...altre, record])[0].id === record.id`) → `collegataA = altre[0].id`, nessun errore; altrimenti errore `La MISSIONE X è già registrata.` seguito, come secondo elemento di `errori`, da `Se è un altro paziente dello stesso intervento, apri la prima scheda e attiva Paziente multiplo.` e `duplicatoDi = altre[0].id`;
    - se `originale` è la prima scheda di un gruppo collegato con altre schede (`primaScheda(records, originale.missione)?.id === originale.id` e `schedeDi(records, originale.missione, { escludi: originale.id }).length > 0` e `isMultiplo(originale)`): `bloccata = n` (numero delle altre schede); errore `Questa scheda è collegata a ${quante}: la MISSIONE non si può cambiare.` se la chiave cambia; errore `Questa scheda è collegata a ${quante}: Paziente multiplo resta attivo.` se `!isMultiplo(record)`, con `quante` = `1 altra scheda` oppure `N altre schede`;
    - `record.pazienti === ''` (spunta accesa, numero cancellato): errore `Scrivi il numero di pazienti, oppure togli Paziente multiplo.`;
    - se `record.missione` coincide con `originale.missione`, `altre` è collegato e `record` non è la prima scheda (stessa guardia sull'ordine), `collegataA = altre[0].id` anche in modifica (serve al riquadro verde nel dettaglio di una scheda collegata); la prima scheda non ha mai `collegataA`.
  - `TIPI_AVVISO_PAZIENTI` esportata; `TIPI_AVVISO` e `TIPI_AVVISO_VOLO` nell'ordine fissato nei Global Constraints.

- [ ] **Step 1: Write the failing tests** in `tests/controlli.test.js` (la `rec` del file prende `pazienti: null`)

```js
const T1 = '2026-01-01T00:05:00.000Z';
const gruppo = (n, pazienti, extra = []) => [
  rec({ id: 'p1', pazienti }),
  ...Array.from({ length: n - 1 }, (_, i) => rec({ id: `p${i + 2}`, createdAt: T1, pazienti, ...(extra[i] ?? {}) })),
];

test('gruppo collegato: nessun duplicato; numero di schede confrontato con i pazienti dichiarati', () => {
  const ok = gruppo(2, 2);
  assert.deepEqual(avvisi(ok[0], indiceMissioni(ok)), []);
  assert.deepEqual(avvisi(ok[1], indiceMissioni(ok)), []);
  const troppe = gruppo(3, 2);
  assert.deepEqual(avvisi(troppe[2], indiceMissioni(troppe)), ['Schede in più rispetto ai pazienti']);
  const poche = gruppo(1, 3);
  assert.deepEqual(avvisi(poche[0], indiceMissioni(poche)), ['Mancano schede paziente']);
});

test('gruppo non collegato (prima scheda senza spunta): Missione duplicata anche se la seconda ha la spunta', () => {
  const r = [rec({ id: 'p1' }), rec({ id: 'p2', createdAt: T1, pazienti: 2 })];
  assert.deepEqual(avvisi(r[0], indiceMissioni(r)), ['Missione duplicata']);
  assert.deepEqual(avvisi(r[1], indiceMissioni(r)), ['Missione duplicata']);
});

test('numero pazienti non valido, diverso tra le schede, tempo di volo diverso', () => {
  assert.deepEqual(avvisiDi(rec({ pazienti: 1 })), ['Numero pazienti non valido']);
  assert.deepEqual(avvisiDi(rec({ pazienti: 'due' })), ['Numero pazienti non valido']);
  assert.deepEqual(avvisiDi(rec({ pazienti: '' })), [], 'numero cancellato: lo blocca il salvataggio, non un avviso');
  const r = gruppo(2, 2, [{ pazienti: null }]);
  assert.deepEqual(avvisi(r[1], indiceMissioni(r)), ['Numero pazienti diverso tra le schede']);
  const v = gruppo(2, 2, [{ tempoVolo: 30 }]).map((x) => ({ ...x, mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: x.tempoVolo ?? 25 }));
  assert.deepEqual(avvisi(v[1], indiceMissioni(v)), ['Tempo volo diverso tra le schede']);
  assert.deepEqual(avvisi(v[0], indiceMissioni(v)), []);
});

test('prima scheda eliminata: la seconda diventa prima e il gruppo segue la sua spunta', () => {
  const r = [rec({ id: 'p1', deleted: true, pazienti: 2 }), rec({ id: 'p2', createdAt: T1, pazienti: 2 }), rec({ id: 'p3', createdAt: T1, pazienti: null })];
  assert.deepEqual(avvisi(r[2], indiceMissioni(r)), ['Numero pazienti diverso tra le schede']);
});

test('salvataggio: scheda nuova con la missione di una prima scheda con la spunta si collega', () => {
  const prima = rec({ id: 'p1', pazienti: 2 });
  // una scheda nuova è sempre l'ultima del gruppo, anche con un createdAt più vecchio (bozza lasciata a metà)
  const v = verificaSalvataggio(rec({ id: 'n', createdAt: '2025-12-31T00:00:00.000Z', pazienti: null }), [prima]);
  assert.deepEqual([v.ok, v.collegataA, v.duplicatoDi], [true, 'p1', null]);
});

test('salvataggio: senza spunta sulla prima scheda resta l\'errore, con la frase sul paziente multiplo', () => {
  const v = verificaSalvataggio(rec({ id: 'n' }), [rec({ id: 'p1' })]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.errori, ['La MISSIONE 99ZZ0101 è già registrata.', 'Se è un altro paziente dello stesso intervento, apri la prima scheda e attiva Paziente multiplo.']);
  assert.equal(v.duplicatoDi, 'p1');
});

test('prima scheda collegata: MISSIONE e spunta bloccate; libera se è l\'unica', () => {
  const prima = rec({ id: 'p1', pazienti: 2 });
  const seconda = rec({ id: 'p2', createdAt: T1, pazienti: 2 });
  const cambioMissione = verificaSalvataggio({ ...prima, missione: '99ZZ0102' }, [prima, seconda], prima);
  assert.deepEqual([cambioMissione.ok, cambioMissione.bloccata, cambioMissione.errori], [false, 1, ['Questa scheda è collegata a 1 altra scheda: la MISSIONE non si può cambiare.']]);
  const toltaSpunta = verificaSalvataggio({ ...prima, pazienti: null }, [prima, seconda], prima);
  assert.deepEqual([toltaSpunta.ok, toltaSpunta.errori], [false, ['Questa scheda è collegata a 1 altra scheda: Paziente multiplo resta attivo.']]);
  assert.equal(verificaSalvataggio({ ...prima, pazienti: null }, [prima], prima).ok, true);
  const collegata = verificaSalvataggio({ ...seconda, missione: '99ZZ0102', pazienti: null }, [prima, seconda], seconda);
  assert.equal(collegata.ok, true, 'la scheda collegata cambia MISSIONE liberamente');
  assert.equal(verificaSalvataggio(seconda, [prima, seconda], seconda).collegataA, 'p1');
  assert.equal(verificaSalvataggio(prima, [prima, seconda], prima).collegataA, null, 'la prima scheda non è collegata a nessuno');
});

test('salvataggio: spunta accesa senza numero si blocca, un numero non valido si salva con l\'avviso', () => {
  const vuoto = verificaSalvataggio(rec({ id: 'n', pazienti: '' }), []);
  assert.deepEqual([vuoto.ok, vuoto.errori], [false, ['Scrivi il numero di pazienti, oppure togli Paziente multiplo.']]);
  assert.equal(verificaSalvataggio(rec({ id: 'n', pazienti: 1 }), []).ok, true);
});

test('TIPI_AVVISO nell\'ordine della colonna CONTROLLI', () => {
  assert.deepEqual(TIPI_AVVISO.slice(4, 9), ['Missione duplicata', 'Numero pazienti non valido', 'Schede in più rispetto ai pazienti', 'Mancano schede paziente', 'Numero pazienti diverso tra le schede']);
  assert.equal(TIPI_AVVISO.at(-1), 'Tempo volo diverso tra le schede');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/controlli.test.js`
Expected: FAIL (avvisi mancanti, `collegataA` undefined).

- [ ] **Step 3: Implement** in `js/core/controlli.js` come da Interfaces. Il test esistente `missione duplicata: avviso su entrambe le righe` resta valido.

- [ ] **Step 4: Run** `node --test tests/controlli.test.js tests/elenco.test.js tests/statistiche.test.js tests/esporta-excel.test.js tests/excel.test.js`
Expected: PASS (gli altri moduli passano l'indice ad `avvisi` senza leggerlo; `tests/excel.test.js` gira sui dati reali di `data/` e resta uguale all'Excel).

- [ ] **Step 5: Commit**

```bash
git add js/core/controlli.js tests/controlli.test.js tests/excel.test.js
git commit -m "Paziente multiplo: avvisi di gruppo, collegamento e blocchi al salvataggio"
```

---

### Task 3: Modulo: campo nel form, eredità dalla prima scheda, nuova scheda paziente

**Files:**
- Modify: `js/core/modulo.js`
- Test: `tests/modulo.test.js`

**Interfaces:**
- Consumes: `ordinaSchede`, `isCollegato`, `schedeDi` da `./pazienti.js`.
- Produces:
  - `recordVuoto` dà `pazienti: null` (segue da `CAMPI` se il ramo numerico include `pazienti`)
  - `impostaCampo(r, 'pazienti', valore)`: `null` → `null` (spunta spenta); `''` → `''` (spunta accesa e numero cancellato: il campo resta visibile e il salvataggio si blocca, Task 2); altrimenti `normalizzaNumero`
  - `collegaScheda(r, records, eraCollegata: string | null): { record, collegataA: string | null }`: `altre = schedeDi(records, r.missione, { escludi: r.id })`; se `isCollegato(altre)` e `r` non sarebbe la prima scheda (`r` assente da `records` = scheda nuova, sempre l'ultima; altrimenti `ordinaSchede([...altre, r])[0].id !== r.id`) → `record.pazienti = altre[0].pazienti`, `collegataA = altre[0].id`; altrimenti `collegataA = null` e, se `eraCollegata !== null`, `record.pazienti = null`; in tutti gli altri casi `record` è `r` invariato
  - `nuovaSchedaPaziente(prima, id, adesso): Record` = `recordVuoto(id, adesso)` con copiati da `prima`: `data, oraAllert, missione, pazienti, comune, mezzo, tipologia, codiceInvio, patologiaInvio, luogoInvio, liberoOperativo, tipoMissione, tempoVolo`; restano vuoti `eta, sesso, esito, ospedale, codiceRientro, patologiaRientro, luogoRientro, manovre`
  - `prontoPerSalvare(r, adesso, { nuovo = false } = {})`: con `nuovo` anche `createdAt = adesso.toISOString()` (la scheda nuova prende l'istante del salvataggio); senza, come oggi

- [ ] **Step 1: Write the failing tests** in `tests/modulo.test.js`

```js
test('pazienti: spunta spenta nel record nuovo, numero, numero cancellato', () => {
  assert.equal(recordVuoto('x', new Date()).pazienti, null);
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', '3').pazienti, 3);
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', '').pazienti, '', 'numero cancellato: la spunta resta accesa');
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', null).pazienti, null);
});

test('collegaScheda: eredita il numero dalla prima scheda con la spunta, lo perde quando la missione cambia', () => {
  const prima = { ...recordVuoto('p1', new Date('2026-01-01T10:00:00Z')), missione: '99ZZ0001', pazienti: 3 };
  const nuova = { ...recordVuoto('n', new Date('2026-01-01T11:00:00Z')), missione: '99ZZ0001' };
  const c = collegaScheda(nuova, [prima], null);
  assert.deepEqual([c.record.pazienti, c.collegataA], [3, 'p1']);
  const vecchia = collegaScheda({ ...nuova, createdAt: '2025-01-01T00:00:00.000Z' }, [prima], null);
  assert.equal(vecchia.collegataA, 'p1', 'una scheda nuova è sempre l\'ultima, anche con un createdAt più vecchio');
  const via = collegaScheda({ ...c.record, missione: '99ZZ0002' }, [prima], 'p1');
  assert.deepEqual([via.record.pazienti, via.collegataA], [null, null]);
  const libera = collegaScheda({ ...nuova, missione: '99ZZ0002', pazienti: 2 }, [prima], null);
  assert.deepEqual([libera.record.pazienti, libera.collegataA], [2, null], 'una spunta messa a mano resta');
  const senzaSpunta = collegaScheda(nuova, [{ ...prima, pazienti: null }], null);
  assert.deepEqual([senzaSpunta.record.pazienti, senzaSpunta.collegataA], [null, null]);
  const laPrima = collegaScheda({ ...prima, pazienti: 4 }, [prima, { ...c.record, createdAt: '2026-01-01T11:00:00.000Z' }], null);
  assert.deepEqual([laPrima.record.pazienti, laPrima.collegataA], [4, null], 'la prima scheda non eredita dalle altre');
});

test('nuovaSchedaPaziente: campi condivisi copiati, campi del paziente vuoti', () => {
  const prima = { ...recordVuoto('p1', new Date('2026-01-01T10:00:00Z')), data: '2026-01-01', oraAllert: '10:00', missione: '99ZZ0001', pazienti: 2,
    comune: 'BIELLA', mezzo: 'V-ECHO', tipologia: 'Mike', codiceInvio: 'ROSSO', patologiaInvio: '01 - Trauma', luogoInvio: 'S - Sierra',
    eta: 40, sesso: 'Maschio', esito: 'Trasportato', ospedale: 'Biella', codiceRientro: 'GIALLO', patologiaRientro: '01 - Trauma',
    luogoRientro: 'S - Sierra', liberoOperativo: '11:30', tipoMissione: 'HEMS', tempoVolo: 35, manovre: ['VD'] };
  const n = nuovaSchedaPaziente(prima, 'n', new Date('2026-01-02T08:00:00Z'));
  assert.equal(n.id, 'n');
  assert.deepEqual([n.data, n.oraAllert, n.missione, n.pazienti, n.comune, n.mezzo, n.tipologia, n.codiceInvio, n.patologiaInvio, n.luogoInvio, n.liberoOperativo, n.tipoMissione, n.tempoVolo],
    ['2026-01-01', '10:00', '99ZZ0001', 2, 'BIELLA', 'V-ECHO', 'Mike', 'ROSSO', '01 - Trauma', 'S - Sierra', '11:30', 'HEMS', 35]);
  assert.deepEqual([n.eta, n.sesso, n.esito, n.ospedale, n.codiceRientro, n.patologiaRientro, n.luogoRientro, n.manovre], [null, '', '', '', '', '', '', []]);
  assert.equal(n.createdAt, '2026-01-02T08:00:00.000Z');
});

test('salvataggio di una scheda nuova: createdAt diventa l\'istante del salvataggio', () => {
  const r = recordVuoto('x', new Date('2026-01-01T08:00:00.000Z'));
  const adesso = new Date('2026-01-01T09:30:00.000Z');
  assert.equal(prontoPerSalvare(r, adesso, { nuovo: true }).createdAt, '2026-01-01T09:30:00.000Z');
  assert.equal(prontoPerSalvare(r, adesso).createdAt, '2026-01-01T08:00:00.000Z');
});
```

- [ ] **Step 2: Run** `node --test tests/modulo.test.js` → FAIL.
- [ ] **Step 3: Implement** `impostaCampo`, `collegaScheda`, `nuovaSchedaPaziente` e `prontoPerSalvare` in `js/core/modulo.js`.
- [ ] **Step 4: Run** `node --test tests/modulo.test.js` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Paziente multiplo: regole del modulo, eredità dalla prima scheda, nuova scheda paziente"`

---

### Task 4: Statistiche e domande: un'uscita vale 1, pazienti per scheda

**Files:**
- Modify: `js/core/statistiche.js`, `js/core/domande.js`, `tests/fixtures/record-domande.js` (fixture `MULTI`), `tests/excel.test.js` (`statistiche118` toglie le chiavi nuove)
- Test: `tests/statistiche.test.js`, `tests/domande.test.js`

**Interfaces:**
- Consumes: `unaPerMissione`, `isMultiplo` da `./pazienti.js`.
- Produces (in `calcolaStatistiche`):
  - `righe` (tutte le schede del periodo, come oggi `{ r, c, avvisi }`) e `missioni` = le righe la cui scheda resta in `unaPerMissione(filtraPeriodo(records, periodo))` (confronto per id), cioè una per gruppo collegato;
  - **per missione** (su `missioni`): `totali`, `india`, `mike`, `durate` (durataMedia/Mediana/Max), `mesi[].interventi`, `mesi[].durataMedia`, `mezzi[].n/india/mike/durataMedia`, `ore[].n`, `kpi.interventi`;
  - **per scheda** (su `righe`): `schede = righe.length` (nuovo in `riepilogo`), `annullati`, `valutati = schede − annullati`, `trasportati`, `deceduti`, `maschi`, `femmine`, `eta`, codici, matrice, cambioCodice, patologia, luogo, esito, fasceEta, ospedali, controlli, `mesi[].rossiInvio/trasportati`, `kpi.rossiInvio`, `kpi.avvisi`;
  - **basi delle percentuali**: numeratore per missione → `totali` (`indiaPct`, `mikePct`, `mezzi[].pct`, `ore[].pct`); numeratore per scheda e oggi diviso per `totali` → `schede` (`annullatiPct`, `codici[].invioPct`, `patologia[].invioPct`, `luogo[].invioPct`, `esito[].pct`, `kpi.rossiInvioPct`, `kpi.annullatiPct`, `kpi.avvisiPct`); per `valutati` e `trasportati` invariato;
  - `riepilogo.multipli` = numero di gruppi collegati in `righe` (missioni con `isMultiplo` sulla prima), `riepilogo.pazientiMultipli` = schede di quei gruppi; `kpi.multipli` uguale a `riepilogo.multipli`.
- Produces (in `tests/excel.test.js`): `statistiche118` toglie `riepilogo.schede`, `riepilogo.multipli`, `riepilogo.pazientiMultipli` e `kpi.multipli`, che l'Excel 118 non ha; sui dati reali, senza gruppi collegati, tutti gli altri numeri restano quelli dell'Excel.
- Produces (in `domande.js`): la misura `'interventi'` = `unaPerMissione(righe.map(({ r }) => r)).length`; `pctTotali` divide per le schede (invariato nel codice: `selezione.length`).

- [ ] **Step 1: Write the failing tests.** In `tests/fixtures/record-domande.js` la fixture `MULTI` (i record di `RECORD` più due schede della stessa missione). Nei due test esistenti che confrontano l'oggetto intero aggiungere le chiavi nuove: `multipli: 0` in `kpi` ('KPI della dashboard'), `schede: 5, multipli: 0, pazientiMultipli: 0` in `riepilogo` ('tabella 1 · riepilogo'). Poi:

```js
// tests/fixtures/record-domande.js
export const MULTI = [
  ...RECORD,
  r({ id: 'm1', createdAt: '2026-03-01T10:00:00.000Z', data: '2026-03-01', oraAllert: '09:00', liberoOperativo: '10:00', missione: '04AA0101', pazienti: 2, mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'ROSSO', codiceRientro: 'GIALLO', esito: 'Trasportato', ospedale: 'Biella', eta: 20, sesso: 'Maschio' }),
  r({ id: 'm2', createdAt: '2026-03-01T10:05:00.000Z', data: '2026-03-01', oraAllert: '09:00', liberoOperativo: '10:00', missione: '04AA0101', pazienti: 2, mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'ROSSO', codiceRientro: 'ROSSO', esito: 'Trasportato', ospedale: 'Novara', eta: 60, sesso: 'Femmina' }),
];

// tests/statistiche.test.js: RECORD, MULTI e r dalla fixture, unaPerMissione da '../js/core/pazienti.js'
test('intervento con due pazienti: conta come un intervento, i pazienti si contano per scheda', () => {
  const s = calcolaStatistiche(MULTI, LISTE_PREDEFINITE, TUTTO);
  assert.equal(unaPerMissione(filtraPeriodo(MULTI, TUTTO)).length, 6);
  assert.deepEqual([s.riepilogo.totali, s.riepilogo.schede, s.riepilogo.valutati, s.riepilogo.trasportati], [6, 7, 6, 3]);
  assert.deepEqual([s.riepilogo.multipli, s.riepilogo.pazientiMultipli, s.kpi.interventi, s.kpi.multipli], [1, 2, 6, 1]);
  assert.equal(s.riepilogo.mike, 4, 'tipologia una volta per missione');
  assert.equal(s.riepilogo.durataMedia, 43, 'durata una volta per missione: (60+40+10+45+60)/5');
  assert.equal(s.mesi.find((m) => m.chiave === '2026-03').interventi, 1);
  assert.equal(s.mesi.find((m) => m.chiave === '2026-03').trasportati, 2);
  assert.equal(s.mezzi.find((m) => m.voce === '3030').n, 4);
  assert.equal(s.ore.find((o) => o.voce === '09').n, 1);
  assert.equal(s.codici.find((c) => c.voce === 'ROSSO').invio, 3, 'codici per scheda');
  assert.equal(s.codici.find((c) => c.voce === 'ROSSO').invioPct, 3 / 7, '% invio sulle schede');
  assert.equal(s.kpi.rossiInvioPct, 43);
});

test('senza interventi multipli niente cambia: schede = totali e le percentuali di prima', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual([s.riepilogo.totali, s.riepilogo.schede, s.riepilogo.multipli, s.riepilogo.pazientiMultipli], [5, 5, 0, 0]);
});
```

In `tests/domande.test.js` (`MULTI` importata dalla fixture, `esegui` è l'aiuto già presente nel file):

```js
test('domande: una missione con due pazienti vale un intervento, la base resta sulle schede', () => {
  const ris = esegui({ gruppi: [] }, TUTTO, MULTI);
  assert.equal(ris.righe[0].valore, 6);
  assert.equal(ris.base, 7);
});
```

- [ ] **Step 2: Run** `node --test tests/statistiche.test.js tests/domande.test.js` → FAIL.
- [ ] **Step 3: Implement** in `js/core/statistiche.js` e `js/core/domande.js`. Le percentuali dei KPI restano arrotondate come oggi.
- [ ] **Step 4: Run** `npm test` → PASS, compreso `tests/excel.test.js` sui dati reali. Resta valido perché il caso reale non è collegato finché l'utente non sceglie "Stesso intervento", quindi conta due righe come l'Excel.
- [ ] **Step 5: Commit** `git commit -m "Statistiche: un'uscita vale un intervento, pazienti per scheda, righe sugli interventi multipli"`

---

### Task 5: Statistiche di volo: tempo una volta per missione, manovre sommate

**Files:**
- Modify: `js/core/volo.js`
- Test: `tests/volo.test.js`

**Interfaces:**
- Consumes: `unaPerMissione`, `gruppiMissione` da `./pazienti.js`.
- Produces: `calcolaStatisticheVolo` lavora su `missioni = unaPerMissione(schede elicottero del periodo)`; per ogni missione `manovreDi(m)` = concatenazione delle `manovre` di tutte le schede del suo gruppo presenti nella selezione (con ripetizioni). `kpi.missioni`, `basi.missioni`, `tempo`, `mezzi[].n`, `tipi`, `mesi[].missioni/minutiVolo` dalla prima scheda; `manovre.voci[].n` = somma delle occorrenze del codice su tutte le schede; `almenoUna/piuDiUna/nessuna` e `mesi[].conManovre` sul `manovreDi` della missione; `conManovre` del KPI idem.

- [ ] **Step 1: Write the failing test** in `tests/volo.test.js`, con l'`r` del file:

```js
const DUE_PAZIENTI = [
  r({ id: 'p1', data: '2026-05-01', oraAllert: '09:00', missione: '99ZZ0500', pazienti: 2, mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 40, manovre: ['VD'] }),
  r({ id: 'p2', createdAt: '2026-01-01T00:05:00.000Z', data: '2026-05-01', oraAllert: '09:00', missione: '99ZZ0500', pazienti: 2, mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 40, manovre: ['VD', 'VS'] }),
];

test('intervento con due pazienti in elicottero: tempo una volta, manovre sommate', () => {
  const s = calcolaStatisticheVolo(DUE_PAZIENTI, LISTE_PREDEFINITE, TUTTO);
  assert.equal(s.kpi.missioni, 1);
  assert.equal(s.tempo.totaleMinuti, 40);
  assert.deepEqual(s.manovre.voci.filter((m) => m.n).map((m) => [m.codice, m.n]), [['VD', 2], ['VS', 1]]);
  assert.deepEqual([s.manovre.almenoUna.n, s.manovre.piuDiUna.n, s.manovre.nessuna.n], [1, 1, 0]);
  assert.equal(s.mesi.find((m) => m.chiave === '2026-05').conManovre, 1);
});
```

- [ ] **Step 2: Run** `node --test tests/volo.test.js` → FAIL.
- [ ] **Step 3: Implement** in `js/core/volo.js`.
- [ ] **Step 4: Run** `node --test tests/volo.test.js tests/volo-excel.test.js tests/hems.test.js` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Statistiche di volo: tempo una volta per missione, manovre sommate per scheda"`

---

### Task 6: Elenco (etichetta e conteggio) e unione tra dispositivi

**Files:**
- Modify: `js/core/elenco.js`, `js/core/merge.js`
- Test: `tests/elenco.test.js`, `tests/merge.test.js`

**Interfaces:**
- Consumes: `unaPerMissione`, `isCollegato`, `chiaveMissione` da `./pazienti.js`; `indiceMissioni` (Task 2).
- Produces (in `js/core/elenco.js`): `etichettaPaziente(r, indice): string` → `'Paziente n di N'` se il gruppo di `r` è collegato (`n` = posizione 1-based nell'ordine del gruppo, `N` = `pazienti` della prima scheda, `'?'` se non valido), altrimenti `''`; `conteggioInterventi(records): { interventi, schede }` con `interventi = unaPerMissione(records).length`.
- Produces (in `js/core/merge.js`): `riepilogo.duplicatiMissione` esclude i gruppi collegati (`isCollegato` sul gruppo risultante).

- [ ] **Step 1: Write the failing tests**

`tests/elenco.test.js`:

```js
import { indiceMissioni } from '../js/core/controlli.js'; // in testa al file, con etichettaPaziente e conteggioInterventi da elenco.js

test('etichetta "Paziente n di N" solo nei gruppi collegati, nell\'ordine della prima scheda', () => {
  const g = [r({ id: 'b', createdAt: '2026-01-01T10:05:00.000Z', missione: '99ZZ0001', pazienti: 3 }), r({ id: 'a', missione: '99ZZ0001', pazienti: 3 }), r({ id: 'c', missione: '99ZZ0002' })];
  const indice = indiceMissioni(g);
  assert.deepEqual(g.map((x) => etichettaPaziente(x, indice)), ['Paziente 2 di 3', 'Paziente 1 di 3', '']);
  const dup = [r({ id: 'a', missione: '99ZZ0001' }), r({ id: 'b', missione: '99ZZ0001' })];
  assert.equal(etichettaPaziente(dup[0], indiceMissioni(dup)), '');
  assert.deepEqual(conteggioInterventi(g), { interventi: 2, schede: 3 });
});
```

`tests/merge.test.js`:

```js
test('stessa MISSIONE in un gruppo collegato: non è un duplicato da segnalare', () => {
  const prima = rec('1', PRIMA, { pazienti: 2 });
  const seconda = rec('2', DOPO1, { missione: prima.missione, pazienti: null, createdAt: DOPO1 }); // salvata sull'altro dispositivo prima dell'unione
  const esito = unisci([prima], [seconda], SYNC);
  assert.deepEqual(esito.riepilogo.duplicatiMissione, []);
  const senzaSpunta = unisci([rec('1', PRIMA)], [rec('2', DOPO1, { missione: rec('1', PRIMA).missione })], SYNC);
  assert.equal(senzaSpunta.riepilogo.duplicatiMissione.length, 1, 'senza spunta resta segnalato');
});
```

- [ ] **Step 2: Run** `node --test tests/elenco.test.js tests/merge.test.js` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Paziente multiplo: etichetta nell'elenco, conteggio per missione, unione senza falsi duplicati"`

---

### Task 7: Modulo di inserimento: interruttore, numero, riquadro verde, blocchi, "Aggiungi paziente"

**Files:**
- Modify: `js/ui/inserimento.js`, `js/ui/dom.js`, `js/stato.js`, `js/app.js` (rotta `#/nuovo/<id>`), `css/app.css`
- Test: nessun test unitario (DOM); prove end-to-end nel Task 10

**Interfaces:**
- Consumes: `collegaScheda`, `nuovaSchedaPaziente`, `prontoPerSalvare` con `nuovo` (Task 3); `verificaSalvataggio` con `collegataA` e `bloccata` (Task 2); `propagaPazienti`, `primaScheda`, `schedeDi`, `isMultiplo` (Task 1).
- Produces (in `js/ui/dom.js`): `messaggioDuplicato(missione, dup, id, { nota = null, link = 'Apri il duplicato' })` (il riquadro rosso di oggi, condiviso con la foto tablet) e `messaggioCollegata(prima)` → `div.messaggio.collegata` con il testo `Collegata all'intervento del ${dataBreve(prima.data)}, ${prima.comune}: paziente multiplo (${prima.pazienti} pazienti)` (senza data: "Collegata all'intervento"; senza comune: senza la virgola) e il link `Apri la prima scheda` a `#/intervento/<prima.id>`.
- Produces (in `js/stato.js`): `salvaIntervento(r, { bozza, altri = [] })` scrive `r` e `altri` nella stessa transazione e li sostituisce in memoria.
- Produces (in `js/app.js`): `#/nuovo/<id>` → `inserimento.mostraNuovo(main, id)`.
- Produces (in `js/ui/inserimento.js`):
  - `mostraNuovo(main, daId = null)`: con `daId` e scheda trovata con la spunta → record da `nuovaSchedaPaziente(primaScheda(stato.record, scheda.missione) ?? scheda, crypto.randomUUID(), new Date())` (i campi condivisi vengono dalla prima scheda); se esiste una bozza (`stato.meta.bozza`) prima chiede `conferma({ titolo: 'Sostituire la bozza?', testo: 'La scheda del nuovo paziente prende il posto dei dati non salvati.', si: 'Sostituisci', pericolo: true })`; su "no" torna a `#/intervento/<daId>`;
  - sezione Identificazione: dopo la riga MISSIONE / Ora allert., `label.interruttore` "Paziente multiplo" (`input type=checkbox`, `data-campo="pazienti"`); accendere → `cambia('pazienti', 2)`; spegnere → `cambia('pazienti', null)`; l'interruttore è acceso quando `r.pazienti !== null && r.pazienti !== undefined`, anche con il numero cancellato (`''`); sotto, `campoNumerico('pazienti', 'Numero pazienti')` visibile solo con la spunta;
  - all'apertura del modulo e a ogni `cambia` e `daFoto` il record passa da `collegaScheda(r, stato.record, collegataA)`, che aggiorna `collegataA`; con `collegataA` interruttore e numero `disabled`, sotto il campo MISSIONE compare `messaggioCollegata(trova(collegataA))`;
  - prima scheda con altre collegate (`verificaSalvataggio(...).bloccata > 0`): interruttore `disabled`, input MISSIONE `readonly`, nota `Collegata a 1 altra scheda` / `Collegata a N altre schede` accanto all'interruttore;
  - riquadro rosso: `messaggioDuplicato` con `nota = v.errori[1]`;
  - al salvataggio `prontoPerSalvare(r, adesso, { nuovo: !modifica })`; in modifica di una prima scheda con la spunta `altri = propagaPazienti(daSalvare, stato.record, adesso)`, anche quando la spunta si accende sulla prima scheda di un duplicato (tutte le schede del gruppo si collegano, come dice l'errore rosso); dopo il salvataggio di una scheda aperta da `#/nuovo/<id>`, `history.replaceState(null, '', '#/nuovo')`;
  - dettaglio (modifica) con `isMultiplo(r)`: pulsante `Aggiungi paziente` (`a.bottone` → `#/nuovo/<r.id>`) nella barra delle azioni, prima di "Salva modifiche".
- CSS: `.messaggio.collegata { background: var(--ok-fondo); color: var(--ok-testo); }` con i due token definiti in `:root` e nel tema scuro accanto a `--avviso-*` (verde coerente con `codice VERDE`); `.interruttore` esiste già.

- [ ] **Step 1: Implement** tutto quanto sopra.
- [ ] **Step 2: Verify in the browser** (`preview_start` con il server di sviluppo, dati `tests/fixtures/demo.json` importati): salvare una scheda con la spunta e 2 pazienti; in Nuovo intervento scrivere la stessa MISSIONE → riquadro verde, spunta e numero bloccati; cambiare la MISSIONE → riquadro sparito, spunta spenta; salvare la seconda scheda; aprire la prima → MISSIONE readonly, nota "Collegata a 1 altra scheda", pulsante "Aggiungi paziente"; cambiare il numero a 3 e salvare → la seconda scheda ha 3; cancellare il numero → la spunta resta accesa e il salvataggio si blocca. Nessun errore in console.
- [ ] **Step 3: Run** `npm test` → PASS (nessun test unitario tocca la UI).
- [ ] **Step 4: Commit** `git commit -m "Modulo: Paziente multiplo, scheda collegata con riquadro verde, Aggiungi paziente"`

---

### Task 8: Foto tablet, elenco, statistiche e volo: le parti di interfaccia restanti

**Files:**
- Modify: `js/ui/fototablet.js`, `js/ui/elenco.js`, `js/ui/statistiche.js`, `js/ui/volo.js`
- Test: prove end-to-end nel Task 10

**Interfaces:**
- Consumes: `messaggioDuplicato`, `messaggioCollegata` (Task 7); `etichettaPaziente`, `conteggioInterventi` (Task 6); `riepilogo.schede/multipli/pazientiMultipli`, `kpi.multipli` (Task 4).
- Produces:
  - `fototablet.js`: `duplicato(missione)` usa `verificaSalvataggio({ id: null, missione }, stato.record)`: con `collegataA` → `messaggioCollegata(trova(collegataA))`; con `duplicatoDi` → `messaggioDuplicato(..., { nota: v.errori[1], link: 'Apri' })` (oggi il link si chiama "Apri": resta);
  - `elenco.js`: `riga` aggiunge `etichettaPaziente(r, indice)` in testa a `dettagli`; il riepilogo dice `N interventi` e, se `schede !== interventi`, `N interventi · M schede` (con `conteggioInterventi(tutti)`; il "di" con i filtri resta sugli interventi);
  - `statistiche.js`: tabella 1 con le righe `{ voce: 'Interventi con più pazienti', v: conteggio(r.multipli), p: '' }` e `{ voce: 'Pazienti negli interventi multipli', v: conteggio(r.pazientiMultipli), p: '' }` dopo "Pazienti valutati"; KPI "Interventi" con sottotitolo `${valutati} valutati · ${multipli} con più pazienti` quando `multipli > 0`; note dove la base è cambiata (solo testo): tabella 1 `% annullati: sulle schede · India, Mike: sugli interventi · le altre: sui valutati.`, tabelle 2, 4 e 5 `% invio sulle schede · % rientro sui pazienti valutati.`, tabella 6 `% sulle schede.`, KPI "Avvisi da controllare" `… delle schede`; le tabelle 8, 9 e 10 restano sugli interventi;
  - `volo.js`: nota di V4 `% sulle missioni in elicottero. Le manovre di tutte le schede di una missione si sommano.`

- [ ] **Step 1: Implement**.
- [ ] **Step 2: Verify in the browser**: elenco con "Paziente 1 di 2" / "2 di 2" sulle due schede del Task 7 e riepilogo "N interventi · M schede"; statistiche con "Interventi con più pazienti: 1"; foto tablet (`tests/fixtures/tablet-finto.html` legge 99ZZ0042): con 99ZZ0042 salvata con la spunta → riquadro verde nel pannello della foto.
- [ ] **Step 3: Commit** `git commit -m "Paziente multiplo: foto tablet, elenco, statistiche e volo"`

---

### Task 9: Impostazioni: decidere i duplicati, scollegare, promemoria

**Files:**
- Modify: `js/ui/impostazioni.js`, `js/stato.js`, `js/app.js`, `js/core/pazienti.js` (funzioni di elenco), `css/app.css` se serve
- Test: `tests/pazienti.test.js`; prove end-to-end nel Task 10

**Interfaces:**
- Produces (in `js/core/pazienti.js`):
  - `gruppiDaDecidere(records, refusi: string[]): { missione, schede }[]` = gruppi con ≥ 2 schede non collegati e chiave non in `refusi`, ordinati per chiave;
  - `gruppiCollegati(records): { missione, schede }[]` = gruppi collegati con ≥ 1 scheda, ordinati per chiave;
- Produces (in `js/stato.js`), con `meta.refusiMissione: string[]` e `meta.decisioniPazienti: { missione, scelta: 'stesso intervento' | 'refuso' | 'scollegato', schede: number, quando: ISO }[]`:
  - `collegaMissione(missione, adesso)`: `collegaGruppo(schedeDi(stato.record, missione), adesso)` salvati in una transazione, decisione aggiunta a `decisioniPazienti`, chiave tolta da `refusiMissione`;
  - `segnaRefuso(missione, adesso)`: chiave aggiunta a `refusiMissione`, decisione registrata; nessun record cambia;
  - `scollegaMissione(missione, adesso)`: `scollegaGruppo(...)` salvato, decisione registrata.
  - `refusiMissione` e `decisioniPazienti` restano sul dispositivo, come la parola d'ordine: non entrano nel backup. Sull'altro dispositivo un gruppo segnato "Refuso" resta da decidere finché la MISSIONE non viene corretta; "Stesso intervento" e "Scollega" cambiano i record e viaggiano con loro.
- Produces (in `js/ui/impostazioni.js`): sezione `<section class="blocco" id="missioni-ripetute">` intitolata `Stessa missione registrata più volte` tra "Backup e passaggio dei dati" e "Liste dei menu": testo `Schede diverse con la stessa MISSIONE. Se sono pazienti dello stesso intervento, collegale: contano come un intervento. Se è un refuso, correggi la MISSIONE dalla scheda.`; per ogni gruppo da decidere una riga `MISSIONE · N schede` (link al filtro dell'elenco come nel riepilogo import) con i pulsanti `Stesso intervento` e `Refuso`; sotto, `Collegati` con una riga per gruppo collegato (`MISSIONE · N schede, M pazienti`) e il pulsante `Scollega` (con `conferma({ titolo: 'Scollegare le schede di MISSIONE?', testo: 'Tornano schede separate con l\'avviso "Missione duplicata".', si: 'Scollega' })`); in fondo `Decisioni prese` (ultime 20 di `decisioniPazienti`, dalla più recente, `GG/MM/AAAA HH:MM · MISSIONE · scelta`). Con niente da mostrare la sezione dice `Nessuna missione registrata più volte.`
- Produces (in `js/app.js`): `aggiornaPromemoria` mostra, oltre al promemoria del backup, `N missioni registrate più volte: decidi se sono pazienti multipli` (`1 missione registrata più volte: …` al singolare) con il pulsante `Vai alle Impostazioni` quando `gruppiDaDecidere(stato.record, stato.meta.refusiMissione ?? []).length > 0` e la schermata non è Impostazioni.

- [ ] **Step 1: Write the failing tests** in `tests/pazienti.test.js`

```js
test('gruppi da decidere: duplicati non collegati e non segnati refuso; gruppi collegati a parte', () => {
  const r = [rec('1'), rec('2', { createdAt: T1 }), rec('a', { missione: '99ZZ0002' }), rec('b', { missione: '99ZZ0002', createdAt: T1 }),
    rec('c', { missione: '99ZZ0003', pazienti: 2 }), rec('d', { missione: '99ZZ0003', pazienti: 2, createdAt: T1 }), rec('s', { missione: '99ZZ0004' })];
  assert.deepEqual(gruppiDaDecidere(r, ['99ZZ0002']).map((g) => [g.missione, g.schede.length]), [['99ZZ0001', 2]]);
  assert.deepEqual(gruppiCollegati(r).map((g) => [g.missione, g.schede.map((s) => s.id)]), [['99ZZ0003', ['c', 'd']]]);
});
```

- [ ] **Step 2: Run** `node --test tests/pazienti.test.js` → FAIL.
- [ ] **Step 3: Implement** le due funzioni, le tre operazioni in `stato.js`, la sezione e il promemoria.
- [ ] **Step 4: Verify in the browser** con `demo.json` (ha un duplicato: le schede `demo-0007` e `demo-0008` hanno entrambe la missione `DEMO0007`): promemoria in cima, sezione con 1 gruppo; "Stesso intervento" → gruppo tra i collegati, avviso sparito dall'elenco, statistiche con 1 intervento in meno; "Scollega" → torna da decidere; "Refuso" → sparisce dall'elenco e dal promemoria, avviso ancora nell'elenco.
- [ ] **Step 5: Run** `npm test` → PASS.
- [ ] **Step 6: Commit** `git commit -m "Impostazioni: decidere le missioni registrate più volte, scollegare, promemoria"`

---

### Task 10: Prove end-to-end e screenshot

**Files:**
- Modify: `tests/e2e/app.e2e.mjs`, `docs/screenshots/` (rigenerati dalla corsa WebKit)
- Test: `npm run e2e`

**Interfaces:**
- Consumes: tutta la UI dei Task 7–9.
- Produces: nessuna interfaccia. La demo non cambia: le prove esistenti si aspettano "Interventi = righe della demo" (KPI delle statistiche, `conteggioElenco`, che legge il numero "N interventi" in cima all'elenco). Per questo il gruppo collegato nasce dentro la prova, e le prove nuove vanno in fondo al blocco per viewport: nessun conteggio esistente cambia.

- [ ] **Step 1: Write the end-to-end tests** nel blocco per viewport di `tests/e2e/app.e2e.mjs`, dopo `volo: sezione solo per gli elicotteri, tipo, tempo e manovre salvati` e prima di `describe('foto tablet')`:

```js
test('paziente multiplo: prima scheda con la spunta, seconda scheda collegata, numero propagato', async () => {
  await nuovoIntervento(page, { missione: 'E2E00002', comune: 'biella' });
  await page.getByLabel('Paziente multiplo').check();
  await page.getByLabel('Numero pazienti').fill('');
  assert.ok(await page.getByLabel('Paziente multiplo').isChecked(), 'numero cancellato: la spunta resta');
  await page.getByRole('button', { name: 'Salva intervento' }).click();
  await attendiTesto(page.locator('#toast'), 'Scrivi il numero di pazienti');
  await page.getByLabel('Numero pazienti').fill('2');
  await page.getByRole('button', { name: 'Salva intervento' }).click();
  await attendiTesto(page.locator('#toast'), 'E2E00002 salvato');
  await page.getByLabel(/^Missione/).fill('E2E00002');
  await attendiTesto(page.locator('.messaggio.collegata'), 'BIELLA: paziente multiplo (2 pazienti)');
  if (foto) await scattaSchermata(page, `${vp.nome}-paziente-multiplo`);
  assert.ok(await page.getByLabel('Paziente multiplo').isChecked() && await page.getByLabel('Paziente multiplo').isDisabled());
  await page.getByLabel('Età').fill('30');
  await page.getByRole('button', { name: 'Salva intervento' }).click();
  await attendiTesto(page.locator('#toast'), 'E2E00002 salvato');
  await vai(page, '#/elenco');
  await page.getByLabel('Cerca per missione o comune').fill('E2E00002');
  await attendiTesto(page.locator('.righe'), 'Paziente 1 di 2');
  await attendiTesto(page.locator('.righe'), 'Paziente 2 di 2');
  await page.getByRole('link', { name: /Paziente 1 di 2/ }).click();
  assert.equal(await page.getByLabel(/^Missione/).getAttribute('readonly'), '', 'prima scheda: MISSIONE bloccata');
  await attendiTesto(page.locator('.modulo'), 'Collegata a 1 altra scheda');
  await page.getByLabel('Numero pazienti').fill('3');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await attendiTesto(page.locator('.righe'), 'Paziente 2 di 3');
  await page.getByRole('link', { name: /Paziente 2 di 3/ }).click();
  await page.getByRole('link', { name: 'Aggiungi paziente' }).click();
  assert.equal(await page.getByLabel(/^Missione/).inputValue(), 'E2E00002');
  assert.equal(await page.getByLabel('Comune', { exact: true }).inputValue(), 'BIELLA');
  assert.equal(await page.getByLabel('Età').inputValue(), '');
  await page.getByRole('button', { name: 'Salva intervento' }).click();
  await attendiTesto(page.locator('#toast'), 'E2E00002 salvato');
  await vai(page, '#/statistiche');
  await page.getByRole('button', { name: 'Tutto', exact: true }).click();
  await attendiTesto(page.locator('.kpi'), '1 con più pazienti');
});

test('missioni registrate più volte: Stesso intervento e Scollega dalle Impostazioni', async () => {
  await vai(page, '#/impostazioni');
  const sezione = page.locator('#missioni-ripetute'); // il riepilogo dell'import usa lo stesso titolo
  await attendiTesto(sezione, 'DEMO0007');
  await sezione.getByRole('button', { name: 'Stesso intervento' }).first().click();
  await attendiTesto(sezione, '2 schede, 2 pazienti');
  await vai(page, '#/elenco');
  await page.getByLabel('Cerca per missione o comune').fill('DEMO0007');
  await attendiTesto(page.locator('.righe'), 'Paziente 1 di 2');
  await vai(page, '#/impostazioni');
  await sezione.getByRole('button', { name: 'Scollega' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Scollega' }).click();
  await attendiTesto(sezione, 'Stesso intervento');
  await sezione.getByRole('button', { name: 'Refuso' }).first().click();
  await attendiTesto(sezione, 'DEMO0007 · refuso');
  assert.equal(await sezione.getByRole('button', { name: 'Stesso intervento' }).count(), 0, 'nessun gruppo da decidere');
});
```

Nel blocco `describe('foto tablet')`, dopo `foto tablet: la missione già salvata si segnala subito`:

```js
test('foto tablet: con la spunta sulla scheda salvata la missione si collega', async () => {
  await vai(page, '#/elenco');
  await page.getByLabel('Cerca per missione o comune').fill('99ZZ0042');
  await page.getByRole('link', { name: /99ZZ0042/ }).click();
  await page.getByLabel('Paziente multiplo').check();
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await attendiTesto(page.locator('#banda h1'), 'Elenco');
  await vai(page, '#/nuovo');
  await daFoto(page, await fotoFinta(ctx));
  await attendiTesto(riquadro(), 'paziente multiplo (2 pazienti)');
  assert.equal(await riquadro().locator('.messaggio.errore').count(), 0, 'niente errore rosso');
  await svuota(page);
  // la scheda torna singola per le prove che seguono
  await vai(page, '#/elenco');
  await page.getByRole('link', { name: /99ZZ0042/ }).click();
  await page.getByLabel('Paziente multiplo').uncheck();
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await attendiTesto(page.locator('#banda h1'), 'Elenco');
  await page.getByLabel('Cerca per missione o comune').fill('');
});
```

- [ ] **Step 2: Run** `npm run e2e` → PASS su chromium e webkit, con i conteggi delle prove esistenti invariati.
- [ ] **Step 3: Screenshot**: la corsa WebKit li scatta da sola (`foto`). Controllare `docs/screenshots/{1440,390}-paziente-multiplo.png` (riquadro verde) e che le altre schermate rigenerate mostrino solo dati inventati.
- [ ] **Step 4: Commit** `git commit -m "Prove end-to-end e screenshot del paziente multiplo"`

---

### Task 11: Versione 1.5.0, README e memoria di progetto

**Files:**
- Modify: `js/app.js`, `sw.js`, `js/ui/impostazioni.js` (Informazioni), `tests/pwa.test.js`, `README.md`
- Test: `tests/pwa.test.js`, `tests/sw.test.js`

**Interfaces:** nessuna.

- [ ] **Step 1: Update the version test** in `tests/pwa.test.js` a `1.5.0` → `node --test tests/pwa.test.js` → FAIL.
- [ ] **Step 2: Implement**: versione in `js/app.js`, `sw.js`, Informazioni (da 1.4.5 a 1.5.0); README:
  - la foto girata della 1.4.5 è già documentata (sezione "Foto del tablet"): lasciarla;
  - sezione nuova `## Interventi con più pazienti` (dopo "Tipologia India/Mike"): come si attiva, cosa eredita la seconda scheda, "Aggiungi paziente", cosa è bloccato sulla prima scheda, come si scioglie, la sezione delle Impostazioni ("Refuso" vale solo sul dispositivo dove lo scegli), il promemoria, la colonna PAZIENTI;
  - `### Cosa succede all'import`: la voce "Stessa missione registrata più volte" rimanda alla sezione delle Impostazioni;
  - `## Come sono calcolate le statistiche`: "Interventi totali: missioni distinte tra i gruppi collegati …", "Pazienti valutati: schede − …", le basi delle percentuali, le due righe nuove, il volo;
  - elenco dei controlli con i cinque avvisi nuovi;
  - indice e "Struttura del progetto" (`js/core/pazienti.js`).
- [ ] **Step 3: Run** `npm test` e `npm run e2e` → PASS.
- [ ] **Step 4: Commit** `git commit -m "Paziente multiplo: documentazione e versione 1.5.0"`
- [ ] **Step 5: Memoria di progetto**: aggiornare `stato-progetto-app-118.md` (1.5.0 pronta sul branch `paziente-multiplo`, non unita, non pubblicata) e `decisioni-paziente-multiplo.md` (esiste già con le decisioni: aggiungere che il codice è scritto e dove).

---

## Fuori dal piano

- Unione in `main`, pubblicazione (`npm run pubblica`, dry-run e controllo 404 come da memoria) e push su GitHub: solo su richiesta esplicita dell'utente, con l'indirizzo mostrato prima.
- `tools/attese_statistiche.py` non cambia: l'Excel conta per riga e l'app coincide finché il caso reale non viene collegato dall'utente. Dopo quella scelta il confronto con i dati reali va letto sapendo che differisce di un intervento.
