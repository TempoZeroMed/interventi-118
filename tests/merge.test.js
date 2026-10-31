import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unisci, unisciListe, leggiBackup, creaBackup, nomeFileBackup, nomeFileDatato, promemoriaBackup } from '../js/core/merge.js';

const SYNC = '2026-10-20T00:00:00.000Z';
const PRIMA = '2026-10-10T00:00:00.000Z';   // prima dell'ultima sincronizzazione
const DOPO1 = '2026-10-21T00:00:00.000Z';   // dopo
const DOPO2 = '2026-10-22T00:00:00.000Z';
const DOPO3 = '2026-10-23T00:00:00.000Z';

const rec = (id, updatedAt, campi = {}) => ({
  id, createdAt: PRIMA, updatedAt, deleted: false, data: '2026-10-01', oraAllert: '10:00', missione: `04AA${id.padStart(4, '0')}`,
  pazienti: null,
  comune: 'BIELLA', mezzo: '3030', tipologia: 'Mike', codiceInvio: 'GIALLO', patologiaInvio: '', luogoInvio: '', eta: 50,
  sesso: '', esito: '', ospedale: '', codiceRientro: '', patologiaRientro: '', luogoRientro: '', liberoOperativo: '',
  tipoMissione: '', tempoVolo: null, manovre: [],
  ...campi,
});
const perId = (elenco) => Object.fromEntries(elenco.map((r) => [r.id, r]));
const conteggi = ({ riepilogo: { nuovi, aggiornati, invariati, eliminati } }) => ({ nuovi, aggiornati, invariati, eliminati });

test('record nuovi vengono aggiunti', () => {
  const esito = unisci([rec('1', PRIMA)], [rec('2', PRIMA), rec('3', PRIMA)], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 2, aggiornati: 0, invariati: 0, eliminati: 0 });
  assert.deepEqual(esito.record.map((r) => r.id).sort(), ['1', '2', '3']);
});

test('record identico: invariato', () => {
  const esito = unisci([rec('1', PRIMA)], [rec('1', PRIMA)], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 0, invariati: 1, eliminati: 0 });
});

test('un record locale assente dal file importato resta (nessuna cancellazione per assenza)', () => {
  const esito = unisci([rec('1', PRIMA), rec('2', PRIMA)], [rec('1', PRIMA)], SYNC);
  assert.deepEqual(esito.record.map((r) => r.id).sort(), ['1', '2']);
});

test('vince l\'updatedAt più recente: versione importata più nuova', () => {
  const esito = unisci([rec('1', PRIMA)], [rec('1', DOPO1, { comune: 'CANDELO' })], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 1, invariati: 0, eliminati: 0 });
  assert.equal(perId(esito.record)['1'].comune, 'CANDELO');
  assert.deepEqual(esito.riepilogo.conflitti, []);
});

test('vince l\'updatedAt più recente: versione locale più nuova resta', () => {
  const esito = unisci([rec('1', DOPO1, { comune: 'CANDELO' })], [rec('1', PRIMA)], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 0, invariati: 1, eliminati: 0 });
  assert.equal(perId(esito.record)['1'].comune, 'CANDELO');
  assert.deepEqual(esito.riepilogo.conflitti, []);
});

test('conflitto: stesso record modificato su entrambi i dispositivi dopo l\'ultima sincronizzazione, vince l\'importato', () => {
  const esito = unisci([rec('1', DOPO1, { comune: 'CANDELO' })], [rec('1', DOPO2, { comune: 'MONGRANDO' })], SYNC);
  assert.equal(perId(esito.record)['1'].comune, 'MONGRANDO');
  assert.equal(esito.riepilogo.aggiornati, 1);
  assert.deepEqual(esito.riepilogo.conflitti.map(({ id, vincitore }) => ({ id, vincitore })), [{ id: '1', vincitore: 'importato' }]);
});

test('conflitto: stesso record modificato su entrambi, vince il locale più recente', () => {
  const esito = unisci([rec('1', DOPO3, { comune: 'CANDELO' })], [rec('1', DOPO2, { comune: 'MONGRANDO' })], SYNC);
  assert.equal(perId(esito.record)['1'].comune, 'CANDELO');
  assert.deepEqual(esito.riepilogo.conflitti.map(({ id, vincitore }) => ({ id, vincitore })), [{ id: '1', vincitore: 'locale' }]);
});

test('senza una sincronizzazione precedente ogni differenza sullo stesso record è un conflitto', () => {
  const esito = unisci([rec('1', PRIMA)], [rec('1', DOPO1, { comune: 'CANDELO' })], null);
  assert.equal(esito.riepilogo.conflitti.length, 1);
});

test('stesso updatedAt ma contenuto diverso: conflitto risolto allo stesso modo su entrambi i dispositivi', () => {
  const a = rec('1', DOPO1, { comune: 'CANDELO' });
  const b = rec('1', DOPO1, { comune: 'MONGRANDO' });
  const suMac = unisci([a], [b], SYNC);
  const suIphone = unisci([b], [a], SYNC);
  assert.equal(suMac.riepilogo.conflitti.length, 1);
  assert.deepEqual(suMac.record, suIphone.record);
});

test('eliminazione logica propagata: il record diventa eliminato', () => {
  const esito = unisci([rec('1', PRIMA)], [rec('1', DOPO1, { deleted: true })], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 1, invariati: 0, eliminati: 1 });
  assert.equal(perId(esito.record)['1'].deleted, true);
});

test('eliminazione locale più recente di una modifica importata: resta eliminato', () => {
  const esito = unisci([rec('1', DOPO2, { deleted: true })], [rec('1', DOPO1, { comune: 'CANDELO' })], SYNC);
  assert.equal(perId(esito.record)['1'].deleted, true);
  assert.equal(esito.riepilogo.conflitti.length, 1);
});

test('eliminazione di un record mai visto: conservata come eliminata, non conta come nuovo', () => {
  const esito = unisci([], [rec('9', DOPO1, { deleted: true })], SYNC);
  assert.equal(esito.riepilogo.nuovi, 0);
  assert.equal(perId(esito.record)['9'].deleted, true);
});

test('stessa MISSIONE con id diversi: entrambi restano e vengono segnalati', () => {
  const locale = rec('1', PRIMA, { missione: '99ZZ7329' });
  const importato = rec('2', DOPO1, { missione: '99ZZ7329' });
  const esito = unisci([locale], [importato], SYNC);
  assert.equal(esito.record.length, 2);
  assert.deepEqual(esito.riepilogo.duplicatiMissione, [{ missione: '99ZZ7329', ids: ['1', '2'] }]);
});

test('unire due archivi in un ordine o nell\'altro dà lo stesso risultato', () => {
  const mac = [rec('1', DOPO1, { comune: 'A' }), rec('2', PRIMA), rec('3', DOPO2, { deleted: true }), rec('5', DOPO1, { comune: 'X' })];
  const iphone = [rec('1', DOPO2, { comune: 'B' }), rec('3', DOPO1), rec('4', PRIMA), rec('5', DOPO1, { comune: 'Y' })];
  const ordina = (elenco) => [...elenco].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(ordina(unisci(mac, iphone, SYNC).record), ordina(unisci(iphone, mac, SYNC).record));
});

test('liste: voci nuove aggiunte, rinomina più recente vince, modifica locale più recente resta', () => {
  const locali = {
    ospedale: [
      { id: 'ospedale-biella', voce: 'Biella', attiva: true, sistema: false, updatedAt: PRIMA },
      { id: 'ospedale-asti', voce: 'Asti', attiva: false, sistema: false, updatedAt: DOPO2 },
    ],
  };
  const entranti = {
    ospedale: [
      { id: 'ospedale-biella', voce: 'Biella Ponderano', attiva: true, sistema: false, updatedAt: DOPO1 },
      { id: 'ospedale-asti', voce: 'Asti', attiva: true, sistema: false, updatedAt: DOPO1 },
      { id: 'ospedale-nuovo', voce: 'Aosta', attiva: true, sistema: false, updatedAt: DOPO1 },
    ],
  };
  const { liste } = unisciListe(locali, entranti);
  assert.deepEqual(liste.ospedale.map(({ voce, attiva }) => [voce, attiva]), [
    ['Biella Ponderano', true], ['Asti', false], ['Aosta', true],
  ]);
});

test('lettura backup: rifiuta file non validi con un messaggio comprensibile', () => {
  assert.throws(() => leggiBackup('non è json'), /non è un file JSON valido/);
  assert.throws(() => leggiBackup('{"formato":"altro","versione":1,"record":[]}'), /non è un backup di Interventi 118/);
  assert.throws(() => leggiBackup('{"formato":"interventi118","versione":4,"record":[]}'), /versione più recente/);
  assert.throws(() => leggiBackup('{"formato":"interventi118","versione":0,"record":[]}'), /non riconosciuta/);
  assert.deepEqual(leggiBackup('{"formato":"interventi118","versione":1,"record":[]}').record, [], 'i backup v1 si leggono ancora');
  assert.throws(() => leggiBackup('{"formato":"interventi118","versione":1,"record":[{"data":"2026-01-01"}]}'), /senza id/);
});

test('lettura backup: normalizza i record e completa i campi mancanti', () => {
  const testo = JSON.stringify({
    formato: 'interventi118', versione: 1, esportatoIl: DOPO1, dispositivo: 'iphone',
    record: [{ id: 'x', createdAt: PRIMA, updatedAt: PRIMA, comune: ' biella ', eta: '45' }],
  });
  const b = leggiBackup(testo);
  assert.equal(b.record[0].comune, 'BIELLA');
  assert.equal(b.record[0].eta, 45);
  assert.equal(b.record[0].ospedale, '');
  assert.equal(b.record[0].deleted, false);
  assert.equal(b.liste, null);
});

test('backup creato e riletto: stessi record e stesse liste', () => {
  const record = [rec('1', PRIMA), rec('2', DOPO1, { deleted: true })];
  const liste = { sesso: [{ id: 'sesso-maschio', voce: 'Maschio', attiva: true, sistema: true, updatedAt: PRIMA }] };
  const backup = creaBackup({ record, liste, dispositivo: 'mac', adesso: new Date(DOPO2) });
  assert.equal(backup.esportatoIl, DOPO2);
  const riletto = leggiBackup(JSON.stringify(backup));
  assert.deepEqual(riletto.record, record);
  assert.deepEqual(riletto.liste, liste);
});

test('nome fisso del file di backup per dispositivo', () => {
  assert.equal(nomeFileBackup('iPhone'), 'interventi118_iPhone.json');
  assert.equal(nomeFileBackup('Mac'), 'interventi118_Mac.json');
  assert.equal(nomeFileBackup('Mac', 'xlsx'), 'interventi118_Mac.xlsx');
});

test('nome della copia con data e ora locali', () => {
  assert.equal(nomeFileDatato(new Date(2026, 9, 25, 9, 5)), 'interventi118_2026-10-25_0905.json');
  assert.equal(nomeFileDatato(new Date(2026, 0, 3, 23, 59)), 'interventi118_2026-01-03_2359.json');
});

test('promemoria backup: nessuno con un backup recente e poche modifiche', () => {
  const adesso = new Date('2026-10-29T12:00:00.000Z');
  assert.equal(promemoriaBackup({ ultimoBackup: '2026-10-25T12:00:00.000Z', modificheNonEsportate: 10, numeroInterventi: 212 }, adesso), null);
  assert.equal(promemoriaBackup({ ultimoBackup: '2026-10-22T12:00:00.000Z', modificheNonEsportate: 0, numeroInterventi: 212 }, adesso), null, 'esattamente 7 giorni');
});

test('promemoria backup: ultimo backup più vecchio di 7 giorni', () => {
  const p = promemoriaBackup({ ultimoBackup: '2026-10-20T12:00:00.000Z', modificheNonEsportate: 0, numeroInterventi: 212 }, new Date('2026-10-29T12:00:00.000Z'));
  assert.match(p.messaggio, /9 giorni/);
});

test('promemoria backup: più di 10 modifiche non esportate', () => {
  const p = promemoriaBackup({ ultimoBackup: '2026-10-28T12:00:00.000Z', modificheNonEsportate: 11, numeroInterventi: 212 }, new Date('2026-10-29T12:00:00.000Z'));
  assert.match(p.messaggio, /11 modifiche/);
});

test('promemoria backup: mai fatto, solo se ci sono interventi', () => {
  const adesso = new Date('2026-10-29T12:00:00.000Z');
  assert.match(promemoriaBackup({ ultimoBackup: null, modificheNonEsportate: 0, numeroInterventi: 3 }, adesso).messaggio, /Nessun backup/);
  assert.equal(promemoriaBackup({ ultimoBackup: null, modificheNonEsportate: 0, numeroInterventi: 0 }, adesso), null);
});

test('record v1 senza campi di volo e stesso record v2 con campi vuoti: invariato, nessun conflitto', () => {
  const v1 = rec('1', PRIMA);
  delete v1.tipoMissione; delete v1.tempoVolo; delete v1.manovre;
  const v2 = { ...rec('1', DOPO1), tipoMissione: '', tempoVolo: null, manovre: [] };
  const { riepilogo } = unisci([v1], [v2], null);
  assert.deepEqual([riepilogo.aggiornati, riepilogo.invariati, riepilogo.conflitti.length], [0, 1, 0]);
});

test('i dati di volo viaggiano nel backup e vincono se più recenti', () => {
  const locale = rec('1', PRIMA, { mezzo: 'V-ECHO' });
  const importato = rec('1', DOPO1, { mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 44, manovre: ['HD'] });
  const backup = leggiBackup(JSON.stringify(creaBackup({ record: [importato], liste: null, dispositivo: 'mac', adesso: new Date(DOPO2) })));
  assert.equal(JSON.parse(JSON.stringify(creaBackup({ record: [], liste: null, dispositivo: 'mac' }))).versione, 3);
  const { record } = unisci([locale], backup.record, PRIMA);
  assert.deepEqual([record[0].tipoMissione, record[0].tempoVolo, record[0].manovre], ['HEMS', 44, ['HD']]);
});

test('backup v3: si scrive 3, si leggono 1, 2 e 3; record v2 senza pazienti e stesso record v3 con null: invariato', () => {
  assert.equal(creaBackup({ record: [], liste: {}, dispositivo: 'x' }).versione, 3);
  const v2 = { ...rec('1', PRIMA) };
  delete v2.pazienti;
  const esito = unisci([rec('1', PRIMA, { pazienti: null })], [v2], SYNC);
  assert.deepEqual(conteggi(esito), { nuovi: 0, aggiornati: 0, invariati: 1, eliminati: 0 });
  assert.deepEqual(leggiBackup(JSON.stringify({ formato: 'interventi118', versione: 2, record: [v2] })).record[0].pazienti, null);
  assert.throws(() => leggiBackup(JSON.stringify({ formato: 'interventi118', versione: 4, record: [] })), /più recente/);
});

test('stessa MISSIONE in un gruppo collegato: non è un duplicato da segnalare', () => {
  const prima = rec('1', PRIMA, { pazienti: 2 });
  const seconda = rec('2', DOPO1, { missione: prima.missione, pazienti: null, createdAt: DOPO1 }); // salvata sull'altro dispositivo prima dell'unione
  const esito = unisci([prima], [seconda], SYNC);
  assert.deepEqual(esito.riepilogo.duplicatiMissione, []);
  const senzaSpunta = unisci([rec('1', PRIMA)], [rec('2', DOPO1, { missione: rec('1', PRIMA).missione })], SYNC);
  assert.equal(senzaSpunta.riepilogo.duplicatiMissione.length, 1, 'senza spunta resta segnalato');
});
