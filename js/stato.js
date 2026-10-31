// Stato dell'app in memoria, sempre allineato a IndexedDB. Ogni scrittura passa da qui.
import * as db from './db.js';
import { LISTE_PREDEFINITE, allineaVociSistema, normalizzaRecord } from './core/campi.js';
import { unisci, unisciListe, creaBackup } from './core/merge.js';
import { isIntervento } from './core/statistiche.js';
import { chiaveMissione, schedeDi, collegaGruppo, scollegaGruppo } from './core/pazienti.js';

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

/** Salva una scheda e, nella stessa transazione, le `altri` schede che cambiano con lei (stesso intervento). */
export async function salvaIntervento(r, { bozza = undefined, altri = [] } = {}) {
  const meta = modifiche(1 + altri.length);
  if (bozza !== undefined) meta.bozza = bozza;
  await db.scrivi({ record: [r, ...altri], meta });
  [r, ...altri].forEach(sostituisci);
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

// --- Missioni registrate più volte: le decisioni dell'utente ---
// refusiMissione e decisioniPazienti restano sul dispositivo (meta non va nel backup); "Stesso intervento" e "Scollega"
// cambiano le schede, che viaggiano con il backup.

const decisione = (k, scelta, schede, adesso) => [
  ...(stato.meta.decisioniPazienti ?? []), { missione: k, scelta, schede, quando: adesso.toISOString() },
];

async function scriviGruppo(schede, meta) {
  Object.assign(meta, modifiche(schede.length));
  await db.scrivi({ record: schede, meta });
  schede.forEach(sostituisci);
  Object.assign(stato.meta, meta);
  notifica();
}

/** "Stesso intervento": le schede della MISSIONE diventano un intervento con più pazienti, tante quanti sono le schede. */
export async function collegaMissione(missione, adesso = new Date()) {
  const k = chiaveMissione(missione);
  const schede = collegaGruppo(schedeDi(stato.record, k), adesso);
  await scriviGruppo(schede, {
    refusiMissione: (stato.meta.refusiMissione ?? []).filter((x) => x !== k),
    decisioniPazienti: decisione(k, 'stesso intervento', schede.length, adesso),
  });
}

/** "Refuso": la MISSIONE esce dalle decisioni da prendere su questo dispositivo; l'avviso "Missione duplicata" resta. */
export async function segnaRefuso(missione, adesso = new Date()) {
  const k = chiaveMissione(missione);
  await impostaMeta({
    refusiMissione: [...new Set([...(stato.meta.refusiMissione ?? []), k])],
    decisioniPazienti: decisione(k, 'refuso', schedeDi(stato.record, k).length, adesso),
  });
  notifica();
}

/** "Scollega": le schede tornano separate, con l'avviso "Missione duplicata", e la MISSIONE torna da decidere. */
export async function scollegaMissione(missione, adesso = new Date()) {
  const k = chiaveMissione(missione);
  const schede = scollegaGruppo(schedeDi(stato.record, k), adesso);
  await scriviGruppo(schede, {
    refusiMissione: (stato.meta.refusiMissione ?? []).filter((x) => x !== k), // anche se un tempo era stata segnata come refuso
    decisioniPazienti: decisione(k, 'scollegato', schede.length, adesso),
  });
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
