// Stato dell'app in memoria, sempre allineato a IndexedDB. Ogni scrittura passa da qui.
import * as db from './db.js';
import { LISTE_PREDEFINITE, allineaVociSistema, normalizzaRecord } from './core/campi.js';
import { unisci, unisciListe, creaBackup } from './core/merge.js';
import { isIntervento } from './core/statistiche.js';

export const stato = { record: [], liste: {}, meta: {} };

const ascoltatori = new Set();
export function quandoCambia(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}
const notifica = () => ascoltatori.forEach((fn) => fn());

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function carica() {
  const dati = await db.leggiTutto();
  stato.record = dati.record.map(normalizzaRecord); // i record salvati prima dei campi di volo li hanno vuoti
  stato.meta = dati.meta;
  const mancanti = Object.fromEntries(Object.entries(LISTE_PREDEFINITE).filter(([nome]) => !dati.liste[nome]));
  // ordine delle liste come nel foglio "Liste", poi eventuali altre
  stato.liste = allineaVociSistema(Object.fromEntries([
    ...Object.keys(LISTE_PREDEFINITE).map((nome) => [nome, dati.liste[nome] ?? mancanti[nome]]),
    ...Object.entries(dati.liste).filter(([nome]) => !(nome in LISTE_PREDEFINITE)),
  ]));
  const meta = {};
  if (!stato.meta.dispositivoId) meta.dispositivoId = crypto.randomUUID();
  if (Object.keys(mancanti).length || Object.keys(meta).length) {
    await db.scrivi({ liste: mancanti, meta });
    Object.assign(stato.meta, meta);
  }
}

export const interventi = () => stato.record.filter(isIntervento);
export const trova = (id) => stato.record.find((r) => r.id === id) ?? null;

function sostituisci(r) {
  const i = stato.record.findIndex((x) => x.id === r.id);
  if (i >= 0) stato.record[i] = r;
  else stato.record.push(r);
}

const modifiche = (n = 1) => ({ modificheNonEsportate: (stato.meta.modificheNonEsportate ?? 0) + n });

export async function salvaIntervento(r, { bozza = undefined } = {}) {
  const meta = modifiche();
  if (bozza !== undefined) meta.bozza = bozza;
  await db.scrivi({ record: [r], meta });
  sostituisci(r);
  Object.assign(stato.meta, meta);
  notifica();
}

export async function eliminaIntervento(id, adesso = new Date()) {
  const r = { ...trova(id), deleted: true, updatedAt: adesso.toISOString() };
  await salvaIntervento(r);
  return r;
}

export async function impostaMeta(valori) {
  await db.scrivi({ meta: valori });
  Object.assign(stato.meta, valori);
}

/** Liste modificate nelle Impostazioni, con i record da rinominare. */
export async function aggiornaListe(liste, recordModificati = []) {
  const meta = modifiche();
  await db.scrivi({ record: recordModificati, liste, meta });
  stato.liste = liste;
  recordModificati.forEach(sostituisci);
  Object.assign(stato.meta, meta);
  notifica();
}

/** Import con merge: nessuna sostituzione, vince la versione più recente di ogni record. */
export async function importaBackup(backup, adesso = new Date()) {
  const { record, riepilogo } = unisci(stato.record, backup.record, stato.meta.ultimaSincronizzazione ?? null);
  let liste = stato.liste;
  let listeAggiornate = 0;
  if (backup.liste) ({ liste, aggiornate: listeAggiornate } = unisciListe(stato.liste, backup.liste));
  liste = allineaVociSistema(liste);
  const meta = { ultimaSincronizzazione: adesso.toISOString() };
  await db.scrivi({ record, liste, meta });
  stato.record = record;
  stato.liste = liste;
  Object.assign(stato.meta, meta);
  notifica();
  return { ...riepilogo, listeAggiornate };
}

/** Il tipo di dispositivo che dà il nome ai file esportati (mai il codice di nomeDispositivo). */
export function tipoDispositivo() {
  return isIOS() ? 'iPhone' : 'Mac';
}

export function nomeDispositivo() {
  return `${tipoDispositivo()} ${String(stato.meta.dispositivoId ?? '').slice(0, 4)}`.trim();
}

export function backupCorrente(adesso = new Date()) {
  return creaBackup({ record: stato.record, liste: stato.liste, dispositivo: nomeDispositivo(), adesso });
}

export async function registraEsportazione(adesso = new Date()) {
  await impostaMeta({ ultimoBackup: adesso.toISOString(), ultimaSincronizzazione: adesso.toISOString(), modificheNonEsportate: 0 });
  notifica();
}
