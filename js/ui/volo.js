// Vista "Volo" delle statistiche: KPI, 3 grafici e 5 tabelle di volo del foglio "Statistiche" dell'Excel HEMS.
import { MEZZI_ELICOTTERO } from '../core/campi.js';
import { h, conteggio, numero, pct, pctGia, oreMinuti } from './dom.js';
import { colore, configBarre, schedaGrafico, tabella, unita, voceKpi } from './statistiche.js';

const missioni = (n) => `${conteggio(n)} ${n === 1 ? 'missione' : 'missioni'}`;
const elicotteri = `${MEZZI_ELICOTTERO.slice(0, -1).join(', ')} o ${MEZZI_ELICOTTERO.at(-1)}`;

function kpi(s) {
  const k = s.kpi;
  return h('dl', { class: 'kpi quattro' },
    voceKpi('Missioni', [conteggio(k.missioni)], k.perMezzo.map((m) => `${m.voce} ${conteggio(m.n)}`).join(' · ')),
    voceKpi('Ore di volo', [oreMinuti(k.minutiVolo)], `su ${missioni(k.conTempo)} con tempo`),
    voceKpi('Volo medio', [numero(k.voloMedio), unita('min')], k.voloMediana === null ? null : `mediana ${numero(k.voloMediana)} min`),
    voceKpi('Con manovre', [conteggio(k.conManovre)], `${pctGia(k.conManovrePct)} delle missioni`),
  );
}

function grafici(s, tele) {
  const ink = colore('--inchiostro');
  return [
    schedaGrafico(tele, 'Ore di volo per mese', 'Ore di volo nel mese; tra parentesi le missioni.',
      configBarre({
        etichette: s.mesi.map((m) => `${m.voce} (${m.missioni})`),
        serie: [{ label: 'Ore di volo', data: s.mesi.map((m) => m.oreGrafico), backgroundColor: ink }],
        asse: 'numero',
      })),
    schedaGrafico(tele, 'Manovre', '% delle missioni in elicottero; tra parentesi il numero.',
      configBarre({
        etichette: s.manovre.voci.map((m) => `${m.codice} (${m.n})`),
        serie: [{ label: 'Missioni', data: s.manovre.voci.map((m) => m.pct * 100), backgroundColor: ink }],
        orizzontale: true,
      })),
    schedaGrafico(tele, 'Missioni per mezzo', 'Numero di missioni.',
      configBarre({
        etichette: s.mezzi.map((m) => m.voce),
        serie: [{ label: 'Missioni', data: s.mezzi.map((m) => m.n), backgroundColor: ink }],
        asse: 'numero',
      })),
  ];
}

function tabelle(s) {
  const t = s.tempo;
  const voce = (titolo) => [titolo, (x) => x.voce];
  const n = (titolo = 'Missioni', k = 'n') => [titolo, (x) => (x[k] === null ? '' : conteggio(x[k])), true];
  const p = (titolo = '%') => [titolo, (x) => (x.pct === null ? '' : pct(x.pct)), true];
  const ore = ['Ore volo', (x) => (x.minutiVolo === null ? '' : oreMinuti(x.minutiVolo)), true];
  const medio = ['Volo medio (min)', (x) => numero(x.voloMedio), true];
  const vuota = (k = 'n') => (x) => !x[k];
  return [
    tabella('V1 · Tempo di volo',
      `Base: ${missioni(s.basi.conTempo)} con tempo di volo. Comprende il rientro in base: può superare la durata della missione.`,
      [voce('Indicatore'), ['Valore', (x) => x.v, true]], [
        { voce: 'Totale (ore:minuti)', v: oreMinuti(t.totaleMinuti) },
        { voce: 'Media (min)', v: numero(t.media) },
        { voce: 'Mediana (min)', v: numero(t.mediana) },
        { voce: 'Minimo (min)', v: numero(t.minimo) },
        { voce: 'Massimo (min)', v: numero(t.massimo) },
      ], { aperta: true }),
    tabella('V2 · Per mezzo', '% sulle missioni in elicottero · volo medio sulle missioni con tempo.',
      [voce('Mezzo'), n(), p(), ore, medio, n('Con tempo', 'conTempo')], s.mezzi, { zero: vuota() }),
    tabella('V3 · Tipo di missione', '% sulle missioni con il tipo compilato.',
      [voce('Tipo'), n(), p(), ore],
      [...s.tipi.voci, { voce: 'Non compilato', n: s.tipi.nonCompilato, pct: null, minutiVolo: null }], { zero: vuota() }),
    tabella('V4 · Manovre', '% sulle missioni in elicottero. Una missione può avere più manovre.',
      [voce('Manovra'), n(), p()], [
        ...s.manovre.voci.map((m) => ({ voce: `${m.codice} · ${m.nome}`, n: m.n, pct: m.pct })),
        { voce: 'Almeno una manovra', ...s.manovre.almenoUna },
        { voce: 'Più di una manovra', ...s.manovre.piuDiUna },
        { voce: 'Nessuna manovra', ...s.manovre.nessuna },
      ], { zero: vuota() }),
    tabella('V5 · Per mese', null,
      [voce('Mese'), n('Missioni', 'missioni'), ore, medio, n('Con manovre', 'conManovre')], s.mesi, { zero: vuota('missioni') }),
  ];
}

/** La vista intera, oppure il messaggio se nel periodo non ci sono missioni in elicottero. */
export function disegnaVolo(s, tele) {
  if (!s.basi.missioni) {
    return h('div', { class: 'vuoto-stato' },
      h('h2', {}, 'Nessuna missione in elicottero in questo periodo'),
      h('p', {}, `La vista Volo conta gli interventi con mezzo ${elicotteri}. Scegli un altro anno, mese o intervallo.`));
  }
  return h('div', {},
    kpi(s),
    h('div', { class: 'grafici' }, ...grafici(s, tele)),
    h('h2', { class: 'titolo-dettagli' }, 'Dettagli'),
    h('div', { class: 'tabelle' }, ...tabelle(s)));
}
