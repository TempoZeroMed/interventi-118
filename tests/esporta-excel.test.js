import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { righeExcel, dataSeriale, frazioneOra, creaCartellaExcel } from '../js/core/excel.js';

// SheetJS dalla copia in vendor/, caricata come nel browser (script classico che crea XLSX).
const contesto = vm.createContext({});
vm.runInContext(readFileSync(new URL('../vendor/xlsx-0.20.3.full.min.js', import.meta.url), 'utf8'), contesto);
const XLSX = contesto.XLSX;

const VUOTO = {
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
  data: '', oraAllert: '', missione: '', comune: '', mezzo: '', tipologia: '', codiceInvio: '', patologiaInvio: '',
  luogoInvio: '', eta: null, sesso: '', esito: '', ospedale: '', codiceRientro: '', patologiaRientro: '',
  luogoRientro: '', liberoOperativo: '',
};
const r = (campi) => ({ ...VUOTO, ...campi });
const RECORD = [
  r({ id: 'b', data: '2026-01-02', oraAllert: '23:50', missione: '04AA0200', comune: 'BIELLA', mezzo: 'V-ECHO', tipologia: 'Mike',
    codiceInvio: 'ROSSO', codiceRientro: 'NERO', esito: 'Deceduto', eta: 90, sesso: 'Femmina', liberoOperativo: '00:20' }),
  r({ id: 'a', data: '2026-01-01', oraAllert: '10:12', missione: '99ZZ0101', comune: 'COSSATO', mezzo: '3080', tipologia: 'Mike',
    codiceInvio: 'GIALLO', patologiaInvio: '02 - Cardio', luogoInvio: 'K - Casa', eta: 72, sesso: 'Femmina', esito: 'Non Necessita',
    codiceRientro: 'VERDE', patologiaRientro: '02 - Cardio', luogoRientro: 'K - Casa', liberoOperativo: '10:51' }),
  r({ id: 'c', data: '2026-01-03', missione: '99ZE', comune: 'NOVARA', ospedale: 'Novara', esito: 'Rifiuto Trasporto' }),
  r({ id: 'x', data: '2026-01-04', missione: '04AA0999', deleted: true }),
];

test('date e ore nei numeri seriali di Excel', () => {
  assert.equal(dataSeriale('2026-01-01'), 46023);
  assert.equal(dataSeriale('1900-03-01'), 61);
  assert.equal(frazioneOra('10:12'), 612 / 1440);
  assert.equal(frazioneOra('00:00'), 0);
});

test('righe come nel foglio "Interventi": due intestazioni, poi in ordine cronologico, senza eliminati, celle vuote a null', () => {
  const righe = righeExcel(RECORD);
  assert.equal(righe[0][0], 'IDENTIFICAZIONE');
  assert.deepEqual(righe[1], [
    '#', 'DATA', 'ORA ALLERT.', 'MISSIONE', 'COMUNE', 'MEZZO', 'TIPOLOGIA', 'CODICE', 'PATOLOGIA', 'LUOGO', 'ETÀ', 'SESSO',
    'ESITO', 'OSPEDALE', 'CODICE', 'PATOLOGIA', 'LUOGO', 'LIBERO OPERATIVO', 'TIPO MISSIONE', 'TEMPO VOLO (min)',
    'HD', 'VD', 'HS', 'VS', 'VSP', 'VSB', 'DURATA (min)', 'MESE', 'ORA DEL GIORNO', 'Δ CODICE', 'CONTROLLI',
  ]);
  assert.equal(righe[0][18], 'VOLO');
  assert.equal(righe[0][26], 'CALCOLATE – non scrivere');
  assert.equal(righe.length, 5);
  assert.deepEqual(righe[2], [
    1, 46023, 612 / 1440, '99ZZ0101', 'COSSATO', 3080, 'Mike', 'GIALLO', '02 - Cardio', 'K - Casa', 72, 'Femmina',
    'Non Necessita', null, 'VERDE', '02 - Cardio', 'K - Casa', 651 / 1440, null, null, null, null, null, null, null, null,
    39, 1, 10, -1, null,
  ]);
  assert.equal(righe[3][5], 'V-ECHO', 'i mezzi non numerici restano testo');
  assert.equal(righe[3][26], 30, 'durata a cavallo della mezzanotte');
  assert.equal(righe[3][29], null, 'Δ vuoto con rientro NERO');
  assert.equal(righe[4][30], 'Missione non di 8 caratteri; Ospedale senza trasporto;', 'CONTROLLI come la formula Excel');
});

test('colonne VOLO: tipo, tempo e una X per ogni manovra; vuote per le ambulanze', () => {
  const righe = righeExcel([
    r({ id: 'e', data: '2026-02-01', missione: '99ZZ0301', mezzo: 'V-ECHO', tipoMissione: 'HSR', tempoVolo: 75, manovre: ['VD', 'VSP'] }),
    r({ id: 'f', data: '2026-02-02', missione: '99ZZ0302', mezzo: '3030' }),
  ]);
  assert.deepEqual(righe[2].slice(18, 26), ['HSR', 75, null, 'X', null, null, 'X', null]);
  assert.deepEqual(righe[3].slice(18, 26), [null, null, null, null, null, null, null, null]);
});

test('il file .xlsx creato con SheetJS ha intestazioni unite, formati data/ora e mezzi numerici', () => {
  const buffer = XLSX.write(creaCartellaExcel(XLSX, RECORD), { type: 'buffer', bookType: 'xlsx' });
  const cartella = XLSX.read(buffer, { cellNF: true });
  assert.deepEqual(Array.from(cartella.SheetNames), ['Interventi']);
  const foglio = cartella.Sheets.Interventi;
  assert.equal(foglio.A1.v, 'IDENTIFICAZIONE');
  assert.equal(foglio['!merges'].length, 9);
  assert.equal(foglio.B3.v, 46023);
  assert.equal(foglio.B3.z, 'dd/mm/yyyy');
  assert.equal(foglio.C3.z, 'hh:mm');
  assert.equal(foglio.F3.t, 'n');
  assert.equal(foglio.D3.v, '99ZZ0101');
});

test('il file esportato si rilegge con tools/xlsx_to_json.py e restituisce gli stessi interventi', (t) => {
  const python = spawnSync('python3', ['--version']);
  if (python.status !== 0) {
    t.skip('python3 non disponibile');
    return;
  }
  const cartellaTmp = mkdtempSync(join(tmpdir(), 'i118-'));
  try {
    const xlsx = join(cartellaTmp, 'export.xlsx');
    const json = join(cartellaTmp, 'export.json');
    writeFileSync(xlsx, XLSX.write(creaCartellaExcel(XLSX, RECORD), { type: 'buffer', bookType: 'xlsx' }));
    const esito = spawnSync('python3', [new URL('../tools/xlsx_to_json.py', import.meta.url).pathname, xlsx, json], { encoding: 'utf8' });
    assert.equal(esito.status, 0, esito.stderr);
    const riletti = JSON.parse(readFileSync(json, 'utf8')).record;
    const campi = (x) => {
      const { id, createdAt, updatedAt, deleted, tipoMissione, tempoVolo, manovre, ...resto } = x;
      return resto;
    };
    const attesi = RECORD.filter((x) => !x.deleted).sort((x, y) => x.data.localeCompare(y.data)).map(campi);
    assert.deepEqual(riletti.map(campi), attesi);
  } finally {
    rmSync(cartellaTmp, { recursive: true, force: true });
  }
});
