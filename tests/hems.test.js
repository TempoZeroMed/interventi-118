// tools/hems_to_json.py: completa con i dati di volo dell'Excel HEMS le missioni già presenti in un backup.
// Excel e backup sono inventati e creati al momento in una cartella temporanea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { dataSeriale, frazioneOra } from '../js/core/excel.js';
import { leggiBackup } from '../js/core/merge.js';

const contesto = vm.createContext({});
vm.runInContext(readFileSync(new URL('../vendor/xlsx-0.20.3.full.min.js', import.meta.url), 'utf8'), contesto);
const XLSX = contesto.XLSX;

const INTESTAZIONI = [
  '#', 'DATA', 'ORA', 'MISSIONE', 'COMUNE', 'MEZZO', 'TIPO MISSIONE', 'TIPOLOGIA', 'PRIORITÀ', 'PATOLOGIA', 'LUOGO', 'ETÀ',
  'SESSO', 'ESITO', 'OSPEDALE', 'PRIORITÀ', 'PATOLOGIA', 'LUOGO', 'LIBERO OPERATIVO', 'TEMPO VOLO (min)',
  'HD', 'VD', 'HS', 'VS', 'VSP', 'VSB',
];
const COLONNA = Object.fromEntries(['HD', 'VD', 'HS', 'VS', 'VSP', 'VSB'].map((m, i) => [m, 20 + i]));

/** Una riga del foglio "Voli" (colonne A–Z). */
function riga({ data = '2026-07-01', ora = '10:00', missione = null, comune = 'CITTÀ', mezzo = 'V-ECHO', tipo = null, tempo = null, manovre = {} }) {
  const r = new Array(26).fill(null);
  [r[1], r[2], r[3], r[4], r[5], r[6], r[19]] = [dataSeriale(data), frazioneOra(ora), missione, comune, mezzo, tipo, tempo];
  for (const [m, valore] of Object.entries(manovre)) r[COLONNA[m]] = valore;
  return r;
}

const BASE_ISTANTE = '2026-07-02T00:00:00.000Z';
const rec = (id, missione, campi = {}) => ({
  id, createdAt: BASE_ISTANTE, updatedAt: BASE_ISTANTE, deleted: false, data: '2026-07-01', oraAllert: '10:00',
  missione, comune: 'CITTÀ', mezzo: 'V-ECHO', ...campi,
});

test('hems_to_json.py completa i voli delle missioni trovate e elenca le altre', (t) => {
  if (spawnSync('python3', ['--version']).status !== 0) {
    t.skip('python3 non disponibile');
    return;
  }
  const cartella = mkdtempSync(join(tmpdir(), 'i118-hems-'));
  try {
    const foglio = XLSX.utils.aoa_to_sheet([
      [null, 'INVIO DALLA CO / PAZIENTE', ...new Array(18).fill(null), 'VOLO', 'MANOVRE'],
      INTESTAZIONI,
      riga({ missione: '99ZZ0001', tipo: 'HEMS', tempo: 44, manovre: { HD: 'X' } }),
      riga({ missione: '99ZZ0002', mezzo: 'T-ECHO', tipo: 'HSR', tempo: 30 }),
      riga({ tipo: 'HEMS' }),
      riga({ missione: '99ZZ0009', tipo: 'HEMS', tempo: 20 }),
      riga({ missione: '99ZZ0003', tipo: 'HEMS', tempo: 25 }),
      riga({ missione: '99ZZ0004', tipo: 'HSR', tempo: '45 min', manovre: { VSB: 'x', VD: 'X' } }),
      riga({ missione: '99ZZ0005', comune: 'ALFA', tipo: 'IFT', tempo: 60 }),
    ]);
    const cartellaExcel = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(cartellaExcel, foglio, 'Voli');
    const excel = join(cartella, 'hems.xlsx');
    writeFileSync(excel, XLSX.write(cartellaExcel, { type: 'buffer', bookType: 'xlsx' }));

    const base = join(cartella, 'base.json');
    const testoBase = JSON.stringify({
      formato: 'interventi118', versione: 1, esportatoIl: BASE_ISTANTE, dispositivo: 'iphone', liste: null,
      record: [
        rec('a', '99ZZ0001'),
        rec('b', '99ZZ0002', { mezzo: 'T-ECHO', tipoMissione: 'HSR', tempoVolo: 30, manovre: [] }),
        rec('c1', '99ZZ0003'), rec('c2', '99ZZ0003'),
        rec('d1', '99ZZ0004', { deleted: true }), rec('d2', '99ZZ0004'),
        rec('e', '99ZZ0005', { comune: 'BETA' }),
      ],
    });
    writeFileSync(base, testoBase);
    const uscita = join(cartella, 'voli.json');

    const esito = spawnSync('python3', [new URL('../tools/hems_to_json.py', import.meta.url).pathname, excel, '--base', base, '--uscita', uscita], { encoding: 'utf8' });
    assert.equal(esito.status, 0, esito.stderr);
    const testo = esito.stdout;
    for (const [n, atteso] of [[3, 'completata'], [4, 'già completa'], [5, 'senza codice missione'], [6, 'non trovata'],
      [7, 'trovata più volte'], [8, 'completata'], [9, 'completata']]) {
      assert.match(testo, new RegExp(`riga ${n}\\b[^\\n]*${atteso}`), `riga ${n}: ${atteso}`);
    }
    assert.match(testo, /differenze:[^\n]*comune/);

    const backup = leggiBackup(readFileSync(uscita, 'utf8'));
    const doc = JSON.parse(readFileSync(uscita, 'utf8'));
    assert.deepEqual([doc.versione, doc.dispositivo, doc.liste], [2, 'import-hems', null]);
    const perId = Object.fromEntries(backup.record.map((r) => [r.id, r]));
    assert.deepEqual(Object.keys(perId).sort(), ['a', 'd2', 'e']);
    assert.deepEqual([perId.a.tipoMissione, perId.a.tempoVolo, perId.a.manovre], ['HEMS', 44, ['HD']]);
    assert.ok(perId.a.updatedAt > BASE_ISTANTE);
    assert.match(perId.a.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepEqual([perId.d2.tipoMissione, perId.d2.tempoVolo, perId.d2.manovre], ['HSR', '45 min', ['VD', 'VSB']]);
    assert.deepEqual([perId.e.tipoMissione, perId.e.comune], ['IFT', 'BETA'], 'completa il volo senza toccare gli altri campi');
    assert.equal(readFileSync(base, 'utf8'), testoBase, 'il backup di partenza non cambia');
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
