// Form a schermo singolo: nuovo intervento e dettaglio modificabile.
import { stato, trova, salvaIntervento, eliminaIntervento, impostaMeta } from '../stato.js';
import { calcolati } from '../core/calcolati.js';
import { avvisi, indiceMissioni, verificaSalvataggio } from '../core/controlli.js';
import {
  recordVuoto, impostaCampo, copiaDaInvio, alternaManovra, dataLocale, prontoPerSalvare, collegaScheda, nuovaSchedaPaziente,
  bozzaConDati,
} from '../core/modulo.js';
import { MANOVRE, isElicottero, normalizzaNumero } from '../core/campi.js';
import { primaScheda, propagaPazienti, isMultiplo, puoAggiungerePaziente } from '../core/pazienti.js';
import { vociPerScelta } from '../core/liste.js';
import { piuUsate, suggerimentiComuni } from '../core/elenco.js';
import { applicaLettura } from '../core/tablet.js';
import {
  h, icona, impostaBanda, toast, conferma, dataLunga, dataBreve, numero, coppiaCodici, messaggioDuplicato, messaggioCollegata,
} from './dom.js';
import { creaFotoTablet } from './fototablet.js';

// voci più usate mostrate come pulsanti nelle liste lunghe: 3 sul telefono, così il menu "Altro…" sta nella stessa riga
const scorciatoie = () => (matchMedia('(min-width: 480px)').matches ? 4 : 3);

/** Nuovo intervento; con `daId` (#/nuovo/<id>, "Aggiungi paziente") la scheda di un altro paziente dello stesso intervento. */
export async function mostraNuovo(main, daId = null) {
  const bozza = stato.meta.bozza && !trova(stato.meta.bozza.id) ? stato.meta.bozza : null;
  const scheda = daId && trova(daId);
  if (scheda && puoAggiungerePaziente(scheda, stato.record)) {
    const daSostituire = bozzaConDati(bozza);
    if (daSostituire) {
      const ok = await conferma({
        titolo: 'Sostituire la bozza?', testo: 'La scheda del nuovo paziente prende il posto dei dati non salvati.', si: 'Sostituisci', pericolo: true,
      });
      if (!ok) {
        location.hash = `#/intervento/${encodeURIComponent(daId)}`;
        return null;
      }
    }
    // i campi condivisi vengono dalla prima scheda dell'intervento
    const nuova = nuovaSchedaPaziente(primaScheda(stato.record, scheda.missione) ?? scheda, crypto.randomUUID(), new Date());
    if (daSostituire) await impostaMeta({ bozza: nuova });
    return costruisci(main, nuova, null);
  }
  return costruisci(main, bozza ?? recordVuoto(crypto.randomUUID(), new Date()), null);
}

export function mostraModifica(main, id) {
  const originale = trova(id);
  if (!originale || originale.deleted) {
    impostaBanda('Intervento non trovato', '', { indietro: '#/elenco' });
    main.append(h('div', { class: 'vuoto-stato' },
      h('h2', {}, 'Questo intervento non c\'è più'),
      h('p', {}, 'Forse è stato eliminato, anche da un altro dispositivo con l\'ultimo import.'),
      h('a', { class: 'bottone', href: '#/elenco' }, 'Torna all\'elenco')));
    return null;
  }
  return costruisci(main, { ...originale }, originale);
}

function costruisci(main, iniziale, originale) {
  let r = iniziale;
  let modificato = false;
  const aggiornatori = [];
  const modifica = Boolean(originale);
  main.classList.add('con-barra');

  // intervento con più pazienti: l'id della prima scheda se questa scheda è collegata, e le regole di salvataggio
  // (bloccata: quante altre schede ha la prima scheda), ricalcolate a ogni modifica
  let collegataA = null;
  let verifica = null;
  const collega = () => ({ record: r, collegataA } = collegaScheda(r, stato.record, collegataA));
  collega();

  // la banda è condivisa: un aggiornamento in ritardo (es. dopo "Svuota") non deve toccarla se il form è già stato lasciato
  const titoloBanda = () => modulo.isConnected && (modifica
    ? impostaBanda(r.missione ? `Intervento ${r.missione}` : 'Intervento', r.data ? dataLunga(r.data) : 'senza data',
      { indietro: '#/elenco', extra: coppiaCodici(r.codiceInvio, r.codiceRientro) })
    : impostaBanda('Nuovo intervento', r.data ? dataLunga(r.data) : 'senza data'));

  // campi riempiti dalla foto del tablet: evidenziati finché non si toccano o non si salva (solo in memoria)
  const evidenziati = new Set();
  const RIENTRO = ['codiceRientro', 'patologiaRientro', 'luogoRientro'];

  let timerBozza = null;
  function salvaBozza() {
    if (modifica) return;
    clearTimeout(timerBozza);
    timerBozza = setTimeout(() => impostaMeta({ bozza: r }).catch(() => {}), 400);
  }

  /** Ogni modifica passa da qui; campo '_copia' è il pulsante "Copia da invio", '_manovra' un pulsante delle manovre. */
  function cambia(campo, valore) {
    const prima = r;
    if (campo === '_copia') r = copiaDaInvio(r);
    else if (campo === '_manovra') r = alternaManovra(r, valore);
    else r = impostaCampo(r, campo, valore);
    collega();
    // il campo toccato non è più "dalla foto", e nemmeno uno che una regola del form ha cambiato (es. l'ospedale svuotato)
    const toccati = campo === '_copia' ? RIENTRO : [campo];
    for (const k of evidenziati) if (toccati.includes(k) || r[k] !== prima[k]) evidenziati.delete(k);
    modificato = true;
    aggiorna();
    salvaBozza();
  }

  /**
   * I valori letti dalla foto: passano dalle regole del form e prendono il posto di quelli presenti. Una seconda foto
   * aggiunge i suoi campi agli evidenziati: un campo che non legge tiene il valore della prima, e anche l'evidenziazione.
   */
  function daFoto({ valori }) {
    r = applicaLettura(r, valori);
    collega();
    for (const k of Object.keys(valori)) evidenziati.add(k);
    modificato = true;
    aggiorna();
    salvaBozza();
  }
  function aggiorna() {
    verifica = verificaSalvataggio(r, stato.record, originale);
    for (const fn of aggiornatori) fn(r);
    titoloBanda();
  }
  const quando = (fn) => aggiornatori.push(fn);

  // ------------------------------------------------------------ componenti

  function campo(chiave, etichetta, controllo, extra = null) {
    const id = `c-${Math.random().toString(36).slice(2, 8)}`;
    controllo.id ||= id;
    return h('div', { class: 'campo', 'data-campo': chiave },
      h('label', { class: 'etichetta', for: controllo.id }, etichetta), controllo, extra);
  }

  function data(chiave, etichetta) {
    const input = h('input', { class: 'input', type: 'date', value: r[chiave], oninput: (e) => cambia(chiave, e.target.value) });
    quando((x) => { if (input.value !== x[chiave]) input.value = x[chiave]; });
    const oggi = h('button', { type: 'button', class: 'bottone', onclick: () => cambia(chiave, dataLocale(new Date())) },
      icona('calendario'), 'Oggi');
    const c = campo(chiave, etichetta, h('div', { class: 'con-bottone' }, input, oggi));
    c.querySelector('label').setAttribute('for', input.id || (input.id = `c-${chiave}`));
    return c;
  }

  function ora(chiave, etichetta) {
    const input = h('input', { class: 'input', type: 'time', value: r[chiave], oninput: (e) => cambia(chiave, e.target.value) });
    quando((x) => { if (input.value !== x[chiave]) input.value = x[chiave]; });
    return campo(chiave, etichetta, input);
  }

  function missione() {
    const contatore = h('span', { class: 'contatore num' });
    const input = h('input', {
      class: 'input num', type: 'text', value: r.missione, autocapitalize: 'characters', autocomplete: 'off',
      spellcheck: 'false', enterkeyhint: 'next', placeholder: '04AA0000',
      oninput: (e) => cambia('missione', e.target.value),
    });
    quando((x) => {
      if (input.value !== x.missione) input.value = x.missione;
      contatore.textContent = x.missione ? `${x.missione.length}/8` : '';
      input.readOnly = verifica.bloccata > 0; // la prima scheda di un intervento con più pazienti tiene la MISSIONE
    });
    const c = campo('missione', 'Missione', input);
    c.querySelector('label').append(' ', contatore);
    return c;
  }

  function comune() {
    const lista = h('datalist', { id: 'comuni-usati' }, suggerimentiComuni(stato.record).map((v) => h('option', { value: v })));
    const input = h('input', {
      class: 'input', type: 'text', value: r.comune, list: 'comuni-usati', autocapitalize: 'characters',
      autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', oninput: (e) => cambia('comune', e.target.value),
    });
    quando((x) => {
      if (input.value !== x.comune) {
        const pos = input.selectionStart;
        input.value = x.comune;
        if (document.activeElement === input) input.setSelectionRange(pos, pos);
      }
    });
    return campo('comune', 'Comune', input, lista);
  }

  /** ETÀ e TEMPO VOLO: tastiera numerica; un valore svuotato da una regola del form svuota anche il campo. */
  function campoNumerico(chiave, etichetta) {
    const input = h('input', {
      class: 'input num', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: r[chiave] ?? '', autocomplete: 'off',
      oninput: (e) => cambia(chiave, e.target.value),
    });
    quando((x) => {
      const testo = x[chiave] === null || x[chiave] === undefined ? '' : String(x[chiave]);
      if (input.value !== testo && normalizzaNumero(input.value) !== x[chiave]) input.value = testo;
    });
    return campo(chiave, etichetta, input);
  }

  /**
   * "Paziente multiplo" e il numero di pazienti (2 proposto). Una scheda collegata li eredita dalla prima scheda, bloccati;
   * la prima scheda tiene la spunta finché ha altre schede. Il numero cancellato lascia la spunta accesa. Nel dettaglio di
   * una scheda salvata con la spunta, "Aggiungi paziente" apre la scheda di un altro paziente con i dati dell'intervento
   * (qui e non nella barra delle azioni: sul telefono tre pulsanti spingono "Salva modifiche" fuori dallo schermo).
   */
  function pazienti() {
    const spunta = h('input', { type: 'checkbox', onchange: (e) => cambia('pazienti', e.target.checked ? 2 : null) });
    const nota = h('p', { class: 'nota-interruttore' });
    const numeroPazienti = campoNumerico('pazienti', 'Numero pazienti');
    const riga = h('div', { class: 'riga-campi' }, numeroPazienti);
    const aggiungi = modifica && puoAggiungerePaziente(originale, stato.record)
      ? h('a', { class: 'bottone', href: `#/nuovo/${encodeURIComponent(originale.id)}` }, icona('piu'), 'Aggiungi paziente')
      : null;
    quando((x) => {
      if (aggiungi) aggiungi.hidden = !isMultiplo(x);
      const altre = verifica.bloccata;
      spunta.checked = isMultiplo(x);
      spunta.disabled = Boolean(collegataA) || altre > 0;
      numeroPazienti.querySelector('input').disabled = Boolean(collegataA);
      riga.hidden = !isMultiplo(x);
      nota.hidden = !altre;
      nota.textContent = altre === 1 ? 'Collegata a 1 altra scheda' : `Collegata a ${altre} altre schede`;
    });
    return h('div', { class: 'campo', 'data-campo': 'pazienti' },
      h('label', { class: 'interruttore' }, spunta, 'Paziente multiplo'), nota, riga, aggiungi);
  }

  /** Il riquadro verde sotto la MISSIONE quando la scheda è collegata a un intervento con più pazienti. */
  const collegataEl = h('div', { class: 'campo' });
  quando(() => {
    const prima = collegataA && trova(collegataA);
    collegataEl.hidden = !prima;
    collegataEl.replaceChildren(...(prima ? [messaggioCollegata(prima)] : []));
  });

  /** Etichetta visibile, oppure solo per i lettori di schermo quando il titolo della sezione dice già cos'è. */
  const intestazione = (etichetta, nascosta) => h('span', { class: nascosta ? 'sr' : 'etichetta' }, etichetta);

  /** Pulsanti a scelta singola; un secondo tocco sulla voce scelta la toglie. */
  function chips(chiave, etichetta, nomeLista, { griglia = false, senzaEtichetta = false } = {}) {
    const gruppo = h('div', { class: `chips${griglia ? ' griglia-2' : ''}`, role: 'group', 'aria-label': etichetta });
    const disegna = (x) => {
      gruppo.replaceChildren(...vociPerScelta(stato.liste[nomeLista], x[chiave]).map((voce) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(x[chiave] === voce),
        onclick: () => cambia(chiave, r[chiave] === voce ? '' : voce),
      }, voce)));
    };
    disegna(r);
    quando(disegna);
    return h('div', { class: 'campo', 'data-campo': chiave }, intestazione(etichetta, senzaEtichetta), gruppo);
  }

  /** Liste lunghe: le voci più usate come pulsanti e, nella stessa riga, il menu con tutte le altre. */
  function chipsConMenu(chiave, etichetta, nomeLista, campiUso, { senzaEtichetta = false } = {}) {
    const usate = piuUsate(stato.record, campiUso, 40);
    const gruppo = h('div', { class: 'chips', role: 'group', 'aria-label': etichetta });
    const menu = h('select', {
      class: 'select chip-menu', 'aria-label': `${etichetta}: tutte le voci`,
      onchange: (e) => cambia(chiave, e.target.value),
    });
    const disegna = (x) => {
      const voci = vociPerScelta(stato.liste[nomeLista], x[chiave]);
      const n = scorciatoie();
      const rapide = usate.filter((v) => voci.includes(v)).slice(0, n);
      const mostrate = rapide.length ? rapide : voci.slice(0, n);
      const nelMenu = Boolean(x[chiave]) && !mostrate.includes(x[chiave]);
      menu.replaceChildren(
        h('option', { value: '' }, nelMenu ? '— Nessuno —' : 'Altro…'),
        ...voci.filter((v) => !mostrate.includes(v) || v === x[chiave]).map((voce) => h('option', { value: voce }, voce)),
      );
      menu.value = nelMenu ? x[chiave] : '';
      menu.classList.toggle('scelto', nelMenu);
      gruppo.replaceChildren(...mostrate.map((voce) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(x[chiave] === voce),
        onclick: () => cambia(chiave, r[chiave] === voce ? '' : voce),
      }, voce)), menu);
    };
    disegna(r);
    quando(disegna);
    return h('div', { class: 'campo', 'data-campo': chiave }, intestazione(etichetta, senzaEtichetta), gruppo);
  }

  /** La firma dell'app: striscia a strappo dei codici colore. */
  function striscia(chiave, etichetta, nomeLista) {
    const gruppo = h('div', { class: 'strappo', role: 'radiogroup', 'aria-label': etichetta });
    const voci = vociPerScelta(stato.liste[nomeLista], r[chiave]);
    const bottoni = voci.map((voce) => h('button', {
      type: 'button', role: 'radio', class: 'striscia', 'data-codice': voce, 'aria-checked': 'false',
      onclick: () => cambia(chiave, r[chiave] === voce ? '' : voce),
    }, icona('spunta', 'ico spunta'), voce));
    gruppo.append(...bottoni);
    const disegna = (x) => {
      gruppo.classList.toggle('scelto', Boolean(x[chiave]));
      for (const b of bottoni) b.setAttribute('aria-checked', String(b.dataset.codice === x[chiave]));
    };
    disegna(r);
    quando(disegna);
    return h('div', { class: 'campo', 'data-campo': chiave }, h('span', { class: 'etichetta' }, etichetta), gruppo);
  }

  /** Manovre: più scelte insieme, un tocco accende e il secondo spegne. */
  function manovre() {
    const bottoni = MANOVRE.map(({ codice, nome }) => h('button', {
      type: 'button', class: 'chip manovra', 'aria-pressed': 'false', onclick: () => cambia('_manovra', codice),
    }, h('strong', {}, codice), ` · ${nome}`));
    quando((x) => {
      bottoni.forEach((b, i) => b.setAttribute('aria-pressed', String((x.manovre ?? []).includes(MANOVRE[i].codice))));
    });
    return h('div', { class: 'campo', 'data-campo': 'manovre' }, h('span', { class: 'etichetta' }, 'Manovre'),
      h('div', { class: 'chips manovre', role: 'group', 'aria-label': 'Manovre' }, bottoni));
  }

  function sezione(titolo, ...contenuto) {
    return h('section', { class: 'sezione' }, h('h2', {}, titolo), ...contenuto);
  }

  // ------------------------------------------------------------ sezioni come nel foglio

  const ospedale = chipsConMenu('ospedale', 'Ospedale', 'ospedale', ['ospedale']);
  quando((x) => { ospedale.hidden = x.esito !== 'Trasportato'; });

  const copia = h('button', { type: 'button', class: 'bottone piccolo', onclick: () => cambia('_copia') }, icona('copia'), 'Copia da invio');

  const calcolatiEl = h('dl', { class: 'calcolati' });
  quando((x) => {
    const c = calcolati(x);
    const voce = (t, v) => h('div', {}, h('dt', {}, t), h('dd', {}, v));
    calcolatiEl.replaceChildren(
      voce('Durata', c.durata === null ? '—' : `${c.durata} min`),
      voce('Mese', c.mese ?? '—'),
      voce('Ora', c.ora ?? '—'),
      voce('Δ codice', c.delta === null ? '—' : c.delta > 0 ? `+${c.delta}` : numero(c.delta)),
    );
  });

  const controlliEl = h('div', { class: 'esiti-controlli', 'aria-live': 'polite' });
  quando((x) => {
    const altri = stato.record.filter((y) => y.id !== x.id);
    // una scheda nuova si salva con createdAt di adesso: negli avvisi è l'ultima del suo intervento, come sarà salvata
    const comeSalvata = modifica ? x : { ...x, createdAt: new Date().toISOString() };
    const lista = avvisi(comeSalvata, indiceMissioni([...altri, comeSalvata]));
    const v = verifica;
    const blocchi = [];
    if (v.duplicatoDi) blocchi.push(messaggioDuplicato(x.missione, trova(v.duplicatoDi), v.duplicatoDi, { nota: v.errori[1] }));
    const altriAvvisi = lista.filter((a) => !(v.duplicatoDi && a === 'Missione duplicata'));
    if (altriAvvisi.length) {
      blocchi.push(h('div', { class: 'messaggio avviso' }, icona('avviso'),
        h('div', {}, h('p', {}, h('strong', {}, 'Da controllare (puoi salvare lo stesso)')),
          h('ul', {}, altriAvvisi.map((a) => h('li', {}, a))))));
    }
    controlliEl.replaceChildren(...blocchi);
  });

  const tempi = sezione('Tempi', ora('liberoOperativo', 'Libero operativo'), calcolatiEl);
  const volo = sezione('Volo',
    chips('tipoMissione', 'Tipo missione', 'tipoMissione'),
    h('div', { class: 'riga-campi' }, campoNumerico('tempoVolo', 'Tempo di volo (min)')),
    manovre());
  // solo per gli elicotteri; gli avvisi restano in fondo all'ultima sezione visibile
  quando((x) => {
    volo.hidden = !isElicottero(x.mezzo);
    (volo.hidden ? tempi : volo).append(controlliEl);
  });

  // solo nel nuovo intervento, in cima al modulo
  const foto = modifica ? null : creaFotoTablet({ dopoLettura: daFoto });

  const modulo = h('form', { class: 'modulo', novalidate: true, onsubmit: (e) => { e.preventDefault(); salva(); } },
    foto?.elemento,
    sezione('Identificazione',
      data('data', 'Data'),
      h('div', { class: 'riga-campi' }, missione(), ora('oraAllert', 'Ora allert.')),
      collegataEl,
      pazienti()),
    sezione('Mezzo',
      comune(),
      chipsConMenu('mezzo', 'Mezzo', 'mezzo', ['mezzo'], { senzaEtichetta: true }),
      chips('tipologia', 'Tipologia', 'tipologia', { griglia: true })),
    sezione('Invio CO',
      striscia('codiceInvio', 'Codice', 'codiceInvio'),
      chipsConMenu('patologiaInvio', 'Patologia', 'patologia', ['patologiaInvio', 'patologiaRientro']),
      chips('luogoInvio', 'Luogo', 'luogo')),
    sezione('Paziente',
      h('div', { class: 'riga-campi' }, campoNumerico('eta', 'Età')),
      chips('sesso', 'Sesso', 'sesso', { griglia: true })),
    sezione('Esito',
      chips('esito', 'Esito', 'esito', { senzaEtichetta: true }),
      ospedale),
    h('section', { class: 'sezione' },
      h('h2', {}, 'Rientro', copia),
      striscia('codiceRientro', 'Codice', 'codiceRientro'),
      chipsConMenu('patologiaRientro', 'Patologia', 'patologia', ['patologiaRientro', 'patologiaInvio']),
      chips('luogoRientro', 'Luogo', 'luogo')),
    tempi,
    volo,
  );
  quando(() => {
    for (const el of modulo.querySelectorAll('[data-campo]')) el.classList.toggle('da-foto', evidenziati.has(el.dataset.campo));
  });

  // ------------------------------------------------------------ azioni

  const salvaBtn = h('button', { type: 'submit', class: 'bottone primario', form: 'modulo-intervento' },
    icona('spunta'), modifica ? 'Salva modifiche' : 'Salva intervento');
  modulo.id = 'modulo-intervento';
  const barra = h('div', { class: 'barra-azioni' },
    modifica && h('button', { type: 'button', class: 'bottone pericolo', onclick: elimina, 'aria-label': 'Elimina intervento' }, icona('cestino'), 'Elimina'),
    !modifica && h('button', { type: 'button', class: 'bottone', onclick: svuota }, 'Svuota'),
    salvaBtn);

  async function salva() {
    const v = verificaSalvataggio(r, stato.record, originale);
    if (!v.ok) {
      toast(v.errori[0]);
      controlliEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    salvaBtn.disabled = true;
    clearTimeout(timerBozza); // una bozza in ritardo non deve tornare dopo il salvataggio
    try {
      const adesso = new Date();
      const daSalvare = prontoPerSalvare(r, adesso, { nuovo: !modifica });
      if (modifica) {
        // la prima scheda porta il numero di pazienti sulle altre schede della MISSIONE (anche quando la spunta si accende
        // sulla prima scheda di un duplicato: le altre schede si collegano)
        const prima = isMultiplo(daSalvare) && primaScheda(stato.record, daSalvare.missione)?.id === daSalvare.id;
        await salvaIntervento(daSalvare, { altri: prima ? propagaPazienti(daSalvare, stato.record, adesso) : [] });
        modificato = false;
        toast('Modifiche salvate');
        location.hash = '#/elenco';
      } else {
        await salvaIntervento(daSalvare, { bozza: null });
        modificato = false;
        evidenziati.clear();
        foto.chiudiPannello();
        toast(`Intervento ${daSalvare.missione || 'senza missione'} salvato`, {
          etichetta: 'Apri', fai: () => { location.hash = `#/intervento/${encodeURIComponent(daSalvare.id)}`; },
        });
        // aperta da "Aggiungi paziente" (#/nuovo/<id>): ricaricare la pagina non deve riproporre la stessa scheda
        if (location.hash.startsWith('#/nuovo/')) history.replaceState(null, '', '#/nuovo');
        r = recordVuoto(crypto.randomUUID(), new Date());
        collegataA = null;
        aggiorna();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (errore) {
      toast(`Salvataggio non riuscito: ${errore.message}`);
    } finally {
      salvaBtn.disabled = false;
    }
  }

  async function elimina() {
    const ok = await conferma({
      titolo: 'Eliminare questo intervento?',
      testo: `${r.missione ? `Missione ${r.missione}` : 'Intervento senza missione'}${r.data ? ` del ${dataBreve(r.data)}` : ''}. Sparirà dall'elenco e dalle statistiche; l'eliminazione arriva anche sugli altri dispositivi con il prossimo backup.`,
      si: 'Elimina', pericolo: true,
    });
    if (!ok) return;
    await eliminaIntervento(r.id);
    modificato = false;
    toast('Intervento eliminato');
    location.hash = '#/elenco';
  }

  async function svuota() {
    if (modificato || stato.meta.bozza) {
      const ok = await conferma({ titolo: 'Svuotare il modulo?', testo: 'I dati inseriti e non salvati andranno persi.', si: 'Svuota', pericolo: true });
      if (!ok) return;
    }
    clearTimeout(timerBozza);
    r = recordVuoto(crypto.randomUUID(), new Date());
    collegataA = null;
    modificato = false;
    evidenziati.clear();
    foto.chiudiPannello();
    await impostaMeta({ bozza: null });
    aggiorna();
  }

  main.append(modulo, barra);
  aggiorna();

  return {
    async puoiUscire() {
      if (!modifica || !modificato) return true;
      return conferma({ titolo: 'Uscire senza salvare?', testo: 'Le modifiche a questo intervento andranno perse.', si: 'Esci', no: 'Resta', pericolo: true });
    },
    /** Prima di cambiare schermata: chiude la foto e il suo lettore. */
    smonta() {
      foto?.smonta();
    },
  };
}
