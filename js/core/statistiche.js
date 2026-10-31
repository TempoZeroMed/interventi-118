// KPI e 12 tabelle del foglio "Statistiche", ricalcolati su un periodo.
// Le percentuali sono frazioni non arrotondate (come nelle celle Excel), tranne i KPI,
// che riportano i numeri già arrotondati delle scritte della dashboard.
import { calcolati } from './calcolati.js';
import { isDataValida } from './campi.js';
import { avvisi, indiceMissioni, TIPI_AVVISO } from './controlli.js';
import { unaPerMissione, gruppiMissione, isCollegato } from './pazienti.js';

export const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
export const FASCE_ETA = [['0–17', 0, 17], ['18–40', 18, 40], ['41–65', 41, 65], ['66–80', 66, 80], ['oltre 80', 81, 200]];
export const ANNULLATI = ['Annullato da CO', 'Non Raggiungibile'];

/** ROUND di Excel: metà lontano da zero, sul valore a 15 cifre significative. */
export function arrotondaExcel(x, cifre = 0) {
  const sposta = (n, di) => {
    const [mantissa, esponente = '0'] = String(n).split('e');
    return Number(`${mantissa}e${Number(esponente) + di}`);
  };
  const arrotondato = Math.round(sposta(Number(Math.abs(x).toPrecision(15)), cifre));
  return Math.sign(x) * sposta(arrotondato, -cifre);
}

const div = (a, b) => (b ? a / b : 0); // IFERROR(a/b, 0)
export const media = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const mediaArrotondata = (v, cifre) => (v.length ? arrotondaExcel(media(v), cifre) : null);
export function mediana(v) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
const due = (n) => String(n).padStart(2, '0');

/** Un intervento conta se non è eliminato e ha DATA o MISSIONE. */
export function isIntervento(r) {
  return !r.deleted && (String(r.data ?? '').trim() !== '' || String(r.missione ?? '').trim() !== '');
}

/**
 * periodo: { tipo: 'tutto' } | { tipo: 'anno', anno } | { tipo: 'mese', anno, mese } | { tipo: 'intervallo', da, a }
 * Con un periodo diverso da "tutto" contano solo le righe con una DATA valida.
 */
export function filtraPeriodo(records, periodo) {
  const interventi = records.filter(isIntervento);
  if (!periodo || periodo.tipo === 'tutto') return interventi;
  const [da, a] = estremi(periodo);
  return interventi.filter((r) => isDataValida(r.data) && r.data >= da && r.data <= a);
}

function estremi(periodo) {
  if (periodo.tipo === 'anno') return [`${periodo.anno}-01-01`, `${periodo.anno}-12-31`];
  if (periodo.tipo === 'mese') return [`${periodo.anno}-${due(periodo.mese)}-01`, `${periodo.anno}-${due(periodo.mese)}-31`];
  return [periodo.da || '0000-01-01', periodo.a || '9999-12-31'];
}

/** Mesi (AAAA-MM) da mostrare nella tabella 8 per il periodo. */
export function mesiDelPeriodo(periodo, selezione) {
  const date = selezione.map((r) => r.data).filter(isDataValida).sort();
  let primo;
  let ultimo;
  if (periodo.tipo === 'anno') [primo, ultimo] = [`${periodo.anno}-01`, `${periodo.anno}-12`];
  else if (periodo.tipo === 'mese') primo = ultimo = `${periodo.anno}-${due(periodo.mese)}`;
  else if (periodo.tipo === 'intervallo') {
    primo = (periodo.da || date[0] || '').slice(0, 7);
    ultimo = (periodo.a || date.at(-1) || '').slice(0, 7);
  } else if (date.length) [primo, ultimo] = [`${date[0].slice(0, 4)}-01`, `${date.at(-1).slice(0, 4)}-12`];
  if (!primo || !ultimo) return [];
  const mesi = [];
  let [anno, mese] = primo.split('-').map(Number);
  while (`${anno}-${due(mese)}` <= ultimo) {
    mesi.push(`${anno}-${due(mese)}`);
    if (++mese > 12) [anno, mese] = [anno + 1, 1];
  }
  return mesi;
}

/** Voci di una lista da mostrare: attive sempre, disattivate se usate, valori fuori lista in fondo. */
export function vociTabella(lista, valoriUsati) {
  const usati = new Set(valoriUsati.filter((v) => v !== ''));
  const voci = (lista ?? []).filter((v) => v.attiva || usati.has(v.voce)).map((v) => v.voce);
  const note = new Set((lista ?? []).map((v) => v.voce));
  return [...voci, ...[...usati].filter((v) => !note.has(v))];
}

/**
 * Un'uscita vale 1: di un intervento con più pazienti (schede collegate) contano una volta, dalla prima scheda, gli
 * interventi, la tipologia, il mezzo, l'ora, il mese e la durata (`missioni`); i pazienti, cioè codici, patologie,
 * luoghi, esiti, ospedali, età, sesso e avvisi, si contano scheda per scheda (`righe`), e le loro percentuali che l'Excel
 * divide per gli interventi qui si dividono per le schede. Senza interventi multipli schede e interventi coincidono.
 */
export function calcolaStatistiche(records, liste, periodo = { tipo: 'tutto' }) {
  const indice = indiceMissioni(records); // i duplicati si cercano in tutto l'archivio
  const selezione = filtraPeriodo(records, periodo);
  const righe = selezione.map((r) => ({ r, c: calcolati(r), avvisi: avvisi(r, indice) }));
  const unaPerUscita = new Set(unaPerMissione(selezione).map((r) => r.id));
  const missioni = righe.filter(({ r }) => unaPerUscita.has(r.id));
  const conta = (cond) => righe.filter(cond).length;
  const campo = (k, valore) => conta(({ r }) => r[k] === valore);
  const contaMissioni = (cond) => missioni.filter(cond).length;
  const collegati = [...gruppiMissione(selezione).values()].filter(isCollegato);

  const totali = missioni.length;
  const schede = righe.length;
  const annullati = conta(({ r }) => ANNULLATI.includes(r.esito));
  const valutati = schede - annullati;
  const trasportati = campo('esito', 'Trasportato');
  const deceduti = campo('esito', 'Deceduto');
  const maschi = campo('sesso', 'Maschio');
  const femmine = campo('sesso', 'Femmina');
  const india = contaMissioni(({ r }) => r.tipologia === 'India');
  const mike = contaMissioni(({ r }) => r.tipologia === 'Mike');
  const eta = righe.map(({ r }) => r.eta).filter((e) => typeof e === 'number');
  const durate = missioni.map(({ c }) => c.durata).filter((d) => d !== null);
  const conAvvisi = conta(({ avvisi: a }) => a.length > 0);
  const multipli = collegati.length;
  const pazientiMultipli = collegati.reduce((n, schedeDelGruppo) => n + schedeDelGruppo.length, 0);

  const riepilogo = {
    totali, schede, multipli, pazientiMultipli, annullati, annullatiPct: div(annullati, schede), valutati,
    trasportati, trasportatiPct: div(trasportati, valutati), deceduti, decedutiPct: div(deceduti, valutati),
    maschi, maschiPct: div(maschi, valutati), femmine, femminePct: div(femmine, valutati),
    india, indiaPct: div(india, totali), mike, mikePct: div(mike, totali),
    etaMedia: mediaArrotondata(eta, 1), etaMediana: mediana(eta),
    etaMin: eta.length ? Math.min(...eta) : null, etaMax: eta.length ? Math.max(...eta) : null,
    durataMedia: mediaArrotondata(durate, 0), durataMediana: mediana(durate),
    durataMax: durate.length ? Math.max(...durate) : null,
  };

  const rossiRientro = campo('codiceRientro', 'ROSSO');
  const rossiInvio = campo('codiceInvio', 'ROSSO');
  const kpi = {
    interventi: totali, multipli, valutati, annullati, annullatiPct: arrotondaExcel(div(annullati, schede) * 100, 1),
    trasportati, trasportatiPct: arrotondaExcel(div(trasportati, valutati) * 100, 0),
    deceduti, decedutiPct: arrotondaExcel(div(deceduti, valutati) * 100, 1),
    rossiRientro, rossiRientroPct: arrotondaExcel(div(rossiRientro, valutati) * 100, 0),
    rossiInvio, rossiInvioPct: arrotondaExcel(div(rossiInvio, schede) * 100, 0),
    neri: campo('codiceRientro', 'NERO'),
    durataMediana: riepilogo.durataMediana, durataMedia: riepilogo.durataMedia, durataMax: riepilogo.durataMax,
    etaMediana: riepilogo.etaMediana,
    maschiPct: arrotondaExcel(div(maschi, valutati) * 100, 0), femminePct: arrotondaExcel(div(femmine, valutati) * 100, 0),
    avvisi: conAvvisi, avvisiPct: arrotondaExcel(div(conAvvisi, schede) * 100, 1),
  };

  const codiciInvio = (liste.codiceInvio ?? []).map((v) => v.voce);
  const codiciRientro = (liste.codiceRientro ?? []).map((v) => v.voce);
  const codici = codiciRientro.map((voce) => {
    const invio = codiciInvio.includes(voce) ? campo('codiceInvio', voce) : null;
    const rientro = campo('codiceRientro', voce);
    return { voce, invio, invioPct: invio === null ? null : div(invio, schede), rientro, rientroPct: div(rientro, valutati) };
  });
  const matrice = codiciInvio.map((invio) => {
    const celle = Object.fromEntries(codiciRientro.map((rientro) => [
      rientro, conta(({ r }) => r.codiceInvio === invio && r.codiceRientro === rientro),
    ]));
    return { invio, celle, totale: Object.values(celle).reduce((s, n) => s + n, 0) };
  });
  const piuGrave = conta(({ c }) => c.delta !== null && c.delta > 0);
  const invariato = conta(({ c }) => c.delta === 0);
  const menoGrave = conta(({ c }) => c.delta !== null && c.delta < 0);
  const confrontati = piuGrave + invariato + menoGrave;

  const doppia = (lista, kInvio, kRientro) => vociTabella(lista, righe.flatMap(({ r }) => [r[kInvio], r[kRientro]]))
    .map((voce) => {
      const invio = campo(kInvio, voce);
      const rientro = campo(kRientro, voce);
      return { voce, invio, invioPct: div(invio, schede), rientro, rientroPct: div(rientro, valutati) };
    });
  const semplice = (lista, k, base) => vociTabella(lista, righe.map(({ r }) => r[k]))
    .map((voce) => ({ voce, n: campo(k, voce), pct: div(campo(k, voce), base) }));

  const chiaviMesi = mesiDelPeriodo(periodo, righe.map(({ r }) => r));
  const piuAnni = new Set(chiaviMesi.map((k) => k.slice(0, 4))).size > 1;
  const mesi = chiaviMesi.map((chiave) => {
    const delMese = ({ r }) => isDataValida(r.data) && r.data.startsWith(`${chiave}-`);
    const schedeDelMese = righe.filter(delMese);
    const missioniDelMese = missioni.filter(delMese);
    const nome = NOMI_MESI[Number(chiave.slice(5, 7)) - 1];
    return {
      chiave, voce: piuAnni ? `${nome} ${chiave.slice(0, 4)}` : nome,
      interventi: missioniDelMese.length,
      rossiInvio: schedeDelMese.filter(({ r }) => r.codiceInvio === 'ROSSO').length,
      trasportati: schedeDelMese.filter(({ r }) => r.esito === 'Trasportato').length,
      durataMedia: mediaArrotondata(missioniDelMese.map(({ c }) => c.durata).filter((d) => d !== null), 0),
    };
  });

  const mezzi = vociTabella(liste.mezzo, missioni.map(({ r }) => r.mezzo)).map((voce) => {
    const delMezzo = missioni.filter(({ r }) => r.mezzo === voce);
    return {
      voce, n: delMezzo.length, pct: div(delMezzo.length, totali),
      india: delMezzo.filter(({ r }) => r.tipologia === 'India').length,
      mike: delMezzo.filter(({ r }) => r.tipologia === 'Mike').length,
      durataMedia: mediaArrotondata(delMezzo.map(({ c }) => c.durata).filter((d) => d !== null), 0),
    };
  });

  return {
    kpi,
    riepilogo,
    codici,
    matrice,
    cambioCodice: {
      piuGrave, piuGravePct: div(piuGrave, confrontati), invariato, invariatoPct: div(invariato, confrontati),
      menoGrave, menoGravePct: div(menoGrave, confrontati),
    },
    patologia: doppia(liste.patologia, 'patologiaInvio', 'patologiaRientro'),
    luogo: doppia(liste.luogo, 'luogoInvio', 'luogoRientro'),
    esito: semplice(liste.esito, 'esito', schede),
    fasceEta: FASCE_ETA.map(([voce, da, a]) => {
      const n = eta.filter((e) => e >= da && e <= a).length;
      return { voce, n, pct: div(n, valutati) };
    }),
    mesi,
    ore: Array.from({ length: 24 }, (_, ora) => {
      const n = contaMissioni(({ c }) => c.ora === ora);
      return { voce: due(ora), n, pct: div(n, totali) };
    }),
    mezzi,
    ospedali: semplice(liste.ospedale, 'ospedale', trasportati),
    controlli: {
      righeConAvvisi: conAvvisi,
      perTipo: TIPI_AVVISO.map((voce) => ({ voce, n: conta(({ avvisi: a }) => a.includes(voce)) })),
    },
  };
}
