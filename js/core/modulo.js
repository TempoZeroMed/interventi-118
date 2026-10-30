// Regole del form di inserimento, senza DOM.
import { CAMPI, normalizzaRecord } from './campi.js';
import { MEZZI_SOLO_INDIA } from './controlli.js';

const due = (n) => String(n).padStart(2, '0');

export const dataLocale = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const oraLocale = (d) => `${due(d.getHours())}:${due(d.getMinutes())}`;

export function recordVuoto(id, adesso) {
  const r = { id, createdAt: adesso.toISOString(), updatedAt: adesso.toISOString(), deleted: false };
  for (const { chiave } of CAMPI) r[chiave] = chiave === 'eta' ? null : '';
  r.data = dataLocale(adesso);
  return r;
}

/** Imposta un campo applicando le regole del form. */
export function impostaCampo(r, campo, valore) {
  const nuovo = { ...r };
  if (campo === 'comune') nuovo.comune = String(valore).toUpperCase();
  else if (campo === 'missione') nuovo.missione = String(valore).toUpperCase().replace(/\s+/g, '');
  else if (campo === 'eta') nuovo.eta = String(valore).trim() === '' ? null : Number(String(valore).replace(',', '.'));
  else nuovo[campo] = valore;
  if (campo === 'mezzo' && MEZZI_SOLO_INDIA.includes(valore)) nuovo.tipologia = 'India';
  if (campo === 'esito' && valore !== 'Trasportato') nuovo.ospedale = '';
  return nuovo;
}

export function copiaDaInvio(r) {
  return { ...r, codiceRientro: r.codiceInvio, patologiaRientro: r.patologiaInvio, luogoRientro: r.luogoInvio };
}

export function prontoPerSalvare(r, adesso) {
  return { ...normalizzaRecord(r), updatedAt: adesso.toISOString() };
}
