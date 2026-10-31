// Controlli di qualità (colonna CONTROLLI dell'Excel) e regole di salvataggio.
import { isDataValida, isOraValida, minutiDaOra, isElicottero } from './campi.js';
import {
  chiaveMissione, gruppiMissione, schedeDi, primaScheda, ordinaSchede, isMultiplo, pazientiValidi, isCollegato,
} from './pazienti.js';

/**
 * Controlli del foglio "Voli" dell'Excel HEMS, più la convalida di TEMPO VOLO (intero 0–600) e il tempo diverso tra
 * le schede di un intervento con più pazienti (il tempo di volo è uno solo per missione).
 */
export const TIPI_AVVISO_VOLO = ['Tipo missione mancante', 'Tempo volo mancante', 'Tempo volo non valido', 'Tempo volo diverso tra le schede'];

/** Intervento con più pazienti: il numero di schede e il numero di pazienti dichiarato sulla prima. */
export const TIPI_AVVISO_PAZIENTI = [
  'Numero pazienti non valido', 'Schede in più rispetto ai pazienti', 'Mancano schede paziente', 'Numero pazienti diverso tra le schede',
];

/**
 * Nell'ordine in cui compaiono nella colonna CONTROLLI; "Età non valida", quelli dei pazienti e quelli di volo sono
 * aggiunti dall'app.
 */
export const TIPI_AVVISO = [
  'Ora allert. non valida',
  'Libero operativo non valido',
  'Data non valida',
  'Missione non di 8 caratteri',
  'Missione duplicata',
  ...TIPI_AVVISO_PAZIENTI,
  'Mezzo solo India',
  'Ospedale senza trasporto',
  'Età non valida',
  ...TIPI_AVVISO_VOLO,
];

export const MEZZI_SOLO_INDIA = ['3040', '5022', '5024'];

/** Mezzi che sono Mike in una fascia oraria (anche oltre la mezzanotte) e India nel resto della giornata. */
export const MEZZI_A_ORARIO = {
  '3050': { mikeDalle: '08:00', mikeAlle: '20:00' },
  '6021': { mikeDalle: '20:00', mikeAlle: '08:00' },
};

/** TIPOLOGIA che il mezzo impone: '' se non si può dire (mezzo vuoto, o 3050/6021 senza ora valida). */
export function tipologiaDelMezzo(mezzo, oraAllert) {
  if (!mezzo) return '';
  if (MEZZI_SOLO_INDIA.includes(mezzo)) return 'India';
  if (!Object.hasOwn(MEZZI_A_ORARIO, mezzo)) return 'Mike';
  if (!isOraValida(oraAllert)) return '';
  const orario = MEZZI_A_ORARIO[mezzo];
  const minuti = minutiDaOra(oraAllert);
  const dalle = minutiDaOra(orario.mikeDalle);
  const alle = minutiDaOra(orario.mikeAlle);
  const mike = dalle < alle ? minuti >= dalle && minuti < alle : minuti >= dalle || minuti < alle;
  return mike ? 'Mike' : 'India';
}

/** Le schede di ogni MISSIONE tra i record non eliminati, dalla prima (gruppiMissione): duplicati e pazienti multipli. */
export function indiceMissioni(records) {
  return gruppiMissione(records);
}

/** Avvisi non bloccanti di un record; `indice` viene da indiceMissioni() su tutto l'archivio. */
export function avvisi(r, indice) {
  const out = [];
  const schede = (r.missione && indice.get(chiaveMissione(r.missione))) || [];
  const prima = isCollegato(schede) ? schede[0] : null;
  if (r.oraAllert && !isOraValida(r.oraAllert)) out.push('Ora allert. non valida');
  if (r.liberoOperativo && !isOraValida(r.liberoOperativo)) out.push('Libero operativo non valido');
  if (r.data && !isDataValida(r.data)) out.push('Data non valida');
  if (r.missione && String(r.missione).length !== 8) out.push('Missione non di 8 caratteri');
  if (schede.length > 1 && !prima) out.push('Missione duplicata');
  // il numero cancellato (spunta accesa, campo vuoto) non è un avviso: lo ferma il salvataggio
  if (isMultiplo(r) && r.pazienti !== '' && !pazientiValidi(r)) out.push('Numero pazienti non valido');
  if (prima && pazientiValidi(prima) && schede.length > prima.pazienti) out.push('Schede in più rispetto ai pazienti');
  if (prima && pazientiValidi(prima) && schede.length < prima.pazienti) out.push('Mancano schede paziente');
  if (prima && r.pazienti !== prima.pazienti) out.push('Numero pazienti diverso tra le schede');
  if (MEZZI_SOLO_INDIA.includes(r.mezzo) && r.tipologia === 'Mike') out.push('Mezzo solo India');
  if (r.ospedale && r.esito !== 'Trasportato') out.push('Ospedale senza trasporto');
  if (r.eta !== null && r.eta !== undefined && (typeof r.eta !== 'number' || !Number.isInteger(r.eta) || r.eta < 0)) {
    out.push('Età non valida');
  }
  const tempo = r.tempoVolo ?? null;
  if (isElicottero(r.mezzo) && !r.tipoMissione) out.push('Tipo missione mancante');
  if (isElicottero(r.mezzo) && tempo === null) out.push('Tempo volo mancante');
  if (tempo !== null && !(Number.isInteger(tempo) && tempo >= 0 && tempo <= 600)) out.push('Tempo volo non valido');
  // il tempo di volo conta una volta per missione, dalla prima scheda
  const tempoPrima = prima?.tempoVolo ?? null;
  if (prima && prima.id !== r.id && isElicottero(r.mezzo) && typeof tempo === 'number' && typeof tempoPrima === 'number'
    && tempo !== tempoPrima) out.push('Tempo volo diverso tra le schede');
  return out;
}

const altreSchede = (n) => (n === 1 ? '1 altra scheda' : `${n} altre schede`);

/**
 * Regole bloccanti al salvataggio. `originale` è la versione salvata (assente per un nuovo intervento).
 * La stessa MISSIONE di altre schede: se la prima scheda ha la spunta "Paziente multiplo" la scheda si collega
 * (`collegataA`, l'id della prima scheda), se no è un duplicato, che blocca solo se la MISSIONE è nuova o è stata
 * cambiata. La prima scheda di un gruppo collegato tiene MISSIONE e spunta finché ha altre schede (`bloccata`, quante).
 */
export function verificaSalvataggio(record, records, originale = null) {
  const errori = [];
  const missione = chiaveMissione(record.missione);
  if (!String(record.data ?? '').trim() && !missione) errori.push('Inserisci almeno DATA o MISSIONE.');
  let duplicatoDi = null;
  let collegataA = null;
  const altre = schedeDi(records, missione, { escludi: record.id });
  if (altre.length) {
    // la guardia sull'ordine vale per chi è già nel gruppo: una scheda nuova è sempre l'ultima (prende createdAt al
    // salvataggio), e una scheda che vi entra cambiando MISSIONE si collega anche se è più vecchia, e ne diventa la prima
    // con il numero ereditato
    const giaNelGruppo = originale !== null && chiaveMissione(originale.missione) === missione;
    const sarebbePrima = giaNelGruppo && ordinaSchede([...altre, record])[0].id === record.id;
    if (isCollegato(altre) && !sarebbePrima) collegataA = altre[0].id;
    else if (!originale || chiaveMissione(originale.missione) !== missione) {
      duplicatoDi = altre[0].id;
      errori.push(
        `La MISSIONE ${missione} è già registrata.`,
        'Se è un altro paziente dello stesso intervento, apri la prima scheda e attiva Paziente multiplo.',
      );
    }
  }
  let bloccata = 0;
  if (originale && isMultiplo(originale) && primaScheda(records, originale.missione)?.id === originale.id) {
    bloccata = schedeDi(records, originale.missione, { escludi: originale.id }).length;
  }
  if (bloccata && chiaveMissione(originale.missione) !== missione) {
    errori.push(`Questa scheda è collegata a ${altreSchede(bloccata)}: la MISSIONE non si può cambiare.`);
  }
  if (bloccata && !isMultiplo(record)) errori.push(`Questa scheda è collegata a ${altreSchede(bloccata)}: Paziente multiplo resta attivo.`);
  if (record.pazienti === '') errori.push('Scrivi il numero di pazienti, oppure togli Paziente multiplo.');
  return { ok: errori.length === 0, errori, duplicatoDi, collegataA, bloccata };
}
