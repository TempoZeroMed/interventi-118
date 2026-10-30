// Controlli di qualità (colonna CONTROLLI dell'Excel) e regole di salvataggio.
import { isDataValida, isOraValida } from './campi.js';

/** Nell'ordine in cui compaiono nella colonna CONTROLLI; l'ultimo è aggiunto dall'app. */
export const TIPI_AVVISO = [
  'Ora allert. non valida',
  'Libero operativo non valido',
  'Data non valida',
  'Missione non di 8 caratteri',
  'Missione duplicata',
  'Mezzo solo India',
  'Ospedale senza trasporto',
  'Età non valida',
];

export const MEZZI_SOLO_INDIA = ['3040', '5022', '5024'];

const chiaveMissione = (missione) => String(missione ?? '').trim().toUpperCase();

/** Quante volte compare ogni MISSIONE tra i record non eliminati. */
export function indiceMissioni(records) {
  const indice = new Map();
  for (const r of records) {
    const k = chiaveMissione(r.missione);
    if (!r.deleted && k) indice.set(k, (indice.get(k) ?? 0) + 1);
  }
  return indice;
}

/** Avvisi non bloccanti di un record; `indice` viene da indiceMissioni() su tutto l'archivio. */
export function avvisi(r, indice) {
  const out = [];
  if (r.oraAllert && !isOraValida(r.oraAllert)) out.push('Ora allert. non valida');
  if (r.liberoOperativo && !isOraValida(r.liberoOperativo)) out.push('Libero operativo non valido');
  if (r.data && !isDataValida(r.data)) out.push('Data non valida');
  if (r.missione && String(r.missione).length !== 8) out.push('Missione non di 8 caratteri');
  if (r.missione && (indice.get(chiaveMissione(r.missione)) ?? 0) > 1) out.push('Missione duplicata');
  if (MEZZI_SOLO_INDIA.includes(r.mezzo) && r.tipologia === 'Mike') out.push('Mezzo solo India');
  if (r.ospedale && r.esito !== 'Trasportato') out.push('Ospedale senza trasporto');
  if (r.eta !== null && r.eta !== undefined && (typeof r.eta !== 'number' || !Number.isInteger(r.eta) || r.eta < 0)) {
    out.push('Età non valida');
  }
  return out;
}

/**
 * Regole bloccanti al salvataggio. `originale` è la versione salvata (assente per un nuovo intervento):
 * il duplicato blocca solo se la MISSIONE è nuova o è stata cambiata.
 */
export function verificaSalvataggio(record, records, originale = null) {
  const errori = [];
  const missione = chiaveMissione(record.missione);
  if (!String(record.data ?? '').trim() && !missione) errori.push('Inserisci almeno DATA o MISSIONE.');
  let duplicatoDi = null;
  if (missione && (!originale || chiaveMissione(originale.missione) !== missione)) {
    const altro = records.find((x) => !x.deleted && x.id !== record.id && chiaveMissione(x.missione) === missione);
    if (altro) {
      duplicatoDi = altro.id;
      errori.push(`La MISSIONE ${missione} è già registrata.`);
    }
  }
  return { ok: errori.length === 0, errori, duplicatoDi };
}
