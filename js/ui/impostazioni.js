// Impostazioni: backup e passaggio dei dati, liste dei menu, archiviazione, installazione.
import {
  stato, interventi, importaBackup, backupCorrente, registraEsportazione, aggiornaListe, nomeDispositivo, isIOS,
} from '../stato.js';
import { leggiBackup, nomeFileBackup } from '../core/merge.js';
import { aggiungiVoce, rinominaVoce, impostaAttiva, campiDellaLista } from '../core/liste.js';
import { creaCartellaExcel } from '../core/excel.js';
import { h, riempi, icona, impostaBanda, toast, conteggio, istante, dataBreve } from './dom.js';
import { salvaFile, caricaScript, SHEETJS } from './file.js';
import { impostaFiltri } from './elenco.js';

const NOMI_LISTE = {
  mezzo: 'Mezzi', tipologia: 'Tipologia', codiceInvio: 'Codici invio', codiceRientro: 'Codici rientro',
  patologia: 'Patologie', luogo: 'Luoghi', sesso: 'Sesso', esito: 'Esiti', ospedale: 'Ospedali',
  tipoMissione: 'Tipo missione',
};
let listaScelta = 'ospedale';
let ultimoEsitoImport = null;

/** Esporta il backup JSON (usato anche dal promemoria). */
export async function esportaBackup() {
  try {
    const adesso = new Date();
    const blob = new Blob([JSON.stringify(backupCorrente(adesso))], { type: 'application/json' });
    const come = await salvaFile(blob, nomeFileBackup(adesso));
    if (come === 'annullato') return;
    await registraEsportazione(adesso);
    toast(come === 'condiviso' ? 'Backup pronto: controlla di averlo salvato su File' : 'Backup scaricato');
  } catch (errore) {
    toast(`Backup non riuscito: ${errore.message}`);
  }
}

async function esportaExcel() {
  try {
    await caricaScript(SHEETJS);
    const XLSX = window.XLSX;
    const dati = XLSX.write(creaCartellaExcel(XLSX, stato.record), { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([dati], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const come = await salvaFile(blob, nomeFileBackup(new Date()).replace(/\.json$/, '.xlsx'));
    if (come !== 'annullato') toast(come === 'condiviso' ? 'File Excel pronto' : 'File Excel scaricato');
  } catch (errore) {
    toast(`Export Excel non riuscito: ${errore.message}`);
  }
}

export function mostra(main) {
  impostaBanda('Impostazioni', 'Dati, liste, installazione');
  const sezioneDati = h('section', { class: 'blocco' });
  const sezioneListe = h('section', { class: 'blocco' });
  const sezioneArchivio = h('section', { class: 'blocco' });

  function disegnaDati() {
    const scegli = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importa });
    riempi(sezioneDati,
      h('h2', {}, 'Backup e passaggio dei dati'),
      h('dl', { class: 'stato-righe' },
        h('dt', {}, 'Interventi'), h('dd', {}, conteggio(interventi().length)),
        h('dt', {}, 'Ultimo backup'), h('dd', {}, istante(stato.meta.ultimoBackup)),
        h('dt', {}, 'Modifiche non esportate'), h('dd', {}, conteggio(stato.meta.modificheNonEsportate ?? 0)),
        h('dt', {}, 'Ultimo scambio'), h('dd', {}, istante(stato.meta.ultimaSincronizzazione))),
      h('p', {}, isIOS()
        ? 'Esporta: si apre la condivisione, scegli "Salva su File" e poi iCloud Drive. Sul Mac importa quel file: i dati si uniscono, nessuno viene sovrascritto.'
        : 'Esporta: il file finisce nei Download; spostalo in iCloud Drive. Sull\'iPhone importalo dall\'app: i dati si uniscono, nessuno viene sovrascritto.'),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', class: 'bottone primario', onclick: esportaBackup }, icona('esporta'), 'Esporta backup'),
        h('button', { type: 'button', class: 'bottone', onclick: () => scegli.click() }, icona('importa'), 'Importa backup'),
        h('button', { type: 'button', class: 'bottone', onclick: esportaExcel }, icona('tabella'), 'Esporta Excel'),
        scegli),
      ultimoEsitoImport ? riepilogoImport(ultimoEsitoImport) : null,
    );
  }

  async function importa(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = leggiBackup(await file.text());
      ultimoEsitoImport = { ...(await importaBackup(backup)), file: file.name };
      toast('Import completato');
    } catch (errore) {
      ultimoEsitoImport = { errore: errore.message, file: file.name };
    }
    disegnaTutto();
  }

  function disegnaListe() {
    const lista = stato.liste[listaScelta] ?? [];
    const campi = campiDellaLista(listaScelta);
    const uso = (voce) => stato.record.filter((r) => !r.deleted && campi.some((k) => r[k] === voce)).length;
    const nuova = h('input', { class: 'input', type: 'text', placeholder: 'Nuova voce', 'aria-label': 'Nuova voce', enterkeyhint: 'done' });
    const aggiungi = async () => {
      try {
        await aggiornaListe(aggiungiVoce(stato.liste, listaScelta, nuova.value, new Date()));
        toast('Voce aggiunta');
        disegnaListe();
      } catch (errore) {
        toast(errore.message);
      }
    };
    nuova.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aggiungi(); } });
    riempi(sezioneListe,
      h('h2', {}, 'Liste dei menu'),
      h('p', {}, 'Aggiungi, rinomina o disattiva le voci. Le voci non si cancellano: una voce disattivata non compare più nel form ma resta negli interventi già registrati. Le voci col lucchetto reggono statistiche e controlli.'),
      h('label', { class: 'etichetta', for: 'scelta-lista' }, 'Lista'),
      h('select', { id: 'scelta-lista', class: 'select', onchange: (ev) => { listaScelta = ev.target.value; disegnaListe(); } },
        Object.entries(NOMI_LISTE).map(([k, t]) => h('option', { value: k, selected: k === listaScelta }, t))),
      h('ul', { class: 'voci' }, lista.map((v) => rigaVoce(v, uso(v.voce)))),
      h('div', { class: 'con-bottone' }, nuova, h('button', { type: 'button', class: 'bottone', onclick: aggiungi }, icona('piu'), 'Aggiungi')),
    );
  }

  function rigaVoce(v, usata) {
    const li = h('li', { class: `voce${v.attiva ? '' : ' spenta'}` });
    const dettaglio = `${usata ? `${conteggio(usata)} ${usata === 1 ? 'intervento' : 'interventi'}` : 'mai usata'}${v.attiva ? '' : ' · disattivata'}`;
    const normale = () => riempi(li,
      h('span', { class: 'nome' }, v.voce, h('small', {}, dettaglio)),
      v.sistema
        ? h('span', { class: 'lucchetto' }, icona('lucchetto'), 'di sistema')
        : [
          h('button', { type: 'button', class: 'bottone testo piccolo', onclick: modifica, 'aria-label': `Rinomina ${v.voce}` }, icona('matita')),
          h('button', { type: 'button', class: 'bottone piccolo', onclick: attiva }, v.attiva ? 'Disattiva' : 'Riattiva'),
        ],
    );
    function modifica() {
      const campo = h('input', { class: 'input', type: 'text', value: v.voce, 'aria-label': `Nuovo nome per ${v.voce}` });
      const salva = async () => {
        try {
          const { liste, modificati } = rinominaVoce(stato.liste, stato.record, listaScelta, v.id, campo.value, new Date());
          await aggiornaListe(liste, modificati);
          toast(modificati.length ? `Voce rinominata in ${conteggio(modificati.length)} interventi` : 'Voce rinominata');
          disegnaListe();
        } catch (errore) {
          toast(errore.message);
        }
      };
      campo.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); salva(); }
        if (ev.key === 'Escape') normale();
      });
      riempi(li, campo,
        h('button', { type: 'button', class: 'bottone piccolo primario', onclick: salva }, 'Salva'),
        h('button', { type: 'button', class: 'bottone piccolo testo', onclick: normale, 'aria-label': 'Annulla' }, icona('x')));
      campo.focus();
      campo.select();
    }
    async function attiva() {
      try {
        await aggiornaListe(impostaAttiva(stato.liste, listaScelta, v.id, !v.attiva, new Date()));
        disegnaListe();
      } catch (errore) {
        toast(errore.message);
      }
    }
    normale();
    return li;
  }

  async function disegnaArchivio() {
    const installata = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    const persistente = stato.meta.persistente;
    let spazio = '—';
    try {
      const stima = await navigator.storage?.estimate?.();
      if (stima?.usage !== undefined) spazio = `${(stima.usage / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
    } catch { /* stima non disponibile */ }
    riempi(sezioneArchivio,
      h('h2', {}, 'Archiviazione sul dispositivo'),
      h('dl', { class: 'stato-righe' },
        h('dt', {}, 'Archiviazione persistente'),
        h('dd', {}, persistente === true ? 'Concessa' : persistente === false ? 'Non concessa' : 'Non supportata'),
        h('dt', {}, 'Spazio usato'), h('dd', {}, spazio),
        h('dt', {}, 'App installata'), h('dd', {}, installata ? 'Sì' : 'No, aperta nel browser'),
        h('dt', {}, 'Dispositivo'), h('dd', {}, nomeDispositivo())),
      h('p', {}, persistente === true
        ? 'Il sistema non cancellerà i dati per liberare spazio. Il backup resta comunque l\'unica copia fuori da questo dispositivo.'
        : 'Il sistema potrebbe cancellare i dati se manca spazio o se l\'app non viene aperta per settimane. Installala nella schermata Home e fai backup regolari.'),
    );
  }

  const guida = h('section', { class: 'blocco' },
    h('h2', {}, 'Installare l\'app su iPhone'),
    h('ol', { class: 'guida' },
      h('li', {}, 'Apri l\'indirizzo dell\'app in Safari (non in un altro browser).'),
      h('li', {}, 'Tocca Condividi, poi "Aggiungi alla schermata Home" e conferma.'),
      h('li', {}, 'Apri l\'app dalla nuova icona: da lì funziona anche senza rete.'),
      h('li', {}, 'Importa il backup dall\'app installata: l\'app nella schermata Home ha un archivio suo, separato da quello di Safari.')));

  const info = h('section', { class: 'blocco' },
    h('h2', {}, 'Informazioni'),
    h('p', {}, 'Interventi 118, versione 1.0.0. I dati restano solo su questo dispositivo: nessun server, nessun account, nessuna statistica d\'uso. Escono solo quando esporti un file.'));

  function disegnaTutto() {
    disegnaDati();
    disegnaListe();
    disegnaArchivio();
  }

  main.append(sezioneDati, sezioneListe, sezioneArchivio, guida, info);
  disegnaTutto();
  return { aggiorna: () => { disegnaDati(); disegnaArchivio(); } };
}

function riepilogoImport(e) {
  if (e.errore) {
    return h('div', { class: 'esito-import' }, h('div', { class: 'messaggio errore', role: 'alert' }, icona('avviso'),
      h('div', {}, h('p', {}, h('strong', {}, `Import di ${e.file} non riuscito.`)), h('p', {}, e.errore))));
  }
  const conteggi = [['Nuovi', e.nuovi], ['Aggiornati', e.aggiornati], ['Invariati', e.invariati], ['Conflitti', e.conflitti.length]];
  return h('div', { class: 'esito-import', role: 'status' },
    h('p', {}, h('strong', {}, `Import di ${e.file}`)),
    h('dl', { class: 'conteggi' }, conteggi.map(([t, n]) => h('div', {}, h('dt', {}, t), h('dd', {}, conteggio(n))))),
    e.eliminati ? h('p', {}, e.eliminati === 1
      ? '1 intervento risulta eliminato sull\'altro dispositivo ed è stato tolto anche qui.'
      : `${conteggio(e.eliminati)} interventi risultano eliminati sull'altro dispositivo e sono stati tolti anche qui.`) : null,
    e.listeAggiornate ? h('p', {}, `${conteggio(e.listeAggiornate)} voci di lista aggiunte o aggiornate.`) : null,
    e.conflitti.length ? h('div', { class: 'messaggio avviso' }, icona('avviso'), h('div', {},
      h('p', {}, h('strong', {}, 'Modificati su entrambi i dispositivi: tenuta la versione più recente')),
      h('ul', {}, e.conflitti.map((c) => h('li', {},
        `${c.missione || 'senza missione'}${c.data ? ` del ${dataBreve(c.data)}` : ''}: ${c.vincitore === 'importato' ? 'versione del file importato' : 'versione di questo dispositivo'}`))))) : null,
    e.duplicatiMissione.length ? h('div', { class: 'messaggio avviso' }, icona('avviso'), h('div', {},
      h('p', {}, h('strong', {}, 'Stessa missione registrata più volte')),
      h('ul', {}, e.duplicatiMissione.map((d) => h('li', {},
        h('a', { href: '#/elenco', onclick: () => impostaFiltri({ testo: d.missione }) }, d.missione), ` · ${d.ids.length} interventi`))))) : null,
  );
}
