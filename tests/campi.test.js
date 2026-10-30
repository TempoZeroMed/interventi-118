import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isDataValida, isOraValida, normalizzaRecord, LISTE_PREDEFINITE } from '../js/core/campi.js';

const IMPORT = new URL('../data/interventi_import.json', import.meta.url);

test('date valide solo nel formato AAAA-MM-GG e reali', () => {
  assert.equal(isDataValida('2026-01-01'), true);
  assert.equal(isDataValida('2028-02-29'), true);
  assert.equal(isDataValida('2026-02-29'), false);
  assert.equal(isDataValida('2026-1-1'), false);
  assert.equal(isDataValida('01/01/2026'), false);
  assert.equal(isDataValida(''), false);
});

test('ore valide solo nel formato hh:mm', () => {
  assert.equal(isOraValida('00:00'), true);
  assert.equal(isOraValida('23:59'), true);
  assert.equal(isOraValida('24:00'), false);
  assert.equal(isOraValida('9:05'), false);
  assert.equal(isOraValida('19.05'), false);
  assert.equal(isOraValida(''), false);
});

test('normalizzazione: COMUNE e MISSIONE in maiuscolo, spazi tolti', () => {
  const r = normalizzaRecord({ id: 'a', comune: '  cavaglià ', missione: ' 99zz0101', patologiaInvio: ' 02 - Cardio ' });
  assert.equal(r.comune, 'CAVAGLIÀ');
  assert.equal(r.missione, '99ZZ0101');
  assert.equal(r.patologiaInvio, '02 - Cardio');
});

test('normalizzazione: età da testo a numero, vuota a null, testo non numerico conservato', () => {
  assert.equal(normalizzaRecord({ id: 'a', eta: ' 45 ' }).eta, 45);
  assert.equal(normalizzaRecord({ id: 'a', eta: '0.5' }).eta, 0.5);
  assert.equal(normalizzaRecord({ id: 'a', eta: '' }).eta, null);
  assert.equal(normalizzaRecord({ id: 'a', eta: 'dodici' }).eta, 'dodici');
});

test('normalizzazione: i campi mancanti diventano vuoti', () => {
  const r = normalizzaRecord({ id: 'a', data: '2026-01-01' });
  assert.equal(r.ospedale, '');
  assert.equal(r.liberoOperativo, '');
  assert.equal(r.eta, null);
  assert.equal(r.deleted, false);
});

test('le liste predefinite dell\'app sono quelle del foglio "Liste"', { skip: !existsSync(IMPORT) && 'manca data/interventi_import.json: esegui tools/xlsx_to_json.py' }, () => {
  const daExcel = JSON.parse(readFileSync(IMPORT, 'utf8')).liste;
  const semplifica = (liste) => Object.fromEntries(
    Object.entries(liste).map(([nome, voci]) => [nome, voci.map(({ id, voce, attiva, sistema }) => ({ id, voce, attiva, sistema }))]),
  );
  assert.deepEqual(semplifica(LISTE_PREDEFINITE), semplifica(daExcel));
});

test('le voci di sistema includono quelle che reggono formule e controlli', () => {
  const sistema = (nome) => LISTE_PREDEFINITE[nome].filter((v) => v.sistema).map((v) => v.voce);
  assert.deepEqual(sistema('esito'), ['Trasportato', 'Deceduto', 'Annullato da CO', 'Non Raggiungibile']);
  assert.deepEqual(sistema('codiceRientro'), ['VERDE', 'GIALLO', 'ROSSO', 'NERO']);
  assert.deepEqual(sistema('mezzo'), ['3040', '5022', '5024']);
  assert.deepEqual(sistema('ospedale'), []);
});
