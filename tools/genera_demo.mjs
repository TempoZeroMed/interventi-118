#!/usr/bin/env node
// Crea un backup di DATI INVENTATI per prove e screenshot: nessun intervento reale.
// Uso: node tools/genera_demo.mjs [numero] [file]   (predefiniti: 90, tests/fixtures/demo.json)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { LISTE_PREDEFINITE, MANOVRE, isElicottero, normalizzaManovre } from '../js/core/campi.js';
import { creaBackup } from '../js/core/merge.js';
import { MEZZI_SOLO_INDIA } from '../js/core/controlli.js';

const quanti = Number(process.argv[2] ?? 90);
const destinazione = process.argv[3] ?? 'tests/fixtures/demo.json';

let seme = 118;
const caso = () => ((seme = (seme * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const uno = (voci, pesi) => {
  if (!pesi) return voci[Math.floor(caso() * voci.length)];
  let x = caso() * pesi.reduce((s, p) => s + p, 0);
  return voci.find((_, i) => (x -= pesi[i]) < 0) ?? voci.at(-1);
};
const voci = (nome) => LISTE_PREDEFINITE[nome].map((v) => v.voce);
const due = (n) => String(n).padStart(2, '0');

const COMUNI = ['BIELLA', 'CANDELO', 'COSSATO', 'MONGRANDO', 'GAGLIANICO', 'VIGLIANO BIELLESE', 'ANDORNO MICCA', 'SANDIGLIANO', 'CAVAGLIÀ', 'PONDERANO'];
const record = [];
for (let i = 0; i < quanti; i++) {
  const giorno = new Date(Date.UTC(2026, 0, 1) + Math.floor(caso() * 289) * 86400000);
  const data = giorno.toISOString().slice(0, 10);
  const inizio = Math.floor(caso() * 1440);
  const durata = 15 + Math.floor(caso() * 110);
  const ora = (m) => `${due(Math.floor((m % 1440) / 60))}:${due(m % 60)}`;
  const mezzo = uno(['3030', '3040', '5022', '3080', '5023', 'V-ECHO', 'T-ECHO'], [60, 12, 9, 6, 4, 8, 6]);
  const esito = uno(voci('esito'), [55, 14, 1, 1, 15, 6, 3, 3, 1]);
  const annullato = esito === 'Annullato da CO' || esito === 'Non Raggiungibile';
  const codiceInvio = uno(['VERDE', 'GIALLO', 'ROSSO'], [4, 80, 16]);
  const patologia = uno(voci('patologia'), [9, 25, 22, 24, 7, 1, 2, 1, 1, 1, 0, 0, 0, 0, 0, 6, 2]);
  const luogo = uno(voci('luogo'), [56, 16, 3, 5, 1, 1, 18]);
  // voli sempre completi: gli avvisi della demo restano i due casi voluti qui sotto
  const manovra = () => uno(MANOVRE.map((m) => m.codice), [3, 4, 1, 1, 2, 2]);
  const volo = isElicottero(mezzo) ? {
    tipoMissione: uno(voci('tipoMissione'), [70, 25, 5]),
    tempoVolo: 20 + Math.floor(caso() * 141),
    manovre: caso() < 0.75 ? [] : normalizzaManovre([manovra(), ...(caso() < 0.3 ? [manovra()] : [])]),
  } : { tipoMissione: '', tempoVolo: null, manovre: [] };
  const id = `demo-${String(i + 1).padStart(4, '0')}`;
  const istante = new Date(`${data}T${ora(inizio)}:00`).toISOString();
  record.push({
    id, createdAt: istante, updatedAt: istante, deleted: false,
    data, oraAllert: ora(inizio), missione: `DEMO${String(i + 1).padStart(4, '0')}`, comune: uno(COMUNI, [40, 8, 8, 6, 6, 5, 5, 4, 4, 4]),
    mezzo, tipologia: MEZZI_SOLO_INDIA.includes(mezzo) ? 'India' : 'Mike',
    codiceInvio, patologiaInvio: patologia, luogoInvio: luogo,
    eta: Math.min(100, Math.max(1, Math.round(70 + (caso() - 0.6) * 60))), sesso: uno(['Maschio', 'Femmina'], [56, 44]),
    esito, ospedale: esito === 'Trasportato' ? uno(voci('ospedale'), [0, 0, 80, 1, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]) : '',
    codiceRientro: annullato ? '' : esito === 'Deceduto' ? 'NERO' : uno(['VERDE', 'GIALLO', 'ROSSO'], [37, 36, 27]),
    patologiaRientro: annullato ? '' : caso() < 0.8 ? patologia : uno(voci('patologia')),
    luogoRientro: annullato ? '' : luogo,
    liberoOperativo: ora(inizio + durata),
    ...volo,
  });
}
// due casi da controllare, per vedere gli avvisi
record[3].missione = 'DEMO12';
record[7].missione = record[6].missione;

mkdirSync(dirname(destinazione), { recursive: true });
writeFileSync(destinazione, `${JSON.stringify(creaBackup({ record, liste: LISTE_PREDEFINITE, dispositivo: 'demo', adesso: new Date('2026-10-29T08:00:00.000Z') }), null, 1)}\n`);
console.log(`${record.length} interventi inventati → ${destinazione}`);
