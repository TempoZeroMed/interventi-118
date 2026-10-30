// Salvataggio dei file (backup, Excel) e caricamento delle librerie locali di vendor/.
import { isIOS, stato, impostaMeta } from '../stato.js';

/**
 * Su iPhone apre il foglio di condivisione (da lì "Salva su File" → iCloud Drive).
 * Dove il browser offre la finestra di salvataggio (Chrome, Edge) la usa e, con `ricordo`
 * (chiave dei metadati: 'fileBackup', 'fileExcel'), ricorda il file per riscriverlo le volte dopo.
 * Altrove scarica il file. Risolve 'condiviso', 'salvato', 'scaricato' o 'annullato'.
 */
export async function salvaFile(blob, nome, { ricordo } = {}) {
  const file = new File([blob], nome, { type: blob.type });
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return 'condiviso';
    } catch (errore) {
      if (errore.name === 'AbortError') return 'annullato';
      throw errore;
    }
  }
  if (typeof globalThis.showSaveFilePicker === 'function') {
    return salvaConFinestra(blob, nome, {
      ricordato: ricordo ? stato.meta[ricordo] : null,
      ricorda: ricordo ? (file) => impostaMeta({ [ricordo]: file }) : null,
      finestra: (opzioni) => globalThis.showSaveFilePicker(opzioni),
    });
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'scaricato';
}

async function scrivi(file, blob) {
  const scrittura = await file.createWritable();
  await scrittura.write(blob);
  await scrittura.close();
}

/**
 * Riscrive il file ricordato se il browser lo permette; se non c'è più o il permesso manca,
 * riapre la finestra di salvataggio senza avvisi e ricorda la nuova scelta.
 */
export async function salvaConFinestra(blob, nome, { ricordato, ricorda, finestra }) {
  if (ricordato) {
    try {
      if (await ricordato.requestPermission({ mode: 'readwrite' }) === 'granted') {
        await scrivi(ricordato, blob);
        return 'salvato';
      }
    } catch {
      // file spostato o cancellato, permesso negato: si sceglie di nuovo
    }
  }
  const estensione = nome.slice(nome.lastIndexOf('.'));
  let file;
  try {
    file = await finestra({
      suggestedName: nome,
      ...(blob.type ? { types: [{ description: nome, accept: { [blob.type]: [estensione] } }] } : {}),
    });
  } catch (errore) {
    if (errore.name === 'AbortError') return 'annullato';
    throw errore;
  }
  await scrivi(file, blob);
  if (ricorda) await ricorda(file);
  return 'salvato';
}

const caricati = new Map();

/** Carica una libreria di vendor/ come script classico (una sola volta). */
export function caricaScript(src) {
  if (!caricati.has(src)) {
    caricati.set(src, new Promise((risolvi, rifiuta) => {
      const s = Object.assign(document.createElement('script'), { src, async: true });
      s.onload = () => risolvi();
      s.onerror = () => {
        caricati.delete(src);
        rifiuta(new Error(`Impossibile caricare ${src}.`));
      };
      document.head.append(s);
    }));
  }
  return caricati.get(src);
}

export const CHART = 'vendor/chart-4.5.1.umd.min.js';
export const SHEETJS = 'vendor/xlsx-0.20.3.full.min.js';
export const CARTELLA_TESSERACT = 'vendor/tesseract-7.0.0/';
export const TESSERACT = 'vendor/tesseract-7.0.0/tesseract.min.js';
