// Coerenza con l'Excel sui 212 interventi reali. I dati restano in data/ (escluso da git):
// senza quei file i test vengono saltati, con il motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaStatistiche } from '../js/core/statistiche.js';
import { TIPI_AVVISO_VOLO, TIPI_AVVISO_PAZIENTI } from '../js/core/controlli.js';
import { isElicottero } from '../js/core/campi.js';
import { unisci, leggiBackup } from '../js/core/merge.js';
import { IMPORT, ATTESE, leggiJson, differenze, motivoSkip } from './aiuti.js';

// I record passano dalla stessa lettura dell'import nell'app (normalizzazione compresa).
const importati = () => leggiBackup(JSON.stringify(leggiJson(IMPORT)));

/** Gli avvisi di volo e dei pazienti multipli non esistono nell'Excel 118: per il confronto i voli contano come completi. */
function statistiche118(record, liste, periodo) {
  const completi = record.map((r) => (isElicottero(r.mezzo) ? { ...r, tipoMissione: 'HEMS', tempoVolo: 0 } : r));
  const s = calcolaStatistiche(completi, liste, periodo);
  s.controlli.perTipo = s.controlli.perTipo.filter((t) => !TIPI_AVVISO_VOLO.includes(t.voce) && !TIPI_AVVISO_PAZIENTI.includes(t.voce));
  return s;
}

test('le statistiche sui 212 interventi coincidono con il foglio "Statistiche"', { skip: motivoSkip }, () => {
  const { record, liste } = importati();
  assert.equal(record.length, 212);
  const diff = differenze(statistiche118(record, liste, { tipo: 'tutto' }), leggiJson(ATTESE));
  assert.deepEqual(diff, [], `${diff.length} valori diversi dall'Excel:\n${diff.slice(0, 30).join('\n')}`);
});

test('tutti i 212 interventi sono del 2026: l\'anno 2026 dà gli stessi numeri di "tutto"', { skip: motivoSkip }, () => {
  const { record, liste } = importati();
  const diff = differenze(statistiche118(record, liste, { tipo: 'anno', anno: 2026 }), leggiJson(ATTESE));
  assert.deepEqual(diff, []);
});

test('import del JSON dell\'Excel in un archivio vuoto: 212 nuovi; reimport: 212 invariati, nessun doppione', { skip: motivoSkip }, () => {
  const backup = leggiBackup(JSON.stringify(leggiJson(IMPORT)));
  const primo = unisci([], backup.record, null);
  assert.equal(primo.riepilogo.nuovi, 212);
  assert.equal(primo.record.length, 212);
  const secondo = unisci(primo.record, backup.record, '2026-10-29T10:00:00.000Z');
  assert.deepEqual(
    { nuovi: secondo.riepilogo.nuovi, aggiornati: secondo.riepilogo.aggiornati, invariati: secondo.riepilogo.invariati },
    { nuovi: 0, aggiornati: 0, invariati: 212 },
  );
  assert.equal(secondo.record.length, 212);
});
