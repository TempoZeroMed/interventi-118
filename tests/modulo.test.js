import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordVuoto, impostaCampo, copiaDaInvio, oraLocale, dataLocale, prontoPerSalvare } from '../js/core/modulo.js';

const ADESSO = new Date(2026, 9, 29, 7, 5); // 29 ottobre 2026, 07:05 ora locale

test('nuovo intervento: DATA di oggi, tutto il resto vuoto', () => {
  const r = recordVuoto('id-1', ADESSO);
  assert.equal(r.id, 'id-1');
  assert.equal(r.data, '2026-10-29');
  assert.equal(r.oraAllert, '');
  assert.equal(r.eta, null);
  assert.equal(r.deleted, false);
  assert.equal(r.createdAt, ADESSO.toISOString());
});

test('"adesso" e data di oggi in ora locale', () => {
  assert.equal(oraLocale(ADESSO), '07:05');
  assert.equal(dataLocale(new Date(2026, 0, 3, 23, 59)), '2026-01-03');
});

test('mezzi 3040, 5022, 5024 impostano la TIPOLOGIA su India', () => {
  const base = { ...recordVuoto('x', ADESSO), tipologia: 'Mike' };
  assert.equal(impostaCampo(base, 'mezzo', '5022').tipologia, 'India');
  assert.equal(impostaCampo(base, 'mezzo', '3030').tipologia, 'Mike');
});

test('COMUNE e MISSIONE diventano maiuscoli mentre si scrive', () => {
  const r = recordVuoto('x', ADESSO);
  assert.equal(impostaCampo(r, 'comune', 'cavaglià').comune, 'CAVAGLIÀ');
  assert.equal(impostaCampo(r, 'missione', '99zz 0101').missione, '99ZZ0101');
});

test('cambiare ESITO da Trasportato svuota l\'OSPEDALE, che resta nascosto', () => {
  const trasportato = { ...recordVuoto('x', ADESSO), esito: 'Trasportato', ospedale: 'Biella' };
  assert.equal(impostaCampo(trasportato, 'esito', 'Rifiuto Trasporto').ospedale, '');
  assert.equal(impostaCampo(trasportato, 'esito', 'Trasportato').ospedale, 'Biella');
});

test('ETÀ: numero, oppure null se vuota', () => {
  const r = recordVuoto('x', ADESSO);
  assert.equal(impostaCampo(r, 'eta', '87').eta, 87);
  assert.equal(impostaCampo(r, 'eta', '').eta, null);
});

test('"copia da invio" riporta codice, patologia e luogo nel rientro', () => {
  const r = { ...recordVuoto('x', ADESSO), codiceInvio: 'ROSSO', patologiaInvio: '04 - Neuro', luogoInvio: 'K - Casa', codiceRientro: 'VERDE' };
  const c = copiaDaInvio(r);
  assert.deepEqual([c.codiceRientro, c.patologiaRientro, c.luogoRientro], ['ROSSO', '04 - Neuro', 'K - Casa']);
});

test('salvataggio: record normalizzato con updatedAt aggiornato e createdAt invariato', () => {
  const r = { ...recordVuoto('x', ADESSO), comune: ' biella ' };
  const dopo = new Date('2026-10-29T08:00:00.000Z');
  const s = prontoPerSalvare(r, dopo);
  assert.equal(s.comune, 'BIELLA');
  assert.equal(s.updatedAt, '2026-10-29T08:00:00.000Z');
  assert.equal(s.createdAt, ADESSO.toISOString());
});
