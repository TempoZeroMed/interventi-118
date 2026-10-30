import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaQuery, normalizzaTesto, comuniDistinti, estraiJson } from '../js/core/domande.js';

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
