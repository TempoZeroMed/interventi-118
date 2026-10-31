// Domande all'archivio: schema della query che Claude produce dalla domanda scritta, validazione ed esecuzione.
// Condiviso tra l'app (che calcola la risposta sul dispositivo) e il Worker (che valida ciò che Claude risponde).
import { CAMPI, isDataValida } from './campi.js';
import { calcolati } from './calcolati.js';
import { filtraPeriodo, vociTabella, FASCE_ETA, ANNULLATI, media, mediana, arrotondaExcel } from './statistiche.js';
import { unaPerMissione } from './pazienti.js';
import { meseLungo, dataBreve } from '../ui/dom.js';

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

// ---------------------------------------------------------------- esecuzione sul dispositivo

const SENZA_DATA = '—';
const GRUPPI_DATA = ['giorno', 'mese', 'anno', 'giornoSettimana'];
const LISTA_DEL_CAMPO = Object.fromEntries(CAMPI.filter((c) => c.lista).map((c) => [c.chiave, c.lista]));
const due = (n) => String(n).padStart(2, '0');

/** Come la banda delle Statistiche: "Anno 2026", "luglio 2026", "Dal 01/01/2026 al 31/03/2026", "Tutto l'archivio". */
export function descriviPeriodo(p) {
  if (p.tipo === 'anno') return `Anno ${p.anno}`;
  if (p.tipo === 'mese') return `${meseLungo(p.mese)} ${p.anno}`;
  if (p.tipo === 'intervallo') {
    if (p.da && p.a) return `Dal ${dataBreve(p.da)} al ${dataBreve(p.a)}`;
    if (p.da) return `Dal ${dataBreve(p.da)}`;
    if (p.a) return `Fino al ${dataBreve(p.a)}`;
    return 'Intervallo libero';
  }
  return 'Tutto l\'archivio';
}

function giornoSettimana(data) {
  if (!isDataValida(data)) return null;
  const [a, m, g] = data.split('-').map(Number);
  return GIORNI_SETTIMANA[(new Date(a, m - 1, g).getDay() + 6) % 7];
}

const fasciaEta = (eta) => (typeof eta === 'number' ? FASCE_ETA.find(([, da, a]) => eta >= da && eta <= a)?.[0] ?? null : null);
const numeroONull = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Chiave del gruppo per una riga { r, c }: null se il valore manca ("—" per i gruppi di data). */
function chiaveDi({ r, c }, gruppo) {
  const data = isDataValida(r.data) ? r.data : null;
  let k;
  if (gruppo === 'ora') k = c.ora === null ? null : due(c.ora);
  else if (gruppo === 'giornoSettimana') k = giornoSettimana(r.data);
  else if (gruppo === 'giorno') k = data;
  else if (gruppo === 'mese') k = data?.slice(0, 7) ?? null;
  else if (gruppo === 'anno') k = data?.slice(0, 4) ?? null;
  else if (gruppo === 'comune') k = normalizzaTesto(r.comune) || null;
  else if (gruppo === 'fasciaEta') k = fasciaEta(r.eta);
  else k = String(r[gruppo] ?? '').trim() || null;
  return k === null && GRUPPI_DATA.includes(gruppo) ? SENZA_DATA : k;
}

function etichetta(gruppo, chiave, grafie) {
  if (chiave === SENZA_DATA) return 'Senza data';
  if (gruppo === 'ora') return `Ore ${chiave}`;
  if (gruppo === 'giorno') return dataBreve(chiave);
  if (gruppo === 'mese') return `${meseLungo(Number(chiave.slice(5, 7)))} ${chiave.slice(0, 4)}`;
  if (gruppo === 'comune') return grafie.get(chiave) ?? chiave;
  return chiave;
}

/** Ordine naturale delle chiavi: tutte le ore, i giorni e le fasce; date crescenti; voci nell'ordine della lista. */
function chiaviInOrdine(gruppo, presenti, liste) {
  const coda = presenti.has(SENZA_DATA) ? [SENZA_DATA] : [];
  const usate = [...presenti].filter((k) => k !== SENZA_DATA);
  if (gruppo === 'ora') return Array.from({ length: 24 }, (_, i) => due(i));
  if (gruppo === 'giornoSettimana') return [...GIORNI_SETTIMANA, ...coda];
  if (gruppo === 'fasciaEta') return FASCE_ETA.map(([voce]) => voce);
  if (['giorno', 'mese', 'anno'].includes(gruppo)) return [...usate.sort(), ...coda];
  if (gruppo === 'comune') return usate.sort((a, b) => a.localeCompare(b, 'it'));
  return vociTabella(liste[LISTA_DEL_CAMPO[gruppo]], usate).filter((k) => presenti.has(k));
}

/** Divide le righe per gruppo, nell'ordine naturale. Le righe senza data restano fuori se `senzaData` è falso. */
function raggruppa(righe, gruppo, liste, senzaData) {
  const perChiave = new Map();
  const grafie = new Map();
  for (const riga of righe) {
    const k = chiaveDi(riga, gruppo);
    if (k === null || (k === SENZA_DATA && !senzaData)) continue;
    if (!perChiave.has(k)) perChiave.set(k, []);
    perChiave.get(k).push(riga);
    if (gruppo === 'comune' && !grafie.has(k)) grafie.set(k, String(riga.r.comune).trim());
  }
  return chiaviInOrdine(gruppo, new Set(perChiave.keys()), liste)
    .map((chiave) => ({ chiave, etichetta: etichetta(gruppo, chiave, grafie), righe: perChiave.get(chiave) ?? [] }));
}

function valoreFiltro({ r, c }, campo) {
  if (campo === 'durata') return c.durata;
  if (campo === 'ora') return c.ora;
  if (campo === 'giornoSettimana') return giornoSettimana(r.data);
  if (campo === 'eta' || campo === 'tempoVolo') return numeroONull(r[campo]);
  return r[campo] ?? '';
}

function passa(riga, { campo, op, valore }) {
  const v = valoreFiltro(riga, campo);
  const uguale = (x) => {
    if (CAMPI_NUMERICI.includes(campo)) return v !== null && v === Number(x);
    if (campo === 'giornoSettimana') return v !== null && normalizzaTesto(v).slice(0, 3) === normalizzaTesto(x).slice(0, 3);
    return normalizzaTesto(v) === normalizzaTesto(x);
  };
  if (op === '=') return uguale(valore);
  if (op === '!=') return !uguale(valore);
  if (op === 'in') return valore.some(uguale);
  if (v === null) return false;
  return { '>': v > valore, '>=': v >= valore, '<': v < valore, '<=': v <= valore }[op];
}

function seleziona(records, periodo, filtri) {
  return filtraPeriodo(records, periodo).map((r) => ({ r, c: calcolati(r) })).filter((riga) => filtri.every((f) => passa(riga, f)));
}

const contaValutati = (righe) => righe.filter(({ r }) => !ANNULLATI.includes(r.esito)).length;

/** Valore della misura su un insieme di righe; `selezione` è tutta la selezione (base delle percentuali). */
function misura(nome, righe, selezione) {
  const durate = righe.map(({ c }) => c.durata).filter((d) => d !== null);
  const eta = righe.map(({ r }) => numeroONull(r.eta)).filter((e) => e !== null);
  const div = (a, b) => (b ? a / b : 0);
  switch (nome) {
    case 'interventi': return unaPerMissione(righe.map(({ r }) => r)).length; // un'uscita vale 1, anche con più pazienti
    case 'valutati': return contaValutati(righe);
    case 'trasportati': return righe.filter(({ r }) => r.esito === 'Trasportato').length;
    case 'durataMedia': return durate.length ? arrotondaExcel(media(durate), 0) : null;
    case 'durataMediana': return mediana(durate);
    case 'durataMax': return durate.length ? Math.max(...durate) : null;
    case 'etaMedia': return eta.length ? arrotondaExcel(media(eta), 1) : null;
    case 'etaMediana': return mediana(eta);
    case 'pctTotali': return div(righe.length, selezione.length);
    case 'pctValutati': return div(righe.length, contaValutati(selezione));
    default: throw new Error(`Misura sconosciuta: ${nome}`);
  }
}

/** Ordina per valore (a parità resta l'ordine naturale; i valori vuoti in fondo) e taglia ai primi N. */
function classifica(righe, ordine, primi) {
  const ordinate = ordine === 'nessuno' ? righe : [...righe].sort((a, b) => {
    if (a.valore === null || b.valore === null) return (a.valore === null) - (b.valore === null);
    return ordine === 'max' ? b.valore - a.valore : a.valore - b.valore;
  });
  return primi ? ordinate.slice(0, primi) : ordinate;
}

/**
 * Esegue una query validata sull'archivio. Il periodo della query, se c'è, batte quello della pagina.
 * Forma del risultato: { periodo, descrizionePeriodo, base, righe, colonne, etichetteColonne, evidenziata, confronto, misura }.
 */
export function eseguiQuery(records, liste, query, periodoPagina) {
  const { misura: nome, gruppi, filtri, ordine, primi } = query;
  if (query.confronto) {
    const lato = (periodo) => {
      const selezione = seleziona(records, periodo, filtri);
      return { periodo, descrizionePeriodo: descriviPeriodo(periodo), valore: misura(nome, selezione, selezione), n: selezione.length };
    };
    const a = lato(query.confronto.periodoA);
    const b = lato(query.confronto.periodoB);
    const differenza = a.valore === null || b.valore === null ? null : b.valore - a.valore;
    return {
      periodo: null, descrizionePeriodo: `${a.descrizionePeriodo} e ${b.descrizionePeriodo}`, base: a.n + b.n,
      righe: [], colonne: null, etichetteColonne: null, evidenziata: null, misura: nome,
      confronto: { a, b, differenza, variazionePct: differenza === null || !a.valore ? null : (differenza / a.valore) * 100 },
    };
  }
  const periodo = query.periodo ?? periodoPagina ?? { tipo: 'tutto' };
  const selezione = seleziona(records, periodo, filtri);
  const senzaData = ordine === 'nessuno';
  let righe;
  let colonne = null;
  if (!gruppi.length) {
    righe = [{ chiavi: [], etichette: [], valore: misura(nome, selezione, selezione), n: selezione.length }];
  } else {
    const secondo = gruppi[1] ? raggruppa(selezione, gruppi[1], liste, senzaData) : null;
    if (secondo) colonne = secondo;
    righe = classifica(raggruppa(selezione, gruppi[0], liste, senzaData).map((g) => {
      const riga = { chiavi: [g.chiave], etichette: [g.etichetta], valore: misura(nome, g.righe, selezione), n: g.righe.length };
      if (secondo) {
        const dentro = new Set(g.righe);
        riga.celle = Object.fromEntries(secondo.map((col) => [col.chiave, misura(nome, col.righe.filter((x) => dentro.has(x)), selezione)]));
      }
      return riga;
    }), ordine, primi);
  }
  return {
    periodo, descrizionePeriodo: descriviPeriodo(periodo), base: selezione.length, righe,
    colonne: colonne && colonne.map((c) => c.chiave), etichetteColonne: colonne && colonne.map((c) => c.etichetta),
    evidenziata: ordine === 'nessuno' || !righe.length ? null : 0, confronto: null, misura: nome,
  };
}
