// Riquadro "Fai una domanda" in cima alle Statistiche. Claude (tramite il Worker) traduce la domanda in una query;
// la risposta la calcola il dispositivo. Partono solo la domanda, le voci delle liste e i nomi dei comuni.
// Nessuno storico: domanda e risposta spariscono quando si lascia la pagina.
import { stato } from '../stato.js';
import { eseguiQuery, comuniDistinti, validaQuery, GIORNI_SETTIMANA } from '../core/domande.js';
import { FASCE_ETA } from '../core/statistiche.js';
import { dataLocale } from '../core/modulo.js';
import { h, riempi, icona, conteggio, numero, pct } from './dom.js';
import { caricaScript, CHART } from './file.js';
import { voceKpi, unita, configBarre, colore } from './statistiche.js';

const ESEMPI = [
  'Qual è l\'ora in cui esco di più?',
  'In quale giorno ho fatto più interventi?',
  'Durata media per mezzo',
  'Quanti codici rossi quest\'anno rispetto all\'anno scorso?',
];
const NOMI_GRUPPI = {
  ora: 'Ora', giornoSettimana: 'Giorno', giorno: 'Giorno', mese: 'Mese', anno: 'Anno', comune: 'Comune', mezzo: 'Mezzo',
  tipologia: 'Tipologia', codiceInvio: 'Codice invio', codiceRientro: 'Codice rientro', patologiaInvio: 'Patologia invio',
  patologiaRientro: 'Patologia rientro', luogoInvio: 'Luogo invio', luogoRientro: 'Luogo rientro', esito: 'Esito',
  ospedale: 'Ospedale', fasciaEta: 'Fascia di età', sesso: 'Sesso', tipoMissione: 'Tipo missione',
};
const NOMI_MISURE = {
  interventi: 'Interventi', valutati: 'Valutati', trasportati: 'Trasportati', durataMedia: 'Durata media',
  durataMediana: 'Durata mediana', durataMax: 'Durata massima', etaMedia: 'Età media', etaMediana: 'Età mediana',
  pctTotali: '% sul totale', pctValutati: '% sui valutati',
};
const CONTEGGI = ['interventi', 'valutati', 'trasportati'];
const isPct = (misura) => misura.startsWith('pct');
const UNITA_TABELLA = { durataMedia: ' (min)', durataMediana: ' (min)', durataMax: ' (min)', etaMedia: ' (anni)', etaMediana: ' (anni)' };
/** Gruppi con un ordine proprio (orologio, calendario, età): il grafico li mostra in quell'ordine anche se la tabella è una classifica. */
const POSIZIONE = {
  ora: (k) => Number(k), giorno: null, mese: null, anno: null,
  giornoSettimana: (k) => GIORNI_SETTIMANA.indexOf(k), fasciaEta: (k) => FASCE_ETA.findIndex(([voce]) => voce === k),
};
function inOrdineNaturale(gruppo, righe) {
  if (!(gruppo in POSIZIONE)) return righe;
  const pos = POSIZIONE[gruppo];
  const chiave = (x) => x.chiavi[0];
  return [...righe].sort((a, b) => {
    if (chiave(a) === '—' || chiave(b) === '—') return (chiave(a) === '—') - (chiave(b) === '—');
    return pos ? pos(chiave(a)) - pos(chiave(b)) : chiave(a).localeCompare(chiave(b));
  });
}
/** Valore in tabella: il numero, l'unità sta nell'intestazione. */
function cella(misura, v) {
  if (v === null || v === undefined) return '—';
  if (CONTEGGI.includes(misura)) return conteggio(v);
  return isPct(misura) ? pct(v) : numero(v);
}

/** [cifra, unità] della misura: "23" "interventi", "38" "min", "61,2%". */
function formatta(misura, v) {
  if (v === null || v === undefined) return ['—', ''];
  if (CONTEGGI.includes(misura)) return [conteggio(v), misura === 'interventi' ? (v === 1 ? 'intervento' : 'interventi') : misura];
  if (misura.startsWith('durata')) return [numero(v), 'min'];
  if (misura.startsWith('eta')) return [numero(v), 'anni'];
  return [pct(v), ''];
}
const testo = (misura, v) => formatta(misura, v).filter(Boolean).join(' ');

function differenza(misura, d, variazione) {
  if (d === null) return 'Differenza: —';
  const segno = d > 0 ? '+' : d < 0 ? '−' : '';
  const assoluta = Math.abs(d);
  const valore = isPct(misura) ? `${numero(assoluta * 100)} punti` : testo(misura, assoluta);
  const quota = variazione === null ? '' : ` (${variazione > 0 ? '+' : variazione < 0 ? '−' : ''}${numero(Math.abs(variazione))}%)`;
  return `Differenza: ${segno}${valore}${quota}`;
}

const vociListe = () => Object.fromEntries(Object.entries(stato.liste).map(([nome, voci]) => [nome, voci.map((v) => v.voce)]));

/** Chiede al Worker la traduzione. Restituisce la risposta validata o lancia un errore con il testo da mostrare. */
async function chiedi(domanda, controdomanda) {
  const corpo = {
    parolaOrdine: stato.meta.parolaOrdineDomande, domanda, oggi: dataLocale(new Date()),
    liste: vociListe(), comuni: comuniDistinti(stato.record), ...(controdomanda ? { controdomanda } : {}),
  };
  let risposta;
  try {
    risposta = await fetch('api/domanda', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  } catch {
    throw new Error('Non riesco a contattare il servizio. Riprova.');
  }
  const dati = await risposta.json().catch(() => null);
  if (risposta.status === 401) throw new Error('Parola d\'ordine errata: controlla le Impostazioni.');
  if (!risposta.ok) throw new Error(dati?.errore ?? 'Non riesco a contattare il servizio. Riprova.');
  const { modello, ...resto } = dati ?? {};
  const esito = validaQuery(resto);
  if (!esito.ok) throw new Error('Il servizio ha dato una risposta che non capisco. Riprova.');
  return esito.query;
}

/**
 * Monta il riquadro in `contenitore`. periodoCorrente() dà il periodo scelto sulla pagina,
 * usato quando la domanda non ne nomina uno.
 */
export function montaDomande(contenitore, { periodoCorrente }) {
  const sezione = h('section', { class: 'blocco domande', 'aria-labelledby': 'titolo-domande' });
  let domanda = '';
  let esito = null; // { tipo: 'attesa' | 'errore' | 'controdomanda' | 'rifiuto' | 'risposta', … }
  let grafico = null;

  const togliGrafico = () => {
    grafico?.destroy();
    grafico = null;
  };

  async function invia(testoDomanda, controdomanda = null) {
    const d = testoDomanda.trim();
    if (!d || esito?.tipo === 'attesa' || !navigator.onLine) return;
    domanda = d;
    esito = { tipo: 'attesa' };
    disegna();
    try {
      const query = await chiedi(d, controdomanda);
      if (query.tipo === 'query') {
        esito = { tipo: 'risposta', query, risultato: eseguiQuery(stato.record, stato.liste, query, periodoCorrente()) };
      } else {
        esito = { ...query, domanda: d };
      }
    } catch (errore) {
      esito = { tipo: 'errore', testo: errore.message };
    }
    disegna();
  }

  function campoDomanda() {
    const inLinea = navigator.onLine;
    const campo = h('textarea', {
      class: 'input', rows: 1, 'aria-label': 'Domanda', enterkeyhint: 'send', placeholder: 'Es. in che mese esco di più?',
      disabled: !inLinea,
    });
    campo.value = domanda;
    const esempi = h('div', { class: 'chips esempi', hidden: domanda !== '' || !inLinea },
      ESEMPI.map((e) => h('button', { type: 'button', class: 'chip', onclick: () => invia(e) }, e)));
    const cresci = () => {
      campo.style.height = 'auto';
      campo.style.height = `${campo.scrollHeight + 2}px`;
    };
    campo.addEventListener('input', () => {
      domanda = campo.value;
      esempi.hidden = campo.value.trim() !== '';
      cresci();
    });
    campo.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); invia(campo.value); }
    });
    requestAnimationFrame(cresci);
    const inAttesa = esito?.tipo === 'attesa';
    return [
      h('div', { class: 'con-bottone' }, campo,
        h('button', { type: 'button', class: 'bottone primario', disabled: !inLinea || inAttesa, onclick: () => invia(campo.value) },
          icona('cerca'), 'Chiedi')),
      inLinea ? null : h('p', { class: 'nota-domande' }, 'Serve la rete per fare domande.'),
      esempi,
      inLinea ? h('p', { class: 'nota-domande' }, 'La domanda, le voci delle liste e i nomi dei comuni vengono inviati a Claude per capire cosa chiedi. Gli interventi restano sul dispositivo.') : null,
    ];
  }

  function disegnaEsito() {
    if (!esito) return null;
    if (esito.tipo === 'attesa') return h('p', { class: 'nota-domande', 'aria-busy': 'true' }, 'Sto traducendo la domanda…');
    if (esito.tipo === 'errore') return h('div', { class: 'messaggio avviso', role: 'alert' }, icona('avviso'), h('p', {}, esito.testo));
    if (esito.tipo === 'controdomanda') {
      const campo = h('input', { id: 'risposta-controdomanda', class: 'input', type: 'text', enterkeyhint: 'send' });
      const rispondi = () => {
        if (campo.value.trim()) invia(esito.domanda, { testo: esito.testo, risposta: campo.value.trim() });
      };
      campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); rispondi(); } });
      return h('div', { class: 'controdomanda' },
        h('p', {}, h('strong', {}, esito.testo)),
        h('label', { class: 'etichetta', for: 'risposta-controdomanda' }, 'Risposta'),
        h('div', { class: 'con-bottone' }, campo,
          h('button', { type: 'button', class: 'bottone', disabled: !navigator.onLine, onclick: rispondi }, 'Rispondi')));
    }
    if (esito.tipo === 'rifiuto') {
      return h('div', {}, h('p', {}, esito.testo),
        h('div', { class: 'chips' }, esito.esempi.map((e) => h('button', { type: 'button', class: 'chip', onclick: () => invia(e) }, e))));
    }
    return disegnaRisposta(esito.risultato, esito.query);
  }

  function disegnaRisposta(r, query) {
    const { misura } = r;
    if (r.confronto) {
      const { a, b } = r.confronto;
      const casella = (lato) => {
        const [cifra, u] = formatta(misura, lato.valore);
        return voceKpi(lato.descrizionePeriodo, [cifra, u ? unita(u) : null].filter(Boolean),
          `su ${conteggio(lato.n)} ${lato.n === 1 ? 'intervento' : 'interventi'}`);
      };
      return h('div', { class: 'risposta' },
        h('dl', { class: 'kpi due' }, casella(a), casella(b)),
        h('p', { class: 'cifra-nota' }, differenza(misura, r.confronto.differenza, r.confronto.variazionePct)),
        h('p', { class: 'nota-domande' }, `Inteso come: ${query.interpretazione}`));
    }
    const nota = h('p', { class: 'nota-domande' },
      `Inteso come: ${query.interpretazione} · ${r.descrizionePeriodo} · su ${conteggio(r.base)} ${r.base === 1 ? 'intervento' : 'interventi'}`);
    if (!query.gruppi.length) return h('div', { class: 'risposta' }, cifra(null, misura, r.righe[0].valore), nota);
    const primo = r.evidenziata === null ? null : r.righe[r.evidenziata];
    const pari = primo ? r.righe.filter((x) => x !== primo && x.valore === primo.valore && x.valore !== null) : [];
    return h('div', { class: 'risposta' },
      primo ? cifra(primo.etichette[0], misura, primo.valore) : null,
      pari.length ? h('p', { class: 'cifra-nota' }, `A pari merito: ${pari.slice(0, 5).map((x) => x.etichette[0]).join(', ')}${pari.length > 5 ? '…' : ''}`) : null,
      nota,
      query.gruppi.length === 1 && r.righe.length >= 3 ? graficoRisposta(r, query) : null,
      tabellaRisposta(r, query));
  }

  function cifra(gruppo, misura, valore) {
    const [c, u] = formatta(misura, valore);
    return h('p', { class: 'cifra' }, gruppo ? h('span', { class: 'gruppo' }, gruppo) : null,
      h('span', { class: 'valore' }, c, u ? h('span', { class: 'unita' }, u) : null));
  }

  function graficoRisposta(r, query) {
    const canvas = h('canvas', { role: 'img', 'aria-label': query.interpretazione });
    const righe = inOrdineNaturale(query.gruppi[0], r.righe);
    const etichette = righe.map((x) => (query.gruppi[0] === 'ora' ? x.chiavi[0] : x.etichette[0]));
    const dati = righe.map((x) => (x.valore === null ? null : isPct(r.misura) ? x.valore * 100 : x.valore));
    const orizzontale = r.righe.length > 12 && !['ora', 'giorno', 'mese'].includes(query.gruppi[0]);
    const config = configBarre({
      etichette, serie: [{ label: NOMI_MISURE[r.misura], data: dati, backgroundColor: colore('--inchiostro') }],
      asse: isPct(r.misura) ? 'pct' : 'numero', saltaEtichette: !orizzontale && r.righe.length > 12, orizzontale,
    });
    caricaScript(CHART).then(() => {
      if (!canvas.isConnected) return;
      togliGrafico();
      grafico = new window.Chart(canvas, config);
    }).catch((errore) => canvas.replaceWith(h('p', { class: 'nota-tabella' }, `Grafico non disponibile: ${errore.message}`)));
    return h('div', { class: 'tela-risposta', style: `height:${orizzontale ? Math.max(240, r.righe.length * 24) : 240}px` }, canvas);
  }

  function tabellaRisposta(r, query) {
    const valore = (v) => cella(r.misura, v);
    const colonneConteggio = !CONTEGGI.includes(r.misura) && !r.colonne;
    const testa = r.colonne
      ? [`${NOMI_GRUPPI[query.gruppi[0]]} · ${NOMI_GRUPPI[query.gruppi[1]]}`, ...r.etichetteColonne, 'Totale']
      : [NOMI_GRUPPI[query.gruppi[0]], `${NOMI_MISURE[r.misura]}${UNITA_TABELLA[r.misura] ?? ''}`, ...(colonneConteggio ? ['Interventi'] : [])];
    const righe = r.righe.map((x, i) => h('tr', { class: i === r.evidenziata ? 'evidenziata' : null },
      h('td', {}, x.etichette[0]),
      ...(r.colonne
        ? [...r.colonne.map((c) => h('td', { class: 'n' }, valore(x.celle[c]))), h('td', { class: 'n' }, valore(x.valore))]
        : [h('td', { class: 'n' }, valore(x.valore)), ...(colonneConteggio ? [h('td', { class: 'n' }, conteggio(x.n))] : [])])));
    return h('div', { class: 'scorri' }, h('table', { class: 'tabella' },
      h('thead', {}, h('tr', {}, testa.map((t, i) => h('th', { scope: 'col', class: i ? 'n' : null }, t)))),
      h('tbody', {}, righe)));
  }

  function disegna() {
    togliGrafico();
    if (!stato.meta.parolaOrdineDomande) {
      riempi(sezione,
        h('h2', { id: 'titolo-domande' }, 'Fai una domanda'),
        h('p', {}, 'Per fare domande imposta la parola d\'ordine nelle ', h('a', { href: '#/impostazioni' }, 'Impostazioni'), '.'));
      return;
    }
    riempi(sezione, h('h2', { id: 'titolo-domande' }, 'Fai una domanda'), ...campoDomanda(),
      h('div', { class: 'esito-domanda', 'aria-live': 'polite' }, disegnaEsito()));
  }

  const cambioRete = () => disegna();
  addEventListener('online', cambioRete);
  addEventListener('offline', cambioRete);
  contenitore.append(sezione);
  disegna();
  return {
    smonta() {
      removeEventListener('online', cambioRete);
      removeEventListener('offline', cambioRete);
      togliGrafico();
    },
  };
}
