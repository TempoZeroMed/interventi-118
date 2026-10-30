// Salvataggio dei file (backup, Excel) e caricamento delle librerie locali di vendor/.
import { isIOS } from '../stato.js';

/**
 * Su iPhone apre il foglio di condivisione (da lì "Salva su File" → iCloud Drive),
 * sul Mac scarica il file. Risolve 'condiviso', 'scaricato' o 'annullato'.
 */
export async function salvaFile(blob, nome) {
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
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'scaricato';
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
