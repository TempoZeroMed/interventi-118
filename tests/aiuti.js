// Utilità condivise dai test: non fanno parte dell'app.
import { existsSync, readFileSync } from 'node:fs';

export const IMPORT = new URL('../data/interventi_import.json', import.meta.url);
export const ATTESE = new URL('../data/statistiche_attese.json', import.meta.url);

export const datiReali = existsSync(IMPORT) && existsSync(ATTESE);
export const motivoSkip = datiReali ? false
  : 'mancano i dati reali in data/: esegui tools/xlsx_to_json.py e tools/attese_statistiche.py';

export const leggiJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

/** Differenze tra due valori JSON, con tolleranza sui numeri. Restituisce un elenco di percorsi. */
export function differenze(attuale, atteso, percorso = '$', tolleranza = 1e-9) {
  if (typeof atteso === 'number' && typeof attuale === 'number') {
    return Math.abs(attuale - atteso) <= tolleranza ? [] : [`${percorso}: ${attuale} invece di ${atteso}`];
  }
  if (atteso === null || typeof atteso !== 'object') {
    return attuale === atteso ? [] : [`${percorso}: ${JSON.stringify(attuale)} invece di ${JSON.stringify(atteso)}`];
  }
  if (attuale === null || typeof attuale !== 'object' || Array.isArray(attuale) !== Array.isArray(atteso)) {
    return [`${percorso}: ${JSON.stringify(attuale)} invece di un ${Array.isArray(atteso) ? 'elenco' : 'oggetto'}`];
  }
  const chiavi = new Set([...Object.keys(atteso), ...Object.keys(attuale)]);
  return [...chiavi].flatMap((k) => differenze(attuale[k], atteso[k], `${percorso}.${k}`, tolleranza));
}
