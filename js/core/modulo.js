// Regole del form di inserimento, senza DOM.
import { CAMPI, normalizzaRecord, normalizzaManovre, normalizzaNumero, isElicottero } from './campi.js';
import { MEZZI_A_ORARIO, tipologiaDelMezzo } from './controlli.js';
import { ordinaSchede, isCollegato, schedeDi } from './pazienti.js';

const due = (n) => String(n).padStart(2, '0');

export const dataLocale = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;

export function recordVuoto(id, adesso) {
  const r = { id, createdAt: adesso.toISOString(), updatedAt: adesso.toISOString(), deleted: false };
  for (const { chiave } of CAMPI) r[chiave] = chiave === 'eta' || chiave === 'tempoVolo' || chiave === 'pazienti' ? null : '';
  r.manovre = [];
  r.data = dataLocale(adesso);
  return r;
}

/** Una bozza con qualcosa di scritto: la data di oggi la mette il modulo da solo, e non conta. */
export function bozzaConDati(r) {
  if (!r) return false;
  return CAMPI.some(({ chiave }) => chiave !== 'data' && r[chiave] !== null && r[chiave] !== undefined && r[chiave] !== '')
    || (r.manovre ?? []).length > 0;
}

/** Imposta un campo applicando le regole del form. */
export function impostaCampo(r, campo, valore) {
  const nuovo = { ...r };
  if (campo === 'comune') nuovo.comune = String(valore).toUpperCase();
  else if (campo === 'missione') nuovo.missione = String(valore).toUpperCase().replace(/\s+/g, '');
  else if (campo === 'eta' || campo === 'tempoVolo') nuovo[campo] = normalizzaNumero(valore); // un testo resta testo, per l'avviso
  // null: spunta "Paziente multiplo" spenta; '': spunta accesa e numero cancellato (il salvataggio si ferma)
  else if (campo === 'pazienti') nuovo.pazienti = valore === null ? null : String(valore).trim() === '' ? '' : normalizzaNumero(valore);
  else nuovo[campo] = valore;
  if (campo === 'mezzo' && valore) nuovo.tipologia = tipologiaDelMezzo(valore, r.oraAllert);
  if (campo === 'oraAllert' && Object.hasOwn(MEZZI_A_ORARIO, r.mezzo)) nuovo.tipologia = tipologiaDelMezzo(r.mezzo, valore);
  if (campo === 'esito' && valore !== 'Trasportato') nuovo.ospedale = '';
  if (campo === 'mezzo' && !isElicottero(valore)) Object.assign(nuovo, { tipoMissione: '', tempoVolo: null, manovre: [] });
  return nuovo;
}

/** Un tocco accende la manovra, il secondo la spegne. */
export function alternaManovra(r, codice) {
  const manovre = r.manovre ?? [];
  return { ...r, manovre: normalizzaManovre(manovre.includes(codice) ? manovre.filter((c) => c !== codice) : [...manovre, codice]) };
}

export function copiaDaInvio(r) {
  return { ...r, codiceRientro: r.codiceInvio, patologiaRientro: r.patologiaInvio, luogoRientro: r.luogoInvio };
}

/**
 * Il record da scrivere, normalizzato. Una scheda nuova prende createdAt all'istante del salvataggio (non all'apertura
 * del modulo): così la prima scheda di una MISSIONE è la prima salvata, anche dopo una bozza lasciata a metà.
 */
export function prontoPerSalvare(r, adesso, { nuovo = false } = {}) {
  const pronto = { ...normalizzaRecord(r), updatedAt: adesso.toISOString() };
  if (nuovo) pronto.createdAt = adesso.toISOString();
  return pronto;
}

// --- Intervento con più pazienti ---

/**
 * Una scheda con la MISSIONE di una prima scheda con la spunta "Paziente multiplo" si collega: prende il numero di
 * pazienti della prima scheda, e `collegataA` è il suo id. Una scheda non ancora salvata è sempre l'ultima del gruppo;
 * la prima scheda non si collega alle altre. Se era collegata (`eraCollegata`, l'id di prima) e non lo è più, perché la
 * MISSIONE è cambiata, perde la spunta.
 */
export function collegaScheda(r, records, eraCollegata) {
  const altre = schedeDi(records, r.missione, { escludi: r.id });
  const laPrima = records.some((x) => x.id === r.id) && ordinaSchede([...altre, r])[0].id === r.id;
  if (isCollegato(altre) && !laPrima) {
    const pazienti = altre[0].pazienti;
    return { record: r.pazienti === pazienti ? r : { ...r, pazienti }, collegataA: altre[0].id };
  }
  return { record: eraCollegata !== null && r.pazienti !== null ? { ...r, pazienti: null } : r, collegataA: null };
}

/** I campi dell'intervento, uguali per tutti i pazienti: la scheda di un altro paziente li copia dalla prima scheda. */
const CAMPI_CONDIVISI = [
  'data', 'oraAllert', 'missione', 'pazienti', 'comune', 'mezzo', 'tipologia', 'codiceInvio', 'patologiaInvio', 'luogoInvio',
  'liberoOperativo', 'tipoMissione', 'tempoVolo',
];

/** "Aggiungi paziente": scheda nuova con i campi condivisi della prima scheda, vuoti quelli del paziente. */
export function nuovaSchedaPaziente(prima, id, adesso) {
  const r = recordVuoto(id, adesso);
  for (const chiave of CAMPI_CONDIVISI) r[chiave] = prima[chiave] ?? r[chiave];
  return r;
}
