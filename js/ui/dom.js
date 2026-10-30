// Piccoli attrezzi per costruire l'interfaccia senza framework.

/** h('button', { class: 'bottone', onclick }, 'Salva') */
export function h(tag, attributi = {}, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  aggiungi(el, figli);
  return el;
}

/** Come replaceChildren, ma accetta elenchi annidati e scarta null/false. */
export function riempi(el, ...figli) {
  el.replaceChildren();
  aggiungi(el, figli);
  return el;
}

function aggiungi(el, figli) {
  for (const f of figli.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : String(f));
  }
}

const TRATTI = {
  piu: 'M12 5v14M5 12h14',
  orologio: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  copia: 'M9 9h11v11H9zM5 15H4V4h11v1',
  cerca: 'M20 20l-4.2-4.2M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  filtri: 'M3 5h18l-7 8.5V19l-4 2v-7.5z',
  cestino: 'M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13',
  esporta: 'M12 15V3M7 8l5-5 5 5M5 13v8h14v-8',
  importa: 'M12 3v12M7 10l5 5 5-5M5 13v8h14v-8',
  avviso: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  indietro: 'M15 5l-7 7 7 7',
  freccia: 'M5 12h14M13 6l6 6-6 6',
  lucchetto: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  tabella: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
  spunta: 'M5 12.5l4.5 4.5L19 7',
  matita: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6L6 18',
};

export function icona(nome, classe = 'ico') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', TRATTI[nome]);
  svg.append(p);
  return svg;
}

// ---------------------------------------------------------------- formati italiani

const intero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const decimale = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
export const numero = (n) => (n === null || n === undefined || n === '' ? '—' : decimale.format(n));
export const conteggio = (n) => intero.format(n);
/** frazione -> "61,2%" */
export const pct = (f) => (f === null || f === undefined ? '—' : `${decimale.format(f * 100)}%`);
/** numero già in percento (KPI arrotondati come nell'Excel) -> "1,4%" */
export const pctGia = (p) => `${decimale.format(p)}%`;

const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

export const meseLungo = (m) => MESI_LUNGHI[m - 1];
export const meseBreve = (m) => MESI_BREVI[m - 1];
/** '2026-10-29' -> 'giovedì 29 ottobre 2026' */
export function dataLunga(data) {
  const [a, m, g] = data.split('-').map(Number);
  const d = new Date(a, m - 1, g);
  return `${GIORNI[d.getDay()]} ${g} ${MESI_LUNGHI[m - 1]} ${a}`;
}
/** '2026-10-29' -> '29/10/2026' */
export const dataBreve = (data) => data.split('-').reverse().join('/');
/** ISO -> '29/10/2026 alle 07:05' */
export function istante(iso) {
  if (!iso) return 'mai';
  const d = new Date(iso);
  const due = (n) => String(n).padStart(2, '0');
  return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()} alle ${due(d.getHours())}:${due(d.getMinutes())}`;
}

// ---------------------------------------------------------------- banda, toast, dialoghi

export function impostaBanda(titolo, sottotitolo = '', { indietro = null, extra = null } = {}) {
  const banda = document.getElementById('banda');
  const titoli = h('div', { class: 'titoli' }, h('h1', { id: 'titolo' }, titolo), h('span', { class: 'sotto' }, sottotitolo));
  riempi(banda,
    indietro && h('a', { class: 'indietro', href: indietro, 'aria-label': 'Indietro' }, icona('indietro')),
    titoli,
    extra);
  document.title = `${titolo} · Interventi 118`;
}

let timerToast = null;
export function toast(testo, azione = null) {
  const el = document.getElementById('toast');
  el.replaceChildren(h('span', {}, testo));
  if (azione) el.append(h('button', { type: 'button', onclick: () => { el.classList.remove('visibile'); azione.fai(); } }, azione.etichetta));
  el.classList.add('visibile');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => el.classList.remove('visibile'), azione ? 5000 : 2800);
}

/** Dialogo di conferma. Risolve true/false. */
export function conferma({ titolo, testo, si = 'Conferma', no = 'Annulla', pericolo = false }) {
  const dialogo = document.getElementById('dialogo');
  return new Promise((risolvi) => {
    const chiudi = (valore) => {
      dialogo.close();
      risolvi(valore);
    };
    dialogo.replaceChildren(
      h('div', { class: 'corpo' }, h('h2', {}, titolo), testo && h('p', {}, testo)),
      h('div', { class: 'piede' },
        h('button', { type: 'button', class: 'bottone', onclick: () => chiudi(false) }, no),
        h('button', { type: 'button', class: `bottone ${pericolo ? 'pericolo' : 'primario'}`, onclick: () => chiudi(true) }, si)),
    );
    dialogo.oncancel = (e) => {
      e.preventDefault();
      chiudi(false);
    };
    dialogo.showModal();
  });
}

/** Mini striscia di un codice colore, sempre con la sua parola. */
export function codice(c) {
  return c ? h('span', { class: `cod ${c}` }, c) : h('span', { class: 'cod vuoto' }, '—');
}

/**
 * La striscia a strappo in piccolo: invio (chiaro) e rientro (pieno) uniti da una perforazione,
 * come nei grafici delle statistiche.
 */
export function coppiaCodici(invio, rientro) {
  const segmento = (c, ruolo) => h('span', { class: `seg ${ruolo} ${c || 'vuoto'}`, title: `${ruolo === 'invio' ? 'Invio' : 'Rientro'}: ${c || 'non indicato'}` }, c || '—');
  return h('span', { class: 'mini-strappo', role: 'img', 'aria-label': `Codice invio ${invio || 'non indicato'}, rientro ${rientro || 'non indicato'}` },
    segmento(invio, 'invio'), segmento(rientro, 'rientro'));
}
