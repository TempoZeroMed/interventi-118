// Impostazioni: backup e passaggio dei dati, liste dei menu, archiviazione, installazione.
import {
  stato, interventi, importaBackup, backupCorrente, registraEsportazione, aggiornaListe, nomeDispositivo, tipoDispositivo, isIOS,
  impostaMeta,
} from '../stato.js';
import { leggiBackup, nomeFileBackup, nomeFileDatato } from '../core/merge.js';
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

const TOAST_BACKUP = { condiviso: 'Backup pronto: controlla di averlo salvato su File', salvato: 'Backup salvato', scaricato: 'Backup scaricato' };
const TOAST_EXCEL = { condiviso: 'File Excel pronto', salvato: 'File Excel salvato', scaricato: 'File Excel scaricato' };
const haFinestraSalvataggio = () => typeof window.showSaveFilePicker === 'function';

async function salvaBackup(nome, opzioni) {
  try {
    const adesso = new Date();
    const blob = new Blob([JSON.stringify(backupCorrente(adesso))], { type: 'application/json' });
    const come = await salvaFile(blob, nome, opzioni);
    if (come === 'annullato') return;
    await registraEsportazione(adesso);
    toast(TOAST_BACKUP[come]);
  } catch (errore) {
    toast(`Backup non riuscito: ${errore.message}`);
  }
}

/** Esporta il backup JSON con il nome fisso del dispositivo (usato anche dal promemoria). */
export const esportaBackup = () => salvaBackup(nomeFileBackup(tipoDispositivo()), { ricordo: 'fileBackup' });

/** Copia storica con data e ora nel nome: mai ricordata, la finestra si apre ogni volta. */
const esportaCopiaDatata = () => salvaBackup(nomeFileDatato());

async function esportaExcel() {
  try {
    await caricaScript(SHEETJS);
    const XLSX = window.XLSX;
    const dati = XLSX.write(creaCartellaExcel(XLSX, stato.record), { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([dati], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const come = await salvaFile(blob, nomeFileBackup(tipoDispositivo(), 'xlsx'), { ricordo: 'fileExcel' });
    if (come !== 'annullato') toast(TOAST_EXCEL[come]);
  } catch (errore) {
    toast(`Export Excel non riuscito: ${errore.message}`);
  }
}

function spiegazioneBackup() {
  if (isIOS()) return 'Esporta: si apre la condivisione, scegli "Salva su File" e la stessa cartella di iCloud Drive dell\'altra volta: iOS chiede di sostituire interventi118_iPhone.json. Sul Mac importa quel file: i dati si uniscono, nessuno viene sovrascritto.';
  if (haFinestraSalvataggio()) return 'Esporta: la prima volta scegli dove salvare interventi118_Mac.json, per esempio in iCloud Drive; le volte dopo l\'app lo riscrive lì da sola. Sull\'iPhone importa quel file: i dati si uniscono, nessuno viene sovrascritto.';
  return 'Esporta: il file si chiama interventi118_Mac.json e finisce nei Download. In Safari attiva Impostazioni → Generali → Posizione download → "Chiedi per ogni download": così scegli la cartella di iCloud Drive e il Mac chiede di sostituirlo. Sull\'iPhone importa quel file: i dati si uniscono, nessuno viene sovrascritto.';
}

export function mostra(main) {
  impostaBanda('Impostazioni', 'Dati, liste, installazione');
  const sezioneDati = h('section', { class: 'blocco' });
  const sezioneListe = h('section', { class: 'blocco' });
  const sezioneDomande = h('section', { class: 'blocco' });
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
      h('p', {}, spiegazioneBackup()),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', class: 'bottone primario', onclick: esportaBackup }, icona('esporta'), 'Esporta backup'),
        h('button', { type: 'button', class: 'bottone', onclick: () => scegli.click() }, icona('importa'), 'Importa backup'),
        h('button', { type: 'button', class: 'bottone', onclick: esportaExcel }, icona('tabella'), 'Esporta Excel'),
        scegli),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', class: 'bottone piccolo', onclick: esportaCopiaDatata }, 'Esporta copia con data')),
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

  /** Parola d'ordine per le domande all'archivio: resta in IndexedDB, non entra nei backup e non si mostra mai. */
  function disegnaDomande(cambia = false) {
    const aiuto = h('p', {}, 'La stessa frase impostata su Cloudflare, di almeno 12 caratteri (per esempio tre parole a caso). Serve solo per fare domande all\'archivio dalle Statistiche; senza, l\'app funziona come prima.');
    if (stato.meta.parolaOrdineDomande && !cambia) {
      riempi(sezioneDomande,
        h('h2', {}, 'Domande all\'archivio'),
        h('dl', { class: 'stato-righe' }, h('dt', {}, 'Parola d\'ordine'), h('dd', {}, 'Impostata')),
        aiuto,
        h('div', { class: 'azioni' }, h('button', { type: 'button', class: 'bottone', onclick: () => disegnaDomande(true) }, 'Cambia')));
      return;
    }
    const campo = h('input', {
      id: 'parola-ordine', class: 'input', type: 'password', autocomplete: 'off', enterkeyhint: 'done',
    });
    const salva = async () => {
      const parola = campo.value.trim();
      if (parola.length < 12) {
        toast('La parola d\'ordine deve avere almeno 12 caratteri');
        return;
      }
      await impostaMeta({ parolaOrdineDomande: parola });
      toast('Parola d\'ordine salvata');
      disegnaDomande();
    };
    campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); salva(); } });
    riempi(sezioneDomande,
      h('h2', {}, 'Domande all\'archivio'),
      h('label', { class: 'etichetta', for: 'parola-ordine' }, 'Parola d\'ordine'),
      h('div', { class: 'con-bottone' }, campo, h('button', { type: 'button', class: 'bottone', onclick: salva }, 'Salva')),
      aiuto,
      cambia ? h('div', { class: 'azioni' }, h('button', { type: 'button', class: 'bottone testo piccolo', onclick: () => disegnaDomande() }, 'Annulla')) : null);
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
    h('p', {}, 'Interventi 118, versione 1.4.3. I dati restano solo su questo dispositivo: nessun account, nessuna statistica d\'uso. Escono solo quando esporti un file; per le domande all\'archivio partono solo la domanda, le voci delle liste e i nomi dei comuni.'));

  function disegnaTutto() {
    disegnaDati();
    disegnaListe();
    disegnaDomande();
    disegnaArchivio();
  }

  main.append(sezioneDati, sezioneListe, sezioneDomande, sezioneArchivio, guida, info);
  disegnaTutto();
  // la finestra di salvataggio di Chrome vuole un tocco recente: SheetJS dev'essere già pronto al clic su Esporta Excel
  if (haFinestraSalvataggio()) caricaScript(SHEETJS).catch(() => {});
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
