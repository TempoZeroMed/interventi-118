// Avvio, navigazione tra le schermate, promemoria del backup, service worker.
import { carica, stato, quandoCambia, impostaMeta, interventi } from './stato.js';
import { promemoriaBackup } from './core/merge.js';
import { h, icona } from './ui/dom.js';
import * as inserimento from './ui/inserimento.js';
import * as elenco from './ui/elenco.js';
import * as statistiche from './ui/statistiche.js';
import * as impostazioni from './ui/impostazioni.js';

export const VERSIONE_APP = '1.4.4';

const main = document.getElementById('vista');
let vistaCorrente = null;
let hashCorrente = '';
let ignoraProssimo = false;

function percorso() {
  const [, nome = 'nuovo', parametro] = (location.hash || '#/nuovo').split('/');
  return { nome, parametro: parametro ? decodeURIComponent(parametro) : null };
}

async function naviga() {
  if (ignoraProssimo) {
    ignoraProssimo = false;
    return;
  }
  if (vistaCorrente?.puoiUscire && !(await vistaCorrente.puoiUscire())) {
    ignoraProssimo = true;
    location.hash = hashCorrente;
    return;
  }
  vistaCorrente?.smonta?.(); // es. il lettore della foto del tablet
  hashCorrente = location.hash;
  const { nome, parametro } = percorso();
  const scheda = nome === 'intervento' ? 'elenco' : nome;
  document.querySelectorAll('.scheda').forEach((a) => {
    if (a.dataset.vista === scheda) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  main.className = '';
  main.replaceChildren();
  window.scrollTo(0, 0);
  if (nome === 'elenco') vistaCorrente = elenco.mostra(main);
  else if (nome === 'statistiche') vistaCorrente = statistiche.mostra(main);
  else if (nome === 'impostazioni') vistaCorrente = impostazioni.mostra(main);
  else if (nome === 'intervento' && parametro) vistaCorrente = inserimento.mostraModifica(main, parametro);
  else vistaCorrente = await inserimento.mostraNuovo(main);
  aggiornaPromemoria();
}

function aggiornaPromemoria() {
  const el = document.getElementById('promemoria');
  const p = promemoriaBackup({
    ultimoBackup: stato.meta.ultimoBackup ?? null,
    modificheNonEsportate: stato.meta.modificheNonEsportate ?? 0,
    numeroInterventi: interventi().length,
  });
  const inImpostazioni = percorso().nome === 'impostazioni';
  el.hidden = !p || inImpostazioni;
  if (p && !inImpostazioni) {
    el.replaceChildren(
      icona('avviso'),
      h('p', {}, p.messaggio),
      h('button', { type: 'button', class: 'bottone piccolo', onclick: () => impostazioni.esportaBackup() }, 'Esporta backup'),
    );
  }
}

async function chiediPersistenza() {
  if (!navigator.storage?.persist) {
    await impostaMeta({ persistente: null });
    return;
  }
  const gia = await navigator.storage.persisted();
  await impostaMeta({ persistente: gia || (await navigator.storage.persist()) });
}

function registraServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function avvia() {
  try {
    await carica();
  } catch (errore) {
    main.replaceChildren(h('div', { class: 'messaggio errore', role: 'alert' }, icona('avviso'),
      h('p', {}, `L'archivio sul dispositivo non si apre: ${errore.message}`)));
    return;
  }
  quandoCambia(() => {
    aggiornaPromemoria();
    vistaCorrente?.aggiorna?.();
  });
  window.addEventListener('hashchange', naviga);
  await naviga();
  chiediPersistenza().catch(() => {});
  registraServiceWorker();
}

avvia();
