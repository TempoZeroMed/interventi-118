import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaQuery, normalizzaTesto, comuniDistinti, estraiJson, eseguiQuery, descriviPeriodo } from '../js/core/domande.js';
import { LISTE_PREDEFINITE } from '../js/core/campi.js';
import { RECORD, r } from './fixtures/record-domande.js';

const MINIMA = {
  tipo: 'query', interpretazione: 'Interventi per ora', misura: 'interventi', gruppi: ['ora'], filtri: [],
  periodo: null, confronto: null, ordine: 'max', primi: 1,
};
const con = (campi) => ({ ...MINIMA, ...campi });

// ---------------------------------------------------------------- validazione

test('validaQuery accetta la query minima', () => {
  assert.deepEqual(validaQuery(MINIMA), { ok: true, query: MINIMA });
});

test('validaQuery completa i campi facoltativi mancanti', () => {
  const esito = validaQuery({ tipo: 'query', interpretazione: 'Interventi totali', misura: 'interventi' });
  assert.equal(esito.ok, true);
  assert.deepEqual(esito.query, {
    tipo: 'query', interpretazione: 'Interventi totali', misura: 'interventi', gruppi: [], filtri: [],
    periodo: null, confronto: null, ordine: 'max', primi: null,
  });
});

test('validaQuery accetta filtri, periodi e confronti ben formati', () => {
  for (const q of [
    con({ filtri: [{ campo: 'eta', op: '>=', valore: 80 }, { campo: 'esito', op: 'in', valore: ['Trasportato', 'Deceduto'] }] }),
    con({ filtri: [{ campo: 'comune', op: '=', valore: 'Biella' }, { campo: 'giornoSettimana', op: '=', valore: 'Sab' }] }),
    con({ periodo: { tipo: 'mese', anno: 2026, mese: 7 } }),
    con({ periodo: { tipo: 'intervallo', da: '2026-01-01', a: '2026-03-31' } }),
    con({ periodo: { tipo: 'intervallo', da: '2026-03-01', a: null } }),
    con({ periodo: { tipo: 'tutto' } }),
    con({ gruppi: [], confronto: { periodoA: { tipo: 'anno', anno: 2025 }, periodoB: { tipo: 'anno', anno: 2026 } } }),
    con({ gruppi: ['codiceInvio', 'mezzo'], ordine: 'nessuno', primi: null }),
  ]) assert.equal(validaQuery(q).ok, true, JSON.stringify(q));
});

test('validaQuery rifiuta le query mal formate con un motivo', () => {
  for (const q of [
    con({ misura: 'velocita' }),
    con({ gruppi: ['ora', 'ora'] }),
    con({ gruppi: ['ora', 'mezzo', 'esito'] }),
    con({ gruppi: ['mezzo'], confronto: { periodoA: { tipo: 'tutto' }, periodoB: { tipo: 'tutto' } } }),
    con({ filtri: [{ campo: 'mezzo', op: '>', valore: 3000 }] }),
    con({ filtri: [{ campo: 'esito', op: 'in', valore: [] }] }),
    con({ filtri: [{ campo: 'colore', op: '=', valore: 'ROSSO' }] }),
    con({ periodo: { tipo: 'mese', anno: 2026, mese: 13 } }),
    con({ periodo: { tipo: 'intervallo', da: '2026-02-30', a: '' } }),
    con({ primi: 0 }),
    con({ ordine: 'alto' }),
    con({ interpretazione: '' }),
    con({ foo: 1 }),
    null,
    'query',
  ]) {
    const esito = validaQuery(q);
    assert.equal(esito.ok, false, JSON.stringify(q));
    assert.ok(esito.motivo, `motivo per ${JSON.stringify(q)}`);
  }
});

test('validaQuery accetta controdomanda e rifiuto con tre esempi', () => {
  assert.equal(validaQuery({ tipo: 'controdomanda', testo: 'Intendi l\'ora di allertamento?' }).ok, true);
  assert.equal(validaQuery({ tipo: 'rifiuto', testo: 'Non posso.', esempi: ['a', 'b', 'c'] }).ok, true);
  assert.equal(validaQuery({ tipo: 'rifiuto', testo: 'Non posso.', esempi: ['a', 'b'] }).ok, false);
  assert.equal(validaQuery({ tipo: 'controdomanda', testo: '' }).ok, false);
  assert.equal(validaQuery({ tipo: 'altro' }).ok, false);
});

// ---------------------------------------------------------------- testo e comuni

test('normalizzaTesto: minuscole, senza accenti né apostrofi, spazi compressi', () => {
  assert.equal(normalizzaTesto('  Ciriè '), 'cirie');
  assert.equal(normalizzaTesto("CIRIE'"), 'cirie');
  assert.equal(normalizzaTesto('San   Germano  Vercellese'), 'san germano vercellese');
  assert.equal(normalizzaTesto(null), '');
});

test('comuniDistinti: una grafia per comune, senza vuoti ed eliminati', () => {
  assert.deepEqual(comuniDistinti([{ comune: 'Biella' }, { comune: 'BIELLA' }, { comune: '' }, { comune: 'Ciriè', deleted: true }]), ['Biella']);
  assert.deepEqual(comuniDistinti([{ comune: 'Novara' }, { comune: 'ciriè' }, { comune: 'CIRIE' }]), ['ciriè', 'Novara']);
});

test('estraiJson: il primo oggetto JSON nel testo', () => {
  assert.deepEqual(estraiJson('Ecco: {"a":1} fine'), { a: 1 });
  assert.deepEqual(estraiJson('```json\n{"a":{"b":"}"}}\n```'), { a: { b: '}' } });
  assert.equal(estraiJson('niente'), null);
  assert.equal(estraiJson('{rotto'), null);
});

// ---------------------------------------------------------------- esecuzione sul dispositivo

const TUTTO = { tipo: 'tutto' };
const ANNO_2026 = { tipo: 'anno', anno: 2026 };
const esegui = (campi, periodoPagina = TUTTO, records = RECORD) => eseguiQuery(records, LISTE_PREDEFINITE, con(campi), periodoPagina);

test('interventi per ora: a parità vince l\'ora più bassa, la classifica ha tutte le 24 ore', () => {
  const primo = esegui({});
  assert.equal(primo.base, 5);
  assert.equal(primo.righe.length, 1);
  assert.deepEqual(primo.righe[0].chiavi, ['08']);
  assert.deepEqual(primo.righe[0].etichette, ['Ore 08']);
  assert.equal(primo.righe[0].valore, 1);
  assert.equal(primo.evidenziata, 0);
  assert.equal(primo.descrizionePeriodo, 'Tutto l\'archivio');
  const tutte = esegui({ primi: null });
  assert.equal(tutte.righe.length, 24);
  assert.equal(tutte.righe.filter((riga) => riga.valore === 1).length, 5);
});

test('giorno con più interventi: le righe senza data restano fuori', () => {
  const ris = esegui({ gruppi: ['giorno'], primi: null });
  assert.deepEqual(ris.righe[0].chiavi, ['2026-01-10']);
  assert.equal(ris.righe[0].etichette[0], '10/01/2026');
  assert.equal(ris.righe.length, 4);
  assert.ok(!ris.righe.some((riga) => riga.chiavi[0] === '—'));
});

test('giorno senza ordine: le righe senza data finiscono in "Senza data"', () => {
  const ris = esegui({ gruppi: ['giorno'], ordine: 'nessuno', primi: null });
  const ultima = ris.righe.at(-1);
  assert.deepEqual(ultima.chiavi, ['—']);
  assert.deepEqual(ultima.etichette, ['Senza data']);
  assert.equal(ultima.valore, 1);
  assert.equal(ris.evidenziata, null);
});

test('il periodo nominato nella domanda batte quello della pagina', () => {
  const ris = esegui({ gruppi: [], periodo: { tipo: 'anno', anno: 2027 } }, ANNO_2026);
  assert.equal(ris.base, 1);
  assert.equal(ris.descrizionePeriodo, 'Anno 2027');
  assert.deepEqual(ris.periodo, { tipo: 'anno', anno: 2027 });
  const pagina = esegui({ gruppi: [] }, ANNO_2026);
  assert.equal(pagina.base, 3);
  assert.equal(pagina.descrizionePeriodo, 'Anno 2026');
});

test('durata media per mezzo, anche oltre la mezzanotte; le medie vuote in fondo', () => {
  const ris = esegui({ misura: 'durataMedia', gruppi: ['mezzo'], primi: null });
  assert.deepEqual(ris.righe.map((riga) => [riga.chiavi[0], riga.valore, riga.n]), [['5022', 40, 1], ['3030', 38, 3], ['3040', null, 1]]);
});

test('filtro sul comune con grafie diverse', () => {
  const conComune = [...RECORD, r({ id: 'r8', data: '2026-03-01', missione: '04AA0008', comune: 'Ciriè' })];
  for (const valore of ['cirie', 'CIRIE\'', 'Ciriè']) {
    assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'comune', op: '=', valore }] }, TUTTO, conComune).base, 1, valore);
  }
  const perComune = esegui({ gruppi: ['comune'], primi: null }, TUTTO, [...conComune, r({ id: 'r9', missione: '04AA0009', comune: 'CIRIE' })]);
  assert.deepEqual(perComune.righe.map((riga) => [riga.etichette[0], riga.valore]), [['Ciriè', 2]]);
});

test('filtri numerici e "in"', () => {
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'eta', op: '>=', valore: 70 }] }).base, 2);
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'durata', op: '<', valore: 41 }] }).base, 2);
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'esito', op: 'in', valore: ['Trasportato', 'Deceduto'] }] }).base, 2);
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'esito', op: '!=', valore: 'Trasportato' }] }).base, 4);
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'ora', op: '=', valore: 23 }] }).base, 1);
  assert.equal(esegui({ gruppi: [], filtri: [{ campo: 'giornoSettimana', op: '=', valore: 'Sab' }] }).base, 1, '10/01/2026 è sabato');
});

test('due gruppi: codice di invio per mezzo', () => {
  const ris = esegui({ gruppi: ['codiceInvio', 'mezzo'], ordine: 'nessuno', primi: null });
  assert.ok(ris.colonne.includes('3030'));
  assert.deepEqual(ris.colonne, ['3030', '3040', '5022'], 'nell\'ordine della lista dei mezzi');
  const giallo = ris.righe.find((riga) => riga.chiavi[0] === 'GIALLO');
  assert.equal(giallo.celle['3030'], 2);
  assert.equal(giallo.celle['3040'], 1);
  assert.equal(giallo.celle['5022'], 0);
  assert.equal(giallo.valore, 3);
  assert.deepEqual(ris.righe.map((riga) => riga.chiavi[0]), ['VERDE', 'GIALLO', 'ROSSO']);
});

test('confronto tra due anni', () => {
  const ris = esegui({ gruppi: [], confronto: { periodoA: { tipo: 'anno', anno: 2026 }, periodoB: { tipo: 'anno', anno: 2027 } } });
  assert.deepEqual(ris.righe, []);
  assert.equal(ris.confronto.a.valore, 3);
  assert.equal(ris.confronto.a.descrizionePeriodo, 'Anno 2026');
  assert.equal(ris.confronto.b.valore, 1);
  assert.equal(ris.confronto.differenza, -2);
  assert.ok(Math.abs(ris.confronto.variazionePct - -66.7) < 0.1);
});

test('misure su un gruppo vuoto: conteggi a zero, medie e mediane vuote', () => {
  const ris = esegui({ misura: 'etaMediana', gruppi: [], filtri: [{ campo: 'mezzo', op: '=', valore: '7045' }] });
  assert.equal(ris.righe[0].valore, null);
  assert.equal(ris.righe[0].n, 0);
  assert.equal(esegui({ misura: 'trasportati', gruppi: [], filtri: [{ campo: 'mezzo', op: '=', valore: '7045' }] }).righe[0].valore, 0);
});

test('altre misure: valutati, trasportati, percentuali, età', () => {
  assert.equal(esegui({ misura: 'valutati', gruppi: [] }).righe[0].valore, 4);
  assert.equal(esegui({ misura: 'trasportati', gruppi: [] }).righe[0].valore, 1);
  assert.equal(esegui({ misura: 'etaMedia', gruppi: [] }).righe[0].valore, 48);
  const sesso = esegui({ misura: 'pctValutati', gruppi: ['sesso'], primi: null });
  assert.deepEqual(sesso.righe.map((riga) => [riga.chiavi[0], riga.valore]), [['Maschio', 0.75], ['Femmina', 0.5]]);
  const fasce = esegui({ gruppi: ['fasciaEta'], ordine: 'nessuno', primi: null });
  assert.deepEqual(fasce.righe.map((riga) => riga.valore), [1, 1, 1, 1, 1]);
});

test('descrizione del periodo come nella banda delle Statistiche', () => {
  assert.equal(descriviPeriodo({ tipo: 'mese', anno: 2026, mese: 7 }), 'luglio 2026');
  assert.equal(descriviPeriodo({ tipo: 'anno', anno: 2026 }), 'Anno 2026');
  assert.equal(descriviPeriodo({ tipo: 'intervallo', da: '2026-01-01', a: '2026-03-31' }), 'Dal 01/01/2026 al 31/03/2026');
  assert.equal(descriviPeriodo({ tipo: 'tutto' }), 'Tutto l\'archivio');
});
