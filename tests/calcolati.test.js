import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durataMinuti, meseDa, oraDelGiorno, deltaCodice } from '../js/core/calcolati.js';

test('durata: minuti tra allertamento e libero operativo', () => {
  assert.equal(durataMinuti('08:58', '09:37'), 39);
  assert.equal(durataMinuti('10:00', '10:00'), 0);
});

test('durata a cavallo della mezzanotte (MOD 1440)', () => {
  assert.equal(durataMinuti('23:50', '00:20'), 30);
  assert.equal(durataMinuti('23:59', '00:00'), 1);
  assert.equal(durataMinuti('22:15', '01:05'), 170);
});

test('durata: libero operativo prima dell\'allertamento viene letto come giorno dopo, come in Excel', () => {
  assert.equal(durataMinuti('10:00', '09:50'), 1430);
});

test('durata vuota se manca o non è valida una delle due ore', () => {
  assert.equal(durataMinuti('', '09:37'), null);
  assert.equal(durataMinuti('08:58', ''), null);
  assert.equal(durataMinuti('8.58', '09:37'), null);
  assert.equal(durataMinuti('08:58', '24:00'), null);
});

test('mese dalla data', () => {
  assert.equal(meseDa('2026-03-15'), 3);
  assert.equal(meseDa('2026-12-31'), 12);
  assert.equal(meseDa(''), null);
  assert.equal(meseDa('2026-02-30'), null);
});

test('ora del giorno dall\'allertamento', () => {
  assert.equal(oraDelGiorno('08:58'), 8);
  assert.equal(oraDelGiorno('00:05'), 0);
  assert.equal(oraDelGiorno('23:59'), 23);
  assert.equal(oraDelGiorno(''), null);
  assert.equal(oraDelGiorno('24:00'), null);
});

test('Δ codice: posizione rientro − posizione invio su VERDE < GIALLO < ROSSO', () => {
  assert.equal(deltaCodice('GIALLO', 'ROSSO'), 1);
  assert.equal(deltaCodice('VERDE', 'ROSSO'), 2);
  assert.equal(deltaCodice('ROSSO', 'VERDE'), -2);
  assert.equal(deltaCodice('GIALLO', 'GIALLO'), 0);
});

test('Δ codice vuoto con rientro NERO o con un codice mancante', () => {
  assert.equal(deltaCodice('ROSSO', 'NERO'), null);
  assert.equal(deltaCodice('', 'VERDE'), null);
  assert.equal(deltaCodice('VERDE', ''), null);
});
