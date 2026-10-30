// Export .xlsx con la stessa struttura di colonne del foglio "Interventi" (valori, non formule).
import { calcolati } from './calcolati.js';
import { CAMPI, isDataValida, isOraValida, minutiDaOra } from './campi.js';
import { avvisi, indiceMissioni } from './controlli.js';
import { isIntervento } from './statistiche.js';

const SEZIONI = [
  ['IDENTIFICAZIONE', 0, 3], ['MEZZO', 4, 6], ['INVIO DALLA CO', 7, 9], ['PAZIENTE', 10, 11], ['ESITO', 12, 13],
  ['RIENTRO (valutazione sul posto)', 14, 16], ['TEMPI', 17, 18], ['CALCOLATE – non scrivere', 19, 22],
];
const INTESTAZIONI = ['#', ...CAMPI.map((c) => c.intestazione), 'DURATA (min)', 'MESE', 'ORA DEL GIORNO', 'Δ CODICE', 'CONTROLLI'];

/** '2026-01-01' -> 46023 (sistema data 1900 di Excel). */
export function dataSeriale(data) {
  const [a, m, g] = data.split('-').map(Number);
  return (Date.UTC(a, m - 1, g) - Date.UTC(1899, 11, 30)) / 86400000;
}

/** '08:58' -> 538/1440 */
export function frazioneOra(ora) {
  return minutiDaOra(ora) / 1440;
}

const vuotoANull = (v) => (v === '' || v === undefined ? null : v);

function cella(r, chiave) {
  const v = r[chiave];
  if (chiave === 'data') return isDataValida(v) ? dataSeriale(v) : vuotoANull(v);
  if (chiave === 'oraAllert' || chiave === 'liberoOperativo') return isOraValida(v) ? frazioneOra(v) : vuotoANull(v);
  if (chiave === 'mezzo') return /^\d+$/.test(v) ? Number(v) : vuotoANull(v);
  return vuotoANull(v);
}

/** Righe del foglio: intestazione delle sezioni, intestazione delle colonne, interventi dal più vecchio. */
export function righeExcel(records) {
  const indice = indiceMissioni(records);
  const interventi = records.filter(isIntervento).sort((a, b) => (
    `${a.data || '9999'} ${a.oraAllert} ${a.createdAt}`.localeCompare(`${b.data || '9999'} ${b.oraAllert} ${b.createdAt}`)
  ));
  const sezioni = new Array(INTESTAZIONI.length).fill(null);
  for (const [titolo, da] of SEZIONI) sezioni[da] = titolo;
  return [
    sezioni,
    INTESTAZIONI,
    ...interventi.map((r, i) => {
      const c = calcolati(r);
      const controlli = avvisi(r, indice).map((a) => `${a}; `).join('').trim();
      return [i + 1, ...CAMPI.map(({ chiave }) => cella(r, chiave)), c.durata, c.mese, c.ora, c.delta, vuotoANull(controlli)];
    }),
  ];
}

/** Cartella SheetJS pronta da scrivere. `XLSX` è la libreria caricata da vendor/. */
export function creaCartellaExcel(XLSX, records) {
  const righe = righeExcel(records);
  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio['!merges'] = SEZIONI.map(([, da, a]) => ({ s: { r: 0, c: da }, e: { r: 0, c: a } }));
  foglio['!cols'] = INTESTAZIONI.map((h) => ({ wch: Math.max(6, Math.min(24, h.length + 2)) }));
  for (let r = 2; r < righe.length; r++) {
    for (const [col, formato] of [[1, 'dd/mm/yyyy'], [2, 'hh:mm'], [17, 'hh:mm']]) {
      const ref = XLSX.utils.encode_cell({ r, c: col });
      if (foglio[ref] && foglio[ref].t === 'n') foglio[ref].z = formato;
    }
  }
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(cartella, foglio, 'Interventi');
  return cartella;
}
