// Statistiche dal vivo su un periodo: KPI, 6 grafici e 12 tabelle del foglio "Statistiche".
import { stato, interventi } from '../stato.js';
import { calcolaStatistiche } from '../core/statistiche.js';
import { isDataValida } from '../core/campi.js';
import { h, riempi, icona, impostaBanda, codice, numero, conteggio, pct, pctGia, meseLungo, dataBreve } from './dom.js';
import { caricaScript, CHART } from './file.js';
import { impostaFiltri } from './elenco.js';

let periodo = null; // resta scelto finché l'app è aperta
let grafici = [];

const anniDisponibili = () => [...new Set(interventi().map((r) => r.data).filter(isDataValida).map((d) => Number(d.slice(0, 4))))]
  .sort((a, b) => b - a);

function descrizione(p) {
  if (p.tipo === 'anno') return `Anno ${p.anno}`;
  if (p.tipo === 'mese') return `${meseLungo(p.mese)} ${p.anno}`;
  if (p.tipo === 'intervallo') {
    if (p.da && p.a) return `Dal ${dataBreve(p.da)} al ${dataBreve(p.a)}`;
    if (p.da) return `Dal ${dataBreve(p.da)}`;
    if (p.a) return `Fino al ${dataBreve(p.a)}`;
    return 'Intervallo libero';
  }
  return 'Tutto l\'archivio';
}

export function mostra(main) {
  const anni = anniDisponibili();
  periodo ??= anni.length ? { tipo: 'anno', anno: anni[0] } : { tipo: 'tutto' };
  const contenuto = h('div');
  const selettore = h('div', { class: 'periodo' });

  function disegnaSelettore() {
    const segmenti = h('div', { class: 'segmenti', role: 'group', 'aria-label': 'Periodo' },
      ['anno', 'mese', 'intervallo', 'tutto'].map((tipo) => h('button', {
        type: 'button', 'aria-pressed': String(periodo.tipo === tipo),
        onclick: () => {
          const anno = anniDisponibili()[0] ?? new Date().getFullYear();
          const oggi = new Date();
          periodo = tipo === 'anno' ? { tipo, anno }
            : tipo === 'mese' ? { tipo, anno: oggi.getFullYear(), mese: oggi.getMonth() + 1 }
              : tipo === 'intervallo' ? { tipo, da: `${anno}-01-01`, a: '' } : { tipo: 'tutto' };
          disegnaSelettore();
          disegna();
        },
      }, { anno: 'Anno', mese: 'Mese', intervallo: 'Intervallo', tutto: 'Tutto' }[tipo])));
    const valori = [];
    if (periodo.tipo === 'anno') {
      const elenco = anniDisponibili();
      valori.push(h('select', { class: 'select', 'aria-label': 'Anno', onchange: (e) => { periodo.anno = Number(e.target.value); disegna(); } },
        (elenco.length ? elenco : [periodo.anno]).map((a) => h('option', { value: a, selected: a === periodo.anno }, a))));
    } else if (periodo.tipo === 'mese') {
      valori.push(h('input', {
        class: 'input', type: 'month', 'aria-label': 'Mese', value: `${periodo.anno}-${String(periodo.mese).padStart(2, '0')}`,
        onchange: (e) => { if (!e.target.value) return; [periodo.anno, periodo.mese] = e.target.value.split('-').map(Number); disegna(); },
      }));
    } else if (periodo.tipo === 'intervallo') {
      valori.push(
        h('label', {}, h('span', { class: 'etichetta' }, 'Dal'),
          h('input', { class: 'input', type: 'date', value: periodo.da, onchange: (e) => { periodo.da = e.target.value; disegna(); } })),
        h('label', {}, h('span', { class: 'etichetta' }, 'Al'),
          h('input', { class: 'input', type: 'date', value: periodo.a, onchange: (e) => { periodo.a = e.target.value; disegna(); } })),
      );
    }
    riempi(selettore, segmenti, valori.length ? h('div', { class: 'valori' }, valori) : null);
  }

  async function disegna() {
    impostaBanda('Statistiche', descrizione(periodo));
    grafici.forEach((g) => g.destroy());
    grafici = [];
    if (!interventi().length) {
      riempi(contenuto, h('div', { class: 'vuoto-stato' },
        h('h2', {}, 'Nessun dato da contare'),
        h('p', {}, 'Le statistiche si riempiono da sole man mano che registri gli interventi o importi un backup.'),
        h('a', { class: 'bottone primario', href: '#/nuovo' }, icona('piu'), 'Nuovo intervento')));
      return;
    }
    const s = calcolaStatistiche(stato.record, stato.liste, periodo);
    const tele = [];
    riempi(contenuto,
      kpi(s),
      s.kpi.interventi === 0
        ? h('div', { class: 'vuoto-stato' }, h('h2', {}, 'Nessun intervento in questo periodo'), h('p', {}, 'Scegli un altro anno, mese o intervallo.'))
        : h('div', {},
          h('div', { class: 'grafici' }, ...schedeGrafici(s, tele)),
          h('h2', { class: 'titolo-dettagli' }, 'Dettagli'),
          h('div', { class: 'tabelle' }, ...tabelle(s))),
    );
    if (!tele.length) return;
    try {
      await caricaScript(CHART);
      window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      tele.forEach(({ canvas, config }) => grafici.push(new window.Chart(canvas, config)));
    } catch (errore) {
      tele.forEach(({ canvas }) => canvas.replaceWith(h('p', { class: 'nota-tabella' }, `Grafico non disponibile: ${errore.message}`)));
    }
  }

  disegnaSelettore();
  main.append(selettore, contenuto);
  disegna();
  const tema = matchMedia('(prefers-color-scheme: dark)');
  const cambioTema = () => disegna();
  tema.addEventListener('change', cambioTema);
  return {
    aggiorna: disegna,
    async puoiUscire() {
      tema.removeEventListener('change', cambioTema);
      grafici.forEach((g) => g.destroy());
      grafici = [];
      return true;
    },
  };
}

// ---------------------------------------------------------------- KPI

function kpi(s) {
  const k = s.kpi;
  const voce = (titolo, valore, ...note) => h('div', {}, h('dt', {}, titolo), h('dd', {}, h('div', { class: 'valore' }, ...valore), ...note.filter(Boolean).map((n) => h('div', { class: 'nota' }, n))));
  const unita = (t) => h('span', { class: 'unita' }, t);
  return h('dl', { class: 'kpi' },
    voce('Interventi', [conteggio(k.interventi)], `${conteggio(k.valutati)} valutati`, `annullati: ${k.annullati} (${pctGia(k.annullatiPct)})`),
    voce('Trasportati', [conteggio(k.trasportati)], `${pctGia(k.trasportatiPct)} dei valutati`, `deceduti: ${k.deceduti} (${pctGia(k.decedutiPct)})`),
    voce('Rossi al rientro', [conteggio(k.rossiRientro), codice('ROSSO')], `${pctGia(k.rossiRientroPct)} dei valutati`,
      `all'invio: ${k.rossiInvio} (${pctGia(k.rossiInvioPct)}) · neri: ${k.neri}`),
    voce('Durata mediana', [numero(k.durataMediana), unita('min')], k.durataMedia === null ? null : `media ${numero(k.durataMedia)} · max ${numero(k.durataMax)}`),
    voce('Età mediana', [numero(k.etaMediana), unita('anni')], `${pctGia(k.maschiPct)} maschi · ${pctGia(k.femminePct)} femmine`),
    voce('Avvisi da controllare', [conteggio(k.avvisi), unita(k.avvisi === 1 ? 'riga' : 'righe')], `${pctGia(k.avvisiPct)} degli interventi`,
      k.avvisi ? h('a', { href: '#/elenco', onclick: () => impostaFiltri({ soloAvvisi: true, periodo: { ...periodo } }) }, 'Vedi nell\'elenco') : null),
  );
}

// ---------------------------------------------------------------- grafici

const colore = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
/** '#1b7a3e' -> 'rgba(27, 122, 62, 0.26)': Chart.js deve poter leggere il colore. */
function trasparente(hex, alfa) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
const percentuale = (v) => `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(v)}%`;

/** legenda: stili neutri per le voci della legenda (fill/stroke), quando i colori delle barre variano per voce. */
function configBarre({ etichette, serie, orizzontale = false, legenda = null, saltaEtichette = false }) {
  const testo = colore('--inchiostro-2');
  const griglia = colore('--linea');
  const assePct = { beginAtZero: true, grid: { color: griglia }, border: { display: false }, ticks: { color: testo, callback: (v) => percentuale(v) } };
  const asseVoci = { grid: { display: false }, border: { color: griglia }, ticks: { color: testo, autoSkip: saltaEtichette, maxRotation: saltaEtichette ? 0 : 50 } };
  return {
    type: 'bar',
    data: { labels: etichette, datasets: serie },
    options: {
      indexAxis: orizzontale ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
      scales: orizzontale ? { x: assePct, y: asseVoci } : { x: asseVoci, y: assePct },
      plugins: {
        legend: {
          display: serie.length > 1, position: 'bottom',
          labels: {
            color: testo, boxWidth: 14, boxHeight: 14,
            ...(legenda && {
              generateLabels: (grafico) => grafico.data.datasets.map((d, i) => ({
                text: d.label, fillStyle: legenda[i].fill, strokeStyle: legenda[i].stroke ?? legenda[i].fill,
                lineWidth: legenda[i].stroke ? 2 : 0, fontColor: testo, datasetIndex: i, hidden: !grafico.isDatasetVisible(i),
              })),
            }),
          },
        },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${percentuale(c.parsed[orizzontale ? 'x' : 'y'] ?? 0)}` } },
      },
    },
  };
}

function schedaGrafico(tele, titolo, legenda, config, classe = '') {
  const canvas = h('canvas', { role: 'img', 'aria-label': titolo });
  tele.push({ canvas, config });
  return h('figure', { class: `grafico ${classe}`, style: 'margin:0' }, h('h3', {}, titolo), h('figcaption', { class: 'legenda' }, legenda),
    h('div', { class: 'tela' }, canvas));
}

function schedeGrafici(s, tele) {
  const ink = colore('--inchiostro');
  const tinta = (c) => trasparente(c, 0.26);
  const coloreCodice = (v) => colore(`--${v.toLowerCase()}`);
  const totali = s.riepilogo.totali;
  const invio = { label: 'Invio · % su totali', borderWidth: 2 };
  const rientro = { label: 'Rientro · % su valutati', borderWidth: 0 };
  return [
    schedaGrafico(tele, 'Codice all\'invio e al rientro', 'Chiaro = invio (% sui totali) · pieno = rientro (% sui valutati); tra parentesi invio → rientro.',
      configBarre({
        etichette: s.codici.map((c) => `${c.voce} (${c.invio ?? '—'} → ${c.rientro})`),
        serie: [
          { ...invio, data: s.codici.map((c) => (c.invioPct === null ? null : c.invioPct * 100)),
            backgroundColor: s.codici.map((c) => tinta(coloreCodice(c.voce))), borderColor: s.codici.map((c) => coloreCodice(c.voce)) },
          { ...rientro, data: s.codici.map((c) => c.rientroPct * 100), backgroundColor: s.codici.map((c) => coloreCodice(c.voce)),
            borderWidth: 1.5, borderColor: s.codici.map((c) => (c.voce === 'NERO' ? colore('--linea-forte') : coloreCodice(c.voce))) },
        ],
        legenda: [{ fill: tinta(ink), stroke: ink }, { fill: ink }],
      })),
    schedaGrafico(tele, 'Esiti', '% sugli interventi totali; tra parentesi il numero.',
      configBarre({ etichette: s.esito.map((e) => `${e.voce} (${e.n})`), serie: [{ label: 'Esiti', data: s.esito.map((e) => e.pct * 100), backgroundColor: ink }], orizzontale: true })),
    schedaGrafico(tele, 'Interventi per mese', '% sugli interventi totali; tra parentesi il numero.',
      configBarre({ etichette: s.mesi.map((m) => `${m.voce} (${m.interventi})`), serie: [{ label: 'Interventi', data: s.mesi.map((m) => (totali ? (m.interventi / totali) * 100 : 0)), backgroundColor: ink }] })),
    schedaGrafico(tele, 'Ora di allertamento', '% sugli interventi totali; "08" = tra le 08:00 e le 08:59.',
      configBarre({ etichette: s.ore.map((o) => o.voce), serie: [{ label: 'Interventi', data: s.ore.map((o) => o.pct * 100), backgroundColor: ink }], saltaEtichette: true })),
    schedaGrafico(tele, 'Patologia all\'invio e al rientro', 'Chiaro = invio (% sui totali) · pieno = rientro (% sui valutati); tra parentesi invio / rientro.',
      configBarre({
        etichette: s.patologia.map((p) => `${p.voce} (${p.invio} / ${p.rientro})`),
        serie: [
          { ...invio, data: s.patologia.map((p) => p.invioPct * 100), backgroundColor: tinta(ink), borderColor: ink },
          { ...rientro, data: s.patologia.map((p) => p.rientroPct * 100), backgroundColor: ink },
        ],
        orizzontale: true,
      }), 'alto largo'),
    schedaGrafico(tele, 'Fasce di età', '% sui pazienti valutati; tra parentesi il numero.',
      configBarre({ etichette: s.fasceEta.map((f) => `${f.voce} (${f.n})`), serie: [{ label: 'Pazienti', data: s.fasceEta.map((f) => f.pct * 100), backgroundColor: ink }] })),
  ];
}

// ---------------------------------------------------------------- tabelle

/** colonne: [titolo, funzione(riga) -> contenuto, numerica?] */
function tabella(titolo, nota, colonne, righe, { aperta = false, piede = null, zero = null } = {}) {
  return h('details', { class: 'blocco-tabella', open: aperta },
    h('summary', {}, titolo),
    h('div', { class: 'scorri' }, h('table', { class: 'tabella' },
      h('thead', {}, h('tr', {}, colonne.map(([t, , n]) => h('th', { class: n ? 'n' : null, scope: 'col' }, t)))),
      h('tbody', {}, righe.map((r) => h('tr', { class: zero && zero(r) ? 'zero' : null },
        colonne.map(([, f, n]) => h('td', { class: n ? 'n' : null }, f(r)))))),
      piede && h('tfoot', {}, h('tr', {}, piede.map((v, i) => h('td', { class: i ? 'n' : null }, v)))))),
    nota && h('p', { class: 'nota-tabella' }, nota));
}

function tabelle(s) {
  const r = s.riepilogo;
  const voce = ['Voce', (x) => x.voce];
  const n = (k = 'n') => ['n', (x) => (x[k] === null ? '—' : conteggio(x[k])), true];
  const p = (k = 'pct', t = '%') => [t, (x) => pct(x[k]), true];
  const vuota = (k = 'n') => (x) => !x[k];
  const riepilogo = [
    { voce: 'Interventi totali', v: conteggio(r.totali), p: '' },
    { voce: 'Annullati / non raggiungibili', v: conteggio(r.annullati), p: pct(r.annullatiPct) },
    { voce: 'Pazienti valutati', v: conteggio(r.valutati), p: '' },
    { voce: 'Trasportati', v: conteggio(r.trasportati), p: pct(r.trasportatiPct) },
    { voce: 'Deceduti', v: conteggio(r.deceduti), p: pct(r.decedutiPct) },
    { voce: 'Maschi', v: conteggio(r.maschi), p: pct(r.maschiPct) },
    { voce: 'Femmine', v: conteggio(r.femmine), p: pct(r.femminePct) },
    { voce: 'India', v: conteggio(r.india), p: pct(r.indiaPct) },
    { voce: 'Mike', v: conteggio(r.mike), p: pct(r.mikePct) },
    { voce: 'Età media', v: numero(r.etaMedia), p: '' },
    { voce: 'Età mediana', v: numero(r.etaMediana), p: '' },
    { voce: 'Età min – max', v: r.etaMin === null ? '—' : `${numero(r.etaMin)} – ${numero(r.etaMax)}`, p: '' },
    { voce: 'Durata media (min)', v: numero(r.durataMedia), p: '' },
    { voce: 'Durata mediana (min)', v: numero(r.durataMediana), p: '' },
    { voce: 'Durata massima (min)', v: numero(r.durataMax), p: '' },
  ];
  const rientriCodici = Object.keys(s.matrice[0]?.celle ?? {});
  const cc = s.cambioCodice;
  return [
    tabella('1 · Riepilogo', '% annullati, India, Mike: sui totali · le altre: sui valutati.',
      [voce, ['Valore', (x) => x.v, true], ['%', (x) => x.p, true]], riepilogo, { aperta: true }),
    tabella('2 · Codice colore', '% invio sugli interventi totali · % rientro sui pazienti valutati.',
      [['Codice', (x) => codice(x.voce)], n('invio'), p('invioPct', '% invio'), n('rientro'), p('rientroPct', '% rientro')], s.codici, { aperta: true }),
    tabella('3 · Da invio a rientro', 'Invio sulle righe, rientro sulle colonne.',
      [['Invio ↓ rientro →', (x) => codice(x.invio)], ...rientriCodici.map((c) => [c, (x) => conteggio(x.celle[c]), true]),
        ['Totale', (x) => conteggio(x.totale), true]], s.matrice),
    tabella('3b · Il codice è cambiato?', 'Casi con entrambi i codici compilati, NERO escluso.',
      [['Rientro rispetto all\'invio', (x) => x.voce], ['n', (x) => conteggio(x.n), true], ['%', (x) => pct(x.pct), true]], [
        { voce: 'Più grave all\'arrivo', n: cc.piuGrave, pct: cc.piuGravePct },
        { voce: 'Invariato', n: cc.invariato, pct: cc.invariatoPct },
        { voce: 'Meno grave all\'arrivo', n: cc.menoGrave, pct: cc.menoGravePct },
      ]),
    tabella('4 · Patologia', '% invio sugli interventi totali · % rientro sui pazienti valutati.',
      [voce, n('invio'), p('invioPct', '% invio'), n('rientro'), p('rientroPct', '% rientro')], s.patologia, { zero: (x) => !x.invio && !x.rientro }),
    tabella('5 · Luogo', '% invio sugli interventi totali · % rientro sui pazienti valutati.',
      [voce, n('invio'), p('invioPct', '% invio'), n('rientro'), p('rientroPct', '% rientro')], s.luogo, { zero: (x) => !x.invio && !x.rientro }),
    tabella('6 · Esito', '% sugli interventi totali.', [['Esito', (x) => x.voce], n(), p()], s.esito, { zero: vuota() }),
    tabella('7 · Fasce di età', '% sui pazienti valutati.', [['Fascia', (x) => x.voce], n(), p()], s.fasceEta, { zero: vuota() }),
    tabella('8 · Andamento per mese', null,
      [['Mese', (x) => x.voce], ['Interventi', (x) => conteggio(x.interventi), true], ['Rossi invio', (x) => conteggio(x.rossiInvio), true],
        ['Trasportati', (x) => conteggio(x.trasportati), true], ['Durata media', (x) => numero(x.durataMedia), true]], s.mesi, { zero: vuota('interventi') }),
    tabella('9 · Ora del giorno', 'Ora 08 = allertamenti tra le 08:00 e le 08:59. % sugli interventi totali.',
      [['Ora', (x) => x.voce], n(), p()], s.ore, { zero: vuota() }),
    tabella('10 · Mezzo', '% sugli interventi totali.',
      [['Mezzo', (x) => x.voce], n(), p(), ['India', (x) => conteggio(x.india), true], ['Mike', (x) => conteggio(x.mike), true],
        ['Durata media', (x) => numero(x.durataMedia), true]], s.mezzi, { zero: vuota() }),
    tabella('11 · Ospedale di destinazione', '% sui soli trasportati.', [['Ospedale', (x) => x.voce], n(), p('pct', '% trasp.')], s.ospedali, { zero: vuota() }),
    tabella('12 · Controlli di qualità', 'Per trovarle: Elenco → Filtri → "Solo righe con avvisi".',
      [['Controllo', (x) => x.voce], ['Righe', (x) => conteggio(x.n), true]],
      [{ voce: 'Righe con almeno un avviso', n: s.controlli.righeConAvvisi }, ...s.controlli.perTipo], { zero: vuota() }),
  ];
}
