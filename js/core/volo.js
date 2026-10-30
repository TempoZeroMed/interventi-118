// Statistiche di volo: le tabelle di volo del foglio "Statistiche" dell'Excel HEMS, sugli elicotteri del periodo.
// Percentuali e medie sono frazioni non arrotondate (come nelle celle Excel), tranne i KPI,
// che riportano i numeri delle scritte della dashboard.
import { MANOVRE, MEZZI_ELICOTTERO, isDataValida, isElicottero } from './campi.js';
import { arrotondaExcel, filtraPeriodo, media, mediana, mesiDelPeriodo, NOMI_MESI, vociTabella } from './statistiche.js';

const div = (a, b) => (b ? a / b : 0);
const somma = (v) => v.reduce((s, x) => s + x, 0);
/** COUNT(TEMPO VOLO): solo i tempi numerici; un record salvato prima dei campi di volo non ne ha. */
const tempi = (missioni) => missioni.map((r) => r.tempoVolo).filter((t) => typeof t === 'number');
const numeroManovre = (r) => (r.manovre ?? []).length;

/** Colonne "Ore volo", "Volo medio" e "Con tempo" di un gruppo di missioni. */
function volo(missioni) {
  const t = tempi(missioni);
  return { minutiVolo: somma(t), voloMedio: media(t), conTempo: t.length };
}

export function calcolaStatisticheVolo(records, liste, periodo = { tipo: 'tutto' }) {
  const missioni = filtraPeriodo(records, periodo).filter((r) => isElicottero(r.mezzo));
  const totali = missioni.length;
  const t = tempi(missioni);
  const quota = (n) => ({ n, pct: div(n, totali) });
  const conManovre = missioni.filter((r) => numeroManovre(r) > 0).length;

  const mezzi = MEZZI_ELICOTTERO.map((voce) => {
    const delMezzo = missioni.filter((r) => r.mezzo === voce);
    return { voce, n: delMezzo.length, pct: div(delMezzo.length, totali), ...volo(delMezzo) };
  });

  const tipiUsati = missioni.map((r) => r.tipoMissione ?? '');
  const compilati = tipiUsati.filter((v) => v !== '').length;
  const tipi = vociTabella(liste.tipoMissione, tipiUsati).map((voce) => {
    const delTipo = missioni.filter((r) => r.tipoMissione === voce);
    return { voce, n: delTipo.length, pct: div(delTipo.length, compilati), minutiVolo: volo(delTipo).minutiVolo };
  });

  const chiaviMesi = mesiDelPeriodo(periodo, missioni);
  const piuAnni = new Set(chiaviMesi.map((k) => k.slice(0, 4))).size > 1;
  const mesi = chiaviMesi.map((chiave) => {
    const delMese = missioni.filter((r) => isDataValida(r.data) && r.data.startsWith(`${chiave}-`));
    const nome = NOMI_MESI[Number(chiave.slice(5, 7)) - 1];
    const { minutiVolo, voloMedio } = volo(delMese);
    return {
      chiave, voce: piuAnni ? `${nome} ${chiave.slice(0, 4)}` : nome,
      missioni: delMese.length, minutiVolo, voloMedio,
      conManovre: delMese.filter((r) => numeroManovre(r) > 0).length,
      oreGrafico: arrotondaExcel(minutiVolo / 60, 1),
    };
  });

  return {
    basi: { missioni: totali, conTempo: t.length },
    kpi: {
      missioni: totali, perMezzo: mezzi.map(({ voce, n }) => ({ voce, n })),
      minutiVolo: somma(t), conTempo: t.length,
      voloMedio: t.length ? arrotondaExcel(media(t), 1) : null, voloMediana: mediana(t),
      conManovre, conManovrePct: arrotondaExcel(div(conManovre, totali) * 100, 0),
    },
    tempo: {
      totaleMinuti: somma(t), media: media(t), mediana: mediana(t),
      minimo: t.length ? Math.min(...t) : null, massimo: t.length ? Math.max(...t) : null,
    },
    mezzi,
    tipi: { voci: tipi, nonCompilato: totali - compilati },
    manovre: {
      voci: MANOVRE.map(({ codice, nome }) => ({
        codice, nome, ...quota(missioni.filter((r) => (r.manovre ?? []).includes(codice)).length),
      })),
      almenoUna: quota(conManovre),
      piuDiUna: quota(missioni.filter((r) => numeroManovre(r) > 1).length),
      nessuna: quota(missioni.filter((r) => numeroManovre(r) === 0).length),
    },
    mesi,
  };
}
