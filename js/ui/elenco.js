// Elenco cronologico con ricerca e filtri combinabili.
import { stato, interventi } from '../stato.js';
import { filtraElenco, ordinaRecenti } from '../core/elenco.js';
import { avvisi, indiceMissioni } from '../core/controlli.js';
import { isDataValida } from '../core/campi.js';
import { h, icona, impostaBanda, coppiaCodici, conteggio, meseLungo, meseBreve } from './dom.js';

// I filtri restano finché l'app è aperta, anche cambiando schermata.
const filtri = {
  testo: '', periodo: { tipo: 'tutto' }, mezzo: '', tipologia: '', codiceInvio: '', codiceRientro: '',
  patologia: '', esito: '', ospedale: '', soloAvvisi: false,
};
let filtriAperti = false;

/** Per aprire l'elenco già filtrato da un'altra schermata (es. "avvisi da controllare"). */
export function impostaFiltri(parziale) {
  Object.assign(filtri, parziale);
  filtriAperti = true;
}

const CAMPI_FILTRO = [
  ['mezzo', 'Mezzo', 'mezzo'], ['tipologia', 'Tipologia', 'tipologia'], ['codiceInvio', 'Codice invio', 'codiceInvio'],
  ['codiceRientro', 'Codice rientro', 'codiceRientro'], ['patologia', 'Patologia (invio o rientro)', 'patologia'],
  ['esito', 'Esito', 'esito'], ['ospedale', 'Ospedale', 'ospedale'],
];

const attivi = () => CAMPI_FILTRO.filter(([k]) => filtri[k]).length
  + (filtri.periodo.tipo !== 'tutto' ? 1 : 0) + (filtri.soloAvvisi ? 1 : 0);

export function mostra(main) {
  impostaBanda('Elenco', '');
  const risultati = h('div');
  const contatoreFiltri = h('span', { class: 'num' });

  const cerca = h('input', {
    class: 'input', type: 'search', placeholder: 'Missione o comune', value: filtri.testo, 'aria-label': 'Cerca per missione o comune',
    autocomplete: 'off', autocapitalize: 'characters', enterkeyhint: 'search',
    oninput: (e) => { filtri.testo = e.target.value; disegna(); },
  });

  const pannello = h('details', { class: 'filtri', open: filtriAperti, ontoggle: (e) => { filtriAperti = e.target.open; } },
    h('summary', {}, icona('filtri'), 'Filtri', contatoreFiltri),
    h('div', { class: 'griglia-filtri' }, ...controlliFiltri(() => disegna(), () => mostraDiNuovo())));

  function mostraDiNuovo() {
    main.replaceChildren();
    mostra(main);
  }

  function disegna() {
    const tutti = interventi();
    const n = attivi();
    contatoreFiltri.textContent = n ? `(${n})` : '';
    if (!tutti.length) {
      risultati.replaceChildren(h('div', { class: 'vuoto-stato' },
        h('h2', {}, 'Ancora nessun intervento'),
        h('p', {}, 'Registra la prima uscita, oppure importa un backup o il file JSON creato dall\'Excel con tools/xlsx_to_json.py.'),
        h('div', { class: 'azioni' },
          h('a', { class: 'bottone primario', href: '#/nuovo' }, icona('piu'), 'Nuovo intervento'),
          h('a', { class: 'bottone', href: '#/impostazioni' }, icona('importa'), 'Importa'))));
      return;
    }
    const trovati = ordinaRecenti(filtraElenco(stato.record, filtri));
    const indice = indiceMissioni(stato.record);
    const testata = h('div', { class: 'riepilogo-elenco' },
      h('span', { class: 'num' }, trovati.length === tutti.length
        ? `${conteggio(tutti.length)} interventi`
        : `${conteggio(trovati.length)} di ${conteggio(tutti.length)} interventi`),
      n || filtri.testo ? h('button', { type: 'button', class: 'bottone testo piccolo', onclick: azzera }, 'Azzera filtri') : null);
    if (!trovati.length) {
      risultati.replaceChildren(testata, h('div', { class: 'vuoto-stato' },
        h('h2', {}, 'Nessun intervento con questi filtri'),
        h('p', {}, 'Allarga il periodo o togli qualche filtro.'),
        h('button', { type: 'button', class: 'bottone', onclick: azzera }, 'Azzera filtri')));
      return;
    }
    const gruppi = new Map();
    for (const r of trovati) {
      const chiave = isDataValida(r.data) ? r.data.slice(0, 7) : 'senza-data';
      if (!gruppi.has(chiave)) gruppi.set(chiave, []);
      gruppi.get(chiave).push(r);
    }
    const blocchi = [];
    for (const [chiave, righe] of gruppi) {
      const titolo = chiave === 'senza-data' ? 'Senza data' : `${meseLungo(Number(chiave.slice(5)))} ${chiave.slice(0, 4)}`;
      blocchi.push(h('h3', { class: 'mese-titolo' }, titolo, h('span', { class: 'num' }, conteggio(righe.length))));
      blocchi.push(h('ul', { class: 'righe' }, righe.map((r) => riga(r, avvisi(r, indice)))));
    }
    risultati.replaceChildren(testata, ...blocchi);
  }

  function azzera() {
    Object.assign(filtri, {
      testo: '', periodo: { tipo: 'tutto' }, mezzo: '', tipologia: '', codiceInvio: '', codiceRientro: '',
      patologia: '', esito: '', ospedale: '', soloAvvisi: false,
    });
    mostraDiNuovo();
  }

  main.append(
    h('div', { class: 'cerca' }, h('div', { class: 'campo-cerca' }, icona('cerca'), cerca)),
    pannello,
    risultati,
  );
  disegna();
  return { aggiorna: disegna };
}

function riga(r, avvisiRiga) {
  const [, mese, giorno] = isDataValida(r.data) ? r.data.split('-').map(Number) : [];
  const dettagli = [r.missione || 'senza missione', [r.mezzo, r.tipologia].filter(Boolean).join(' '),
    r.eta !== null && r.eta !== '' ? `${r.eta} anni` : '', r.sesso ? r.sesso[0] : ''].filter(Boolean).join(' · ');
  return h('li', {}, h('a', { class: 'riga', href: `#/intervento/${encodeURIComponent(r.id)}` },
    h('span', { class: 'quando' },
      h('span', { class: 'giorno' }, giorno || '—'),
      giorno ? h('span', { class: 'mese' }, meseBreve(mese)) : null,
      h('span', { class: 'ora' }, r.oraAllert)),
    h('span', { class: 'dove' },
      h('span', { class: 'comune' }, r.comune || 'Comune non indicato'),
      h('span', { class: 'dettagli' }, dettagli)),
    h('span', { class: 'lato' },
      coppiaCodici(r.codiceInvio, r.codiceRientro),
      avvisiRiga.length
        ? h('span', { class: 'segnale', title: avvisiRiga.join(', ') }, icona('avviso'), avvisiRiga.length === 1 ? '1 avviso' : `${avvisiRiga.length} avvisi`)
        : h('span', { class: 'esito' }, r.esito === 'Trasportato' && r.ospedale ? [icona('freccia'), r.ospedale] : r.esito))));
}

function controlliFiltri(ridisegna, ricostruisci) {
  const anni = [...new Set(interventi().map((r) => r.data).filter(isDataValida).map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a);
  const tipoPeriodo = h('select', {
    class: 'select', 'aria-label': 'Periodo',
    onchange: (e) => {
      const tipo = e.target.value;
      const anno = anni[0] ?? new Date().getFullYear();
      filtri.periodo = tipo === 'anno' ? { tipo, anno }
        : tipo === 'mese' ? { tipo, anno, mese: new Date().getMonth() + 1 }
          : tipo === 'intervallo' ? { tipo, da: '', a: '' } : { tipo: 'tutto' };
      ricostruisci();
    },
  }, ['tutto', 'anno', 'mese', 'intervallo'].map((t) => h('option', { value: t, selected: filtri.periodo.tipo === t },
    { tutto: 'Tutto', anno: 'Anno', mese: 'Mese', intervallo: 'Intervallo' }[t])));

  const valoriPeriodo = [];
  const p = filtri.periodo;
  if (p.tipo === 'anno') {
    valoriPeriodo.push(h('select', { class: 'select', 'aria-label': 'Anno', onchange: (e) => { p.anno = Number(e.target.value); ridisegna(); } },
      (anni.length ? anni : [p.anno]).map((a) => h('option', { value: a, selected: a === p.anno }, a))));
  } else if (p.tipo === 'mese') {
    valoriPeriodo.push(h('input', {
      class: 'input', type: 'month', 'aria-label': 'Mese', value: `${p.anno}-${String(p.mese).padStart(2, '0')}`,
      onchange: (e) => { if (!e.target.value) return; [p.anno, p.mese] = e.target.value.split('-').map(Number); ridisegna(); },
    }));
  } else if (p.tipo === 'intervallo') {
    valoriPeriodo.push(
      h('input', { class: 'input', type: 'date', 'aria-label': 'Dal', value: p.da, onchange: (e) => { p.da = e.target.value; ridisegna(); } }),
      h('input', { class: 'input', type: 'date', 'aria-label': 'Al', value: p.a, onchange: (e) => { p.a = e.target.value; ridisegna(); } }),
    );
  }

  const selettori = CAMPI_FILTRO.map(([k, etichetta, lista]) => h('div', { class: 'campo' },
    h('label', { class: 'etichetta', for: `f-${k}` }, etichetta),
    h('select', { id: `f-${k}`, class: 'select', onchange: (e) => { filtri[k] = e.target.value; ridisegna(); } },
      h('option', { value: '' }, 'Tutti'),
      (stato.liste[lista] ?? []).map((v) => h('option', { value: v.voce, selected: filtri[k] === v.voce }, v.voce)))));

  return [
    h('div', { class: 'campo largo' }, h('span', { class: 'etichetta' }, 'Periodo'),
      h('div', { class: 'periodo' }, tipoPeriodo, valoriPeriodo.length ? h('div', { class: 'valori' }, valoriPeriodo) : null)),
    ...selettori,
    h('label', { class: 'interruttore largo' },
      h('input', { type: 'checkbox', checked: filtri.soloAvvisi, onchange: (e) => { filtri.soloAvvisi = e.target.checked; ridisegna(); } }),
      'Solo righe con avvisi da controllare'),
  ];
}
