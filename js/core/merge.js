// Backup JSON e unione (merge) tra dispositivi: per id, vince l'updatedAt più recente.
import { normalizzaRecord } from './campi.js';

export const FORMATO = 'interventi118';
export const VERSIONE = 2; // 2: campi di volo (tipoMissione, tempoVolo, manovre)
const VERSIONI_LEGGIBILI = [1, 2];

/**
 * Contenuto del record senza updatedAt, con chiavi ordinate: due versioni uguali danno lo stesso testo.
 * Normalizzato, così un record v1 senza i campi di volo e lo stesso record con i campi vuoti coincidono.
 */
function contenuto(r) {
  const n = normalizzaRecord(r);
  const chiavi = Object.keys(n).filter((k) => k !== 'updatedAt').sort();
  return JSON.stringify(n, chiavi);
}

const chiaveMissione = (m) => String(m ?? '').trim().toUpperCase();

/**
 * Unisce i record importati a quelli locali. Nessun record viene tolto: le eliminazioni
 * viaggiano come record con deleted: true.
 * Conflitto = stesso record modificato su entrambi i dispositivi dopo `ultimaSincronizzazione`
 * (ISO; null se non c'è mai stata). A parità di updatedAt decide il contenuto, così due dispositivi
 * che si scambiano i file arrivano allo stesso risultato.
 */
export function unisci(locali, entranti, ultimaSincronizzazione) {
  const mappa = new Map(locali.map((r) => [r.id, r]));
  const sync = ultimaSincronizzazione ?? '';
  const riepilogo = { nuovi: 0, aggiornati: 0, invariati: 0, eliminati: 0, conflitti: [], duplicatiMissione: [] };
  const aggiunti = [];

  for (const e of entranti) {
    const l = mappa.get(e.id);
    if (!l) {
      mappa.set(e.id, e);
      if (e.deleted) riepilogo.invariati++;
      else {
        riepilogo.nuovi++;
        aggiunti.push(e);
      }
      continue;
    }
    const cl = contenuto(l);
    const ce = contenuto(e);
    if (cl === ce) {
      if (e.updatedAt > l.updatedAt) mappa.set(e.id, e);
      riepilogo.invariati++;
      continue;
    }
    const vinceImportato = e.updatedAt > l.updatedAt || (e.updatedAt === l.updatedAt && ce > cl);
    const vincitore = vinceImportato ? e : l;
    if (l.updatedAt > sync && e.updatedAt > sync) {
      riepilogo.conflitti.push({
        id: e.id, missione: vincitore.missione, data: vincitore.data, vincitore: vinceImportato ? 'importato' : 'locale',
      });
    }
    if (vinceImportato) {
      mappa.set(e.id, e);
      riepilogo.aggiornati++;
      if (e.deleted && !l.deleted) riepilogo.eliminati++;
    } else {
      riepilogo.invariati++;
    }
  }

  const record = [...mappa.values()];
  const viste = new Set();
  for (const nuovo of aggiunti) {
    const k = chiaveMissione(nuovo.missione);
    if (!k || viste.has(k)) continue;
    viste.add(k);
    const ids = record.filter((r) => !r.deleted && chiaveMissione(r.missione) === k).map((r) => r.id);
    if (ids.length > 1) riepilogo.duplicatiMissione.push({ missione: k, ids });
  }
  return { record, riepilogo };
}

/** Unisce le liste voce per voce (per id): voci nuove in fondo, la modifica più recente vince. */
export function unisciListe(locali, entranti) {
  const liste = {};
  let aggiornate = 0;
  for (const nome of new Set([...Object.keys(locali ?? {}), ...Object.keys(entranti ?? {})])) {
    const mappa = new Map((locali?.[nome] ?? []).map((v) => [v.id, v]));
    for (const v of entranti?.[nome] ?? []) {
      const l = mappa.get(v.id);
      if (!l || (v.updatedAt > l.updatedAt && JSON.stringify(v) !== JSON.stringify({ ...l, updatedAt: v.updatedAt }))) {
        mappa.set(v.id, v);
        aggiornate++;
      } else if (v.updatedAt > l.updatedAt) {
        mappa.set(v.id, v);
      }
    }
    liste[nome] = [...mappa.values()];
  }
  return { liste, aggiornate };
}

/** Legge e controlla un file di backup (testo JSON o oggetto già letto). */
export function leggiBackup(testo) {
  let doc = testo;
  if (typeof testo === 'string') {
    try {
      doc = JSON.parse(testo);
    } catch {
      throw new Error('Il file scelto non è un file JSON valido.');
    }
  }
  if (!doc || doc.formato !== FORMATO || !Array.isArray(doc.record)) {
    throw new Error('Il file scelto non è un backup di Interventi 118.');
  }
  if (!VERSIONI_LEGGIBILI.includes(doc.versione)) {
    throw new Error(doc.versione > VERSIONE
      ? 'Il backup è stato creato da una versione più recente dell\'app: aggiorna l\'app e riprova.'
      : 'Versione del backup non riconosciuta.');
  }
  const record = doc.record.map((r, i) => {
    if (!r || typeof r.id !== 'string' || !r.id) {
      throw new Error(`L'intervento n. ${i + 1} del file è senza id: il file non può essere importato.`);
    }
    return normalizzaRecord(r);
  });
  return {
    esportatoIl: doc.esportatoIl ?? null,
    dispositivo: doc.dispositivo ?? null,
    record,
    liste: doc.liste ?? null,
  };
}

export function creaBackup({ record, liste, dispositivo, adesso = new Date() }) {
  return { formato: FORMATO, versione: VERSIONE, esportatoIl: adesso.toISOString(), dispositivo, record, liste };
}

const GIORNO = 86400000;

/**
 * Promemoria se l'ultimo backup ha più di 7 giorni, se ci sono più di 10 modifiche non esportate,
 * o se non c'è mai stato un backup e l'archivio non è vuoto. Restituisce { messaggio } oppure null.
 */
export function promemoriaBackup({ ultimoBackup, modificheNonEsportate = 0, numeroInterventi = 0 }, adesso = new Date()) {
  const motivi = [];
  if (!ultimoBackup) {
    if (numeroInterventi > 0) motivi.push('Nessun backup ancora fatto.');
  } else {
    const giorni = Math.floor((adesso - new Date(ultimoBackup)) / GIORNO);
    if (adesso - new Date(ultimoBackup) > 7 * GIORNO) motivi.push(`Ultimo backup ${giorni} giorni fa.`);
  }
  if (modificheNonEsportate > 10) motivi.push(`${modificheNonEsportate} modifiche non esportate.`);
  return motivi.length ? { messaggio: motivi.join(' ') } : null;
}

/** interventi118_iPhone.json / interventi118_Mac.json: lo stesso nome a ogni esportazione, così il file si sostituisce. */
export function nomeFileBackup(dispositivo, estensione = 'json') {
  return `interventi118_${dispositivo}.${estensione}`;
}

/** interventi118_AAAA-MM-GG_HHMM.json, con data e ora locali: la copia storica. */
export function nomeFileDatato(d = new Date()) {
  const due = (n) => String(n).padStart(2, '0');
  return `interventi118_${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}_${due(d.getHours())}${due(d.getMinutes())}.json`;
}
