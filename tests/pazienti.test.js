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
