// Coerenza delle statistiche di volo con il foglio "Statistiche" dell'Excel HEMS. I dati reali restano in
// data/ (escluso da git): senza data/volo_attese.json il test viene saltato, con il motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { calcolaStatisticheVolo } from '../js/core/volo.js';
import { LISTE_PREDEFINITE, normalizzaRecord } from '../js/core/campi.js';
import { VOLO_ATTESE, leggiJson, differenze } from './aiuti.js';

const motivo = existsSync(VOLO_ATTESE) ? false : 'manca data/volo_attese.json: esegui tools/attese_volo.py';

/** Il foglio ha le righe solo di V-ECHO e T-ECHO: gli elicotteri arrivati dopo restano fuori dal confronto. */
const soloDelFoglio = (righe, attese) => righe.filter((m) => attese.some((a) => a.voce === m.voce));

test('le statistiche di volo coincidono con il foglio "Statistiche" dell\'Excel HEMS', { skip: motivo }, () => {
  const { record, attese } = leggiJson(VOLO_ATTESE);
  const s = calcolaStatisticheVolo(record.map(normalizzaRecord), LISTE_PREDEFINITE, { tipo: 'tutto' });
  s.mezzi = soloDelFoglio(s.mezzi, attese.mezzi);
  s.kpi.perMezzo = soloDelFoglio(s.kpi.perMezzo, attese.kpi.perMezzo);
  const diff = differenze(s, attese);
  assert.deepEqual(diff, [], `${diff.length} valori diversi dall'Excel HEMS:\n${diff.slice(0, 30).join('\n')}`);
});
