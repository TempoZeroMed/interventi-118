// Avvio, navigazione tra le schermate, promemoria del backup, service worker.
import { carica, stato, quandoCambia, impostaMeta, interventi } from './stato.js';
import { promemoriaBackup } from './core/merge.js';
import { gruppiDaDecidere } from './core/pazienti.js';
import { h, icona } from './ui/dom.js';
import * as inserimento from './ui/inserimento.js';
import * as elenco from './ui/elenco.js';
import * as statistiche from './ui/statistiche.js';
import * as impostazioni from './ui/impostazioni.js';

export const VERSIONE_APP = '1.5.5';

const main = document.getElementById('vista');
let vistaCorrente = null;
let hashCorrente = '';
let ignoraProssimo = false;
let nuovaVersione = false;
// il service worker che controllava la pagina all'apertura: se poi cambia, è arrivata una nuova versione
const controllerIniziale = navigator.serviceWorker?.controller ?? null;

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
  else vistaCorrente = await inserimento.mostraNuovo(main, nome === 'nuovo' ? parametro : null); // #/nuovo/<id>: Aggiungi paziente
  aggiornaPromemoria();
}

/**
 * La striscia in cima: la nuova versione da caricare, il backup da fare e le missioni registrate più volte da decidere.
 * Nelle Impostazioni resta solo la nuova versione: backup e missioni ripetute lì hanno i loro pulsanti.
 */
function aggiornaPromemoria() {
  const el = document.getElementById('promemoria');
  const p = promemoriaBackup({
    ultimoBackup: stato.meta.ultimoBackup ?? null,
    modificheNonEsportate: stato.meta.modificheNonEsportate ?? 0,
    numeroInterventi: interventi().length,
  });
  const ripetute = gruppiDaDecidere(stato.record, stato.meta.refusiMissione ?? []).length;
  const inImpostazioni = percorso().nome === 'impostazioni';
  const voci = [
    nuovaVersione && ['Nuova versione dell\'app pronta', h('button', { type: 'button', class: 'bottone piccolo', onclick: aggiornaApp }, 'Aggiorna')],
    !inImpostazioni && p && [p.messaggio, h('button', { type: 'button', class: 'bottone piccolo', onclick: () => impostazioni.esportaBackup() }, 'Esporta backup')],
    !inImpostazioni && ripetute && [
      `${ripetute === 1 ? '1 missione registrata' : `${ripetute} missioni registrate`} più volte: decidi se sono pazienti multipli`,
      h('a', { class: 'bottone piccolo', href: '#/impostazioni' }, 'Vai alle Impostazioni'),
    ],
  ].filter(Boolean);
  el.hidden = !voci.length;
  if (voci.length) {
    el.replaceChildren(...voci.map(([testo, azione]) => h('div', { class: 'voce-promemoria' }, icona('avviso'), h('p', {}, testo), azione)));
  }
}

/** «Aggiorna»: ricarica la pagina con i file nuovi, come uscire dalla schermata (una modifica non salvata chiede prima). */
async function aggiornaApp() {
  if (vistaCorrente?.puoiUscire && !(await vistaCorrente.puoiUscire())) return;
  await vistaCorrente?.salvaBozzaOra?.(); // la bozza del nuovo intervento si scrive 400 ms dopo l'ultimo tocco
  location.reload();
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
    // sw.js fa skipWaiting e clients.claim: la nuova versione prende la pagina aperta, che però usa ancora i file vecchi.
    // Senza un controller all'apertura è la prima installazione, non un aggiornamento.
    if (controllerIniziale) {
      const segnala = () => {
        nuovaVersione = true;
        aggiornaPromemoria();
      };
      navigator.serviceWorker.addEventListener('controllerchange', segnala);
      if (navigator.serviceWorker.controller !== controllerIniziale) segnala(); // cambiato mentre l'app si avviava
    }
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
