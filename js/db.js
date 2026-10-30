// IndexedDB: interventi, liste e metadati. Tutto resta sul dispositivo.

const NOME = 'interventi118';
const VERSIONE = 1;

let promessa = null;

function apri() {
  promessa ??= new Promise((risolvi, rifiuta) => {
    const richiesta = indexedDB.open(NOME, VERSIONE);
    richiesta.onupgradeneeded = () => {
      const db = richiesta.result;
      if (!db.objectStoreNames.contains('record')) db.createObjectStore('record', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('liste')) db.createObjectStore('liste', { keyPath: 'nome' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'chiave' });
    };
    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => rifiuta(richiesta.error);
    richiesta.onblocked = () => rifiuta(new Error('Archivio bloccato da un\'altra finestra dell\'app: chiudila e riprova.'));
  });
  return promessa;
}

const esito = (req) => new Promise((risolvi, rifiuta) => {
  req.onsuccess = () => risolvi(req.result);
  req.onerror = () => rifiuta(req.error);
});

const fine = (tx) => new Promise((risolvi, rifiuta) => {
  tx.oncomplete = () => risolvi();
  tx.onerror = () => rifiuta(tx.error);
  tx.onabort = () => rifiuta(tx.error ?? new Error('Scrittura annullata.'));
});

export async function leggiTutto() {
  const db = await apri();
  const tx = db.transaction(['record', 'liste', 'meta'], 'readonly');
  const [record, liste, meta] = await Promise.all([
    esito(tx.objectStore('record').getAll()),
    esito(tx.objectStore('liste').getAll()),
    esito(tx.objectStore('meta').getAll()),
  ]);
  return {
    record,
    liste: Object.fromEntries(liste.map((l) => [l.nome, l.voci])),
    meta: Object.fromEntries(meta.map((m) => [m.chiave, m.valore])),
  };
}

/** Scrive record, liste e metadati in un'unica transazione: o tutto o niente. */
export async function scrivi({ record = [], liste = null, meta = {} } = {}) {
  const db = await apri();
  const tx = db.transaction(['record', 'liste', 'meta'], 'readwrite');
  const negozioRecord = tx.objectStore('record');
  for (const r of record) negozioRecord.put(r);
  if (liste) for (const [nome, voci] of Object.entries(liste)) tx.objectStore('liste').put({ nome, voci });
  for (const [chiave, valore] of Object.entries(meta)) tx.objectStore('meta').put({ chiave, valore });
  await fine(tx);
}
