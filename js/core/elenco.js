// Consultazione: ricerca, filtri combinabili, ordine cronologico, suggerimenti per il form.
import { avvisi, indiceMissioni } from './controlli.js';
import { filtraPeriodo } from './statistiche.js';
import { unaPerMissione, chiaveMissione, isCollegato, pazientiValidi } from './pazienti.js';

const UGUALI = ['mezzo', 'tipologia', 'codiceInvio', 'codiceRientro', 'esito', 'ospedale'];

/**
 * filtri: { testo, periodo, mezzo, tipologia, codiceInvio, codiceRientro, patologia, esito, ospedale, soloAvvisi }
 * I filtri vuoti non restringono. La patologia vale sia per l'invio sia per il rientro.
 */
export function filtraElenco(records, filtri = {}) {
  const indice = filtri.soloAvvisi ? indiceMissioni(records) : null;
  const testo = String(filtri.testo ?? '').trim().toUpperCase();
  return filtraPeriodo(records, filtri.periodo).filter((r) => {
    if (testo && !r.missione.toUpperCase().includes(testo) && !r.comune.toUpperCase().includes(testo)) return false;
    if (UGUALI.some((k) => filtri[k] && r[k] !== filtri[k])) return false;
    if (filtri.patologia && r.patologiaInvio !== filtri.patologia && r.patologiaRientro !== filtri.patologia) return false;
    if (indice && avvisi(r, indice).length === 0) return false;
    return true;
  });
}

/**
 * "Paziente 2 di 3" su ogni scheda di un intervento con più pazienti, nell'ordine delle schede (la prima scheda è la 1);
 * '' per le altre schede. `indice` viene da indiceMissioni(). Con un numero di pazienti non valido: "Paziente 2 di ?".
 */
export function etichettaPaziente(r, indice) {
  const schede = (!r.deleted && indice.get(chiaveMissione(r.missione))) || [];
  const n = schede.findIndex((s) => s.id === r.id) + 1;
  if (!n || !isCollegato(schede)) return '';
  return `Paziente ${n} di ${pazientiValidi(schede[0]) ? schede[0].pazienti : '?'}`;
}

/** Il riepilogo in testa all'elenco: un'uscita vale un intervento anche con più pazienti; ogni scheda è un paziente. */
export function conteggioInterventi(records) {
  return { interventi: unaPerMissione(records).length, schede: records.length };
}

/** Dal più recente; a parità di data per ora di allertamento; le righe senza data in fondo. */
export function ordinaRecenti(records) {
  const chiave = (r) => `${r.data || '0000-00-00'} ${r.oraAllert || '00:00'} ${r.createdAt}`;
  return [...records].sort((a, b) => {
    if (!a.data !== !b.data) return a.data ? -1 : 1;
    return chiave(b).localeCompare(chiave(a));
  });
}

function conteggi(records, campi) {
  const n = new Map();
  for (const r of records) {
    if (r.deleted) continue;
    for (const k of campi) if (r[k]) n.set(r[k], (n.get(r[k]) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it')).map(([v]) => v);
}

/** COMUNI già usati, dal più frequente. */
export function suggerimentiComuni(records) {
  return conteggi(records, ['comune']);
}

/** Le n voci più usate nei campi indicati (scorciatoie del form). */
export function piuUsate(records, campi, n) {
  return conteggi(records, campi).slice(0, n);
}
