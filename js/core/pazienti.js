// Intervento con più pazienti: il gruppo di schede di una MISSIONE, la prima scheda e il collegamento. Nessuna dipendenza dal DOM.
//
// Una scheda per paziente, tutte con la stessa MISSIONE. Il gruppo è collegato (un intervento con più pazienti) se la
// sua prima scheda ha `pazienti` (il numero di pazienti); se no, due schede con la stessa MISSIONE sono un duplicato.

/** La chiave del gruppo: la MISSIONE senza spazi intorno, in maiuscolo. */
export const chiaveMissione = (m) => String(m ?? '').trim().toUpperCase();

const confronta = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Le schede dalla prima: `createdAt` crescente, a parità `id` crescente. L'ordine non dipende da chi le ha salvate,
 * quindi Mac e iPhone, dopo l'unione dei backup, vedono la stessa prima scheda. Restituisce una copia.
 */
export function ordinaSchede(schede) {
  return [...schede].sort((a, b) => confronta(String(a.createdAt ?? ''), String(b.createdAt ?? '')) || confronta(String(a.id), String(b.id)));
}

/** I gruppi delle MISSIONI, dalle schede non eliminate con la MISSIONE scritta: chiave -> schede dalla prima. */
export function gruppiMissione(records) {
  const gruppi = new Map();
  for (const r of records) {
    const k = chiaveMissione(r.missione);
    if (r.deleted || !k) continue;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(r);
  }
  for (const [k, schede] of gruppi) gruppi.set(k, ordinaSchede(schede));
  return gruppi;
}

/** Le schede non eliminate con questa MISSIONE, dalla prima, senza quella con id `escludi`. */
export function schedeDi(records, missione, { escludi = null } = {}) {
  const k = chiaveMissione(missione);
  if (!k) return [];
  return ordinaSchede(records.filter((r) => !r.deleted && r.id !== escludi && chiaveMissione(r.missione) === k));
}

export function primaScheda(records, missione, opzioni = {}) {
  return schedeDi(records, missione, opzioni)[0] ?? null;
}

/** La spunta "Paziente multiplo": c'è un numero di pazienti, anche sbagliato o cancellato. */
export const isMultiplo = (r) => r?.pazienti !== null && r?.pazienti !== undefined;

/** Un numero di pazienti che ha senso: intero, almeno 2. */
export const pazientiValidi = (r) => Number.isInteger(r?.pazienti) && r.pazienti >= 2;

/** Schede ordinate dalla prima: collegate se la prima ha la spunta. */
export const isCollegato = (schede) => schede.length > 0 && isMultiplo(schede[0]);

/**
 * Un'uscita vale 1: dei gruppi collegati (calcolati sui record passati) resta solo la prima scheda; le altre schede, i
 * duplicati non collegati e le schede senza MISSIONE restano tutti, nell'ordine di arrivo.
 */
export function unaPerMissione(records) {
  const prime = new Map();
  for (const [k, schede] of gruppiMissione(records)) if (isCollegato(schede)) prime.set(k, schede[0].id);
  return records.filter((r) => {
    const k = chiaveMissione(r.missione);
    return r.deleted || !prime.has(k) || prime.get(k) === r.id;
  });
}

/** "Stesso intervento": copie delle schede con il numero di pazienti uguale al numero di schede. */
export function collegaGruppo(schede, adesso) {
  return schede.map((r) => ({ ...r, pazienti: schede.length, updatedAt: adesso.toISOString() }));
}

/** "Scollega": copie delle schede senza numero di pazienti, cioè di nuovo un duplicato. */
export function scollegaGruppo(schede, adesso) {
  return schede.map((r) => ({ ...r, pazienti: null, updatedAt: adesso.toISOString() }));
}

/** Le altre schede del gruppo di `prima` con un numero di pazienti diverso, copiate con il suo: solo quelle che cambiano. */
export function propagaPazienti(prima, records, adesso) {
  return schedeDi(records, prima.missione, { escludi: prima.id })
    .filter((r) => r.pazienti !== prima.pazienti)
    .map((r) => ({ ...r, pazienti: prima.pazienti, updatedAt: adesso.toISOString() }));
}

// --- Le missioni registrate più volte: nessuna conversione automatica, decide l'utente nelle Impostazioni ---

const perMissione = (gruppi) => [...gruppi].map(([missione, schede]) => ({ missione, schede })).sort((a, b) => confronta(a.missione, b.missione));

/** Le MISSIONI con due o più schede e la prima senza spunta, tolte quelle segnate come refuso su questo dispositivo. */
export function gruppiDaDecidere(records, refusi = []) {
  return perMissione([...gruppiMissione(records)].filter(([k, schede]) => schede.length > 1 && !isCollegato(schede) && !refusi.includes(k)));
}

/** Gli interventi con più pazienti: le MISSIONI la cui prima scheda ha la spunta, anche con una scheda sola. */
export function gruppiCollegati(records) {
  return perMissione([...gruppiMissione(records)].filter(([, schede]) => isCollegato(schede)));
}
