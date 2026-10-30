// Domande all'archivio: schema della query che Claude produce dalla domanda scritta, validazione ed esecuzione.
// Condiviso tra l'app (che calcola la risposta sul dispositivo) e il Worker (che valida ciò che Claude risponde).
import { CAMPI, isDataValida } from './campi.js';

export const MISURE = [
  'interventi', 'valutati', 'trasportati', 'durataMedia', 'durataMediana', 'durataMax',
  'etaMedia', 'etaMediana', 'pctTotali', 'pctValutati',
];
export const GRUPPI = [
  'ora', 'giornoSettimana', 'giorno', 'mese', 'anno', 'comune', 'mezzo', 'tipologia', 'codiceInvio', 'codiceRientro',
  'patologiaInvio', 'patologiaRientro', 'luogoInvio', 'luogoRientro', 'esito', 'ospedale', 'fasciaEta', 'sesso', 'tipoMissione',
];
export const OPERATORI = ['=', '!=', '>', '>=', '<', '<=', 'in'];
export const ORDINI = ['max', 'min', 'nessuno'];
export const GIORNI_SETTIMANA = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const CAMPI_FILTRO = [...CAMPI.map((c) => c.chiave), 'durata', 'ora', 'giornoSettimana'];
const CAMPI_NUMERICI = ['eta', 'tempoVolo', 'durata', 'ora'];
const CAMPI_QUERY = ['tipo', 'interpretazione', 'misura', 'gruppi', 'filtri', 'periodo', 'confronto', 'ordine', 'primi'];
const PREDEFINITI = { gruppi: [], filtri: [], periodo: null, confronto: null, ordine: 'max', primi: null };

const isOggetto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isTesto = (x, massimo = 500) => typeof x === 'string' && x.trim() !== '' && x.length <= massimo;
const isIntero = (x, da, a) => Number.isInteger(x) && x >= da && x <= a;
const isValore = (x) => (typeof x === 'string' && x.length <= 200) || (typeof x === 'number' && Number.isFinite(x));
const estranei = (o, ammessi) => Object.keys(o).filter((k) => !ammessi.includes(k));

/** Motivo per cui un periodo non è valido, o null. */
function errorePeriodo(p) {
  if (!isOggetto(p)) return 'periodo non è un oggetto';
  const ammessi = { anno: ['tipo', 'anno'], mese: ['tipo', 'anno', 'mese'], intervallo: ['tipo', 'da', 'a'], tutto: ['tipo'] }[p.tipo];
  if (!ammessi) return `tipo di periodo sconosciuto: ${p.tipo}`;
  if (estranei(p, ammessi).length) return `campi sconosciuti nel periodo: ${estranei(p, ammessi).join(', ')}`;
  if ((p.tipo === 'anno' || p.tipo === 'mese') && !isIntero(p.anno, 1900, 2200)) return 'anno non valido';
  if (p.tipo === 'mese' && !isIntero(p.mese, 1, 12)) return 'mese non valido';
  if (p.tipo === 'intervallo') {
    const data = (d) => d === null || d === undefined || d === '' || isDataValida(d);
    if (!data(p.da) || !data(p.a)) return 'date dell\'intervallo non valide';
  }
  return null;
}

function erroreFiltro(f) {
  if (!isOggetto(f) || estranei(f, ['campo', 'op', 'valore']).length) return 'filtro mal formato';
  if (!CAMPI_FILTRO.includes(f.campo)) return `campo di filtro sconosciuto: ${f.campo}`;
  if (!OPERATORI.includes(f.op)) return `operatore sconosciuto: ${f.op}`;
  if (['>', '>=', '<', '<='].includes(f.op)) {
    if (!CAMPI_NUMERICI.includes(f.campo)) return `confronto numerico su un campo non numerico: ${f.campo}`;
    if (typeof f.valore !== 'number' || !Number.isFinite(f.valore)) return 'il confronto numerico vuole un numero';
    return null;
  }
  if (f.op === 'in') {
    if (!Array.isArray(f.valore) || !f.valore.length || f.valore.length > 50 || !f.valore.every(isValore)) return '"in" vuole un elenco non vuoto';
    return null;
  }
  return isValore(f.valore) ? null : 'valore del filtro non valido';
}

function erroreQuery(q) {
  if (estranei(q, CAMPI_QUERY).length) return `campi sconosciuti: ${estranei(q, CAMPI_QUERY).join(', ')}`;
  if (!isTesto(q.interpretazione, 200)) return 'interpretazione mancante';
  if (!MISURE.includes(q.misura)) return `misura sconosciuta: ${q.misura}`;
  if (!Array.isArray(q.gruppi) || q.gruppi.length > 2) return 'gruppi: da zero a due';
  if (!q.gruppi.every((g) => GRUPPI.includes(g))) return 'gruppo sconosciuto';
  if (new Set(q.gruppi).size !== q.gruppi.length) return 'gruppo ripetuto';
  if (!Array.isArray(q.filtri) || q.filtri.length > 20) return 'filtri non validi';
  for (const f of q.filtri) {
    const motivo = erroreFiltro(f);
    if (motivo) return motivo;
  }
  if (q.periodo !== null) {
    const motivo = errorePeriodo(q.periodo);
    if (motivo) return motivo;
  }
  if (q.confronto !== null) {
    if (!isOggetto(q.confronto) || estranei(q.confronto, ['periodoA', 'periodoB']).length) return 'confronto mal formato';
    const motivo = errorePeriodo(q.confronto.periodoA) ?? errorePeriodo(q.confronto.periodoB);
    if (motivo) return `confronto: ${motivo}`;
    if (q.gruppi.length) return 'il confronto non ammette gruppi';
  }
  if (!ORDINI.includes(q.ordine)) return `ordine sconosciuto: ${q.ordine}`;
  if (q.primi !== null && !isIntero(q.primi, 1, 50)) return 'primi: da 1 a 50';
  return null;
}

/**
 * Controlla ciò che Claude ha risposto. Tre forme: query, controdomanda, rifiuto.
 * Restituisce { ok: true, query } (con i campi facoltativi completati) oppure { ok: false, motivo }.
 */
export function validaQuery(oggetto) {
  if (!isOggetto(oggetto)) return { ok: false, motivo: 'la risposta non è un oggetto' };
  if (oggetto.tipo === 'controdomanda') {
    if (estranei(oggetto, ['tipo', 'testo']).length || !isTesto(oggetto.testo)) return { ok: false, motivo: 'controdomanda mal formata' };
    return { ok: true, query: { tipo: 'controdomanda', testo: oggetto.testo } };
  }
  if (oggetto.tipo === 'rifiuto') {
    const { testo, esempi } = oggetto;
    if (estranei(oggetto, ['tipo', 'testo', 'esempi']).length || !isTesto(testo)
      || !Array.isArray(esempi) || esempi.length !== 3 || !esempi.every((e) => isTesto(e, 200))) {
      return { ok: false, motivo: 'rifiuto mal formato: servono un testo e tre esempi' };
    }
    return { ok: true, query: { tipo: 'rifiuto', testo, esempi: [...esempi] } };
  }
  if (oggetto.tipo !== 'query') return { ok: false, motivo: `tipo sconosciuto: ${oggetto.tipo}` };
  const query = { ...PREDEFINITI, ...oggetto };
  const motivo = erroreQuery(query);
  return motivo ? { ok: false, motivo } : { ok: true, query: Object.fromEntries(CAMPI_QUERY.map((k) => [k, query[k]])) };
}

/** Minuscole, senza accenti né apostrofi, spazi compressi: "CIRIE'" e "Ciriè" diventano "cirie". */
export function normalizzaTesto(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Comuni dell'archivio, uno per grafia normalizzata (tiene la prima incontrata), in ordine alfabetico. */
export function comuniDistinti(records) {
  const visti = new Map();
  for (const r of records) {
    const chiave = normalizzaTesto(r.comune);
    if (!r.deleted && chiave && !visti.has(chiave)) visti.set(chiave, String(r.comune).trim());
  }
  return [...visti.entries()].sort(([a], [b]) => a.localeCompare(b, 'it')).map(([, grafia]) => grafia);
}

/** Il primo oggetto JSON {…} bilanciato nel testo (le graffe dentro le stringhe non contano), o null. */
export function estraiJson(testo) {
  const s = String(testo ?? '');
  for (let inizio = s.indexOf('{'); inizio >= 0; inizio = s.indexOf('{', inizio + 1)) {
    let profondita = 0;
    let inStringa = false;
    for (let i = inizio; i < s.length; i++) {
      const c = s[i];
      if (inStringa) {
        if (c === '\\') i++;
        else if (c === '"') inStringa = false;
      } else if (c === '"') inStringa = true;
      else if (c === '{') profondita++;
      else if (c === '}' && --profondita === 0) {
        try {
          return JSON.parse(s.slice(inizio, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
