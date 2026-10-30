// Worker Cloudflare dell'app: serve i file statici e traduce le domande all'archivio con Claude.
// Riceve solo il testo della domanda, le voci delle liste e i nomi dei comuni: mai gli interventi.
// La chiave Anthropic e la parola d'ordine sono segreti di Cloudflare (CHIAVE_ANTHROPIC, PAROLA_ORDINE).
// Nessun log del testo delle domande.
import {
  validaQuery, estraiJson, MISURE, GRUPPI, OPERATORI, GIORNI_SETTIMANA, CAMPI_FILTRO,
} from '../js/core/domande.js';
import { isDataValida } from '../js/core/campi.js';

export const MODELLI = ['claude-haiku-5-5', 'claude-sonnet-5-5'];
const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const ATTESA_MASSIMA = 20000;
const MAX_VOCI = 2000;

export const PROMPT_SISTEMA = `Traduci domande in italiano sull'archivio personale di un infermiere del 118 (ambulanza ed elisoccorso) in una query JSON. Non vedi i dati: la query la esegue l'app sul telefono. Rispondi SOLO con un oggetto JSON, senza testo prima o dopo.

## L'archivio
Ogni intervento è una missione con questi campi:
- data (AAAA-MM-GG), oraAllert (ora di allertamento, HH:MM), missione (codice), comune
- mezzo (sigla del mezzo: ambulanze come 3030 o 5022, elicotteri V-ECHO, T-ECHO, C-ECHO, A-ECHO)
- tipologia: India (mezzo infermieristico) o Mike (mezzo medicalizzato)
- codiceInvio, patologiaInvio, luogoInvio: come la Centrale Operativa ha inviato il mezzo
- codiceRientro, patologiaRientro, luogoRientro: come è stato valutato sul posto
- codici colore: VERDE < GIALLO < ROSSO; NERO (deceduto) solo al rientro
- eta (anni), sesso (Maschio/Femmina), esito (es. Trasportato, Deceduto, Annullato da CO, Non Raggiungibile), ospedale (solo se trasportato)
- liberoOperativo (ora in cui il mezzo torna libero, HH:MM)
- tipoMissione (HEMS, HSR, IFT: solo elicotteri), tempoVolo (minuti di volo: solo elicotteri)
Valori calcolati: durata (minuti da allertamento a libero operativo, anche oltre la mezzanotte), ora (ora del giorno dell'allertamento, 0-23), giornoSettimana (${GIORNI_SETTIMANA.join(', ')}).
"Uscire" o "fare un intervento" = un intervento. Un intervento "valutato" è uno non annullato (esito diverso da Annullato da CO e Non Raggiungibile).

## Le tre risposte possibili
1. Query:
{"tipo":"query","interpretazione":"…","misura":"…","gruppi":[],"filtri":[],"periodo":null,"confronto":null,"ordine":"max","primi":1}
- interpretazione: frase breve in italiano su come hai inteso la domanda (es. "Interventi per ora del giorno").
- misura, una tra: ${MISURE.join(', ')}. Conteggi: interventi, valutati, trasportati. Durate in minuti: durataMedia, durataMediana, durataMax. Età: etaMedia, etaMediana. Quote (frazione 0-1 di ogni gruppo): pctTotali (sul totale), pctValutati (sui valutati).
- gruppi: da 0 a 2 tra ${GRUPPI.join(', ')}. ora = ora di allertamento; giorno = singola data; mese = AAAA-MM; fasciaEta = 0–17, 18–40, 41–65, 66–80, oltre 80. Con 2 gruppi l'app mostra una tabella a doppia entrata.
- filtri: elenco di {"campo","op","valore"}. campo tra ${CAMPI_FILTRO.join(', ')}. op tra ${OPERATORI.join(', ')}. >, >=, <, <= solo su eta, tempoVolo, durata, ora, con un numero. "in" vuole un elenco non vuoto. giornoSettimana con i valori ${GIORNI_SETTIMANA.join(', ')}; ora con un numero 0-23.
- periodo: null se la domanda non nomina un periodo (l'app usa quello scelto sulla pagina). Altrimenti {"tipo":"anno","anno":2026}, {"tipo":"mese","anno":2026,"mese":7}, {"tipo":"intervallo","da":"AAAA-MM-GG","a":"AAAA-MM-GG"} o {"tipo":"tutto"}. Le date relative ("quest'anno", "il mese scorso", "ultimi 30 giorni") calcolale dalla data di oggi indicata sotto.
- confronto: per confrontare due periodi {"periodoA":periodo,"periodoB":periodo}, con gruppi vuoti; periodoA è il primo nominato o il più vecchio. Altrimenti null.
- ordine: max (dal valore più alto), min (dal più basso), nessuno (ordine naturale: per serie nel tempo, distribuzioni, tabelle).
- primi: quanti gruppi mostrare (1-50) o null per tutti. "Qual è l'ora in cui esco di più?" → gruppi ["ora"], ordine max, primi null: l'app evidenzia la prima e mostra la classifica.
2. Controdomanda, solo se la domanda è ambigua in un modo che cambia il risultato: {"tipo":"controdomanda","testo":"…"} (una domanda breve).
3. Rifiuto, se la domanda non si può calcolare con questi campi: {"tipo":"rifiuto","testo":"…","esempi":["…","…","…"]} con esattamente 3 domande simili a quella dell'utente che si possono fare.

## Regole
- Mai campi diversi da quelli elencati.
- Mezzi, esiti, ospedali, patologie, luoghi, codici, tipologie: usa esattamente le voci delle liste qui sotto. Patologie e luoghi hanno il codice davanti ("02 - Cardio", "K - Casa").
- Comuni: se somiglia a uno dei comuni qui sotto usa quella grafia, altrimenti scrivilo come lo scrive l'utente.
- Se l'utente risponde a una tua controdomanda, non farne un'altra: rispondi con una query o un rifiuto.`;

const json = (corpo, stato = 200) => new Response(JSON.stringify(corpo), {
  status: stato, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const errore = (stato, testo) => json({ errore: testo }, stato);

/** Confronto a tempo costante: non rivela quanti caratteri della parola d'ordine sono giusti. */
function stessaParola(data, attesa) {
  const a = new TextEncoder().encode(String(data ?? ''));
  const b = new TextEncoder().encode(String(attesa));
  const stessaLunghezza = a.length === b.length;
  const x = stessaLunghezza ? a : b;
  if (crypto.subtle?.timingSafeEqual) return crypto.subtle.timingSafeEqual(x, b) && stessaLunghezza;
  let diversi = 0;
  for (let i = 0; i < b.length; i++) diversi |= x[i] ^ b[i];
  return diversi === 0 && stessaLunghezza;
}

/** Motivo per cui il corpo della richiesta non va bene, o null. */
function erroreCorpo(c) {
  if (typeof c.domanda !== 'string' || !c.domanda.trim() || c.domanda.length > 500) return 'La domanda deve avere da 1 a 500 caratteri.';
  if (!isDataValida(c.oggi)) return 'Data di oggi mancante.';
  const liste = c.liste ?? {};
  if (typeof liste !== 'object' || Array.isArray(liste)) return 'Liste non valide.';
  const voci = Object.values(liste);
  if (!voci.every((v) => Array.isArray(v) && v.every((x) => typeof x === 'string'))) return 'Liste non valide.';
  if (voci.reduce((n, v) => n + v.length, 0) > MAX_VOCI) return 'Troppe voci nelle liste.';
  const comuni = c.comuni ?? [];
  if (!Array.isArray(comuni) || !comuni.every((x) => typeof x === 'string') || comuni.length > MAX_VOCI) return 'Comuni non validi.';
  const cd = c.controdomanda;
  if (cd !== undefined && cd !== null && (typeof cd?.testo !== 'string' || typeof cd?.risposta !== 'string'
    || cd.testo.length > 500 || !cd.risposta.trim() || cd.risposta.length > 500)) return 'Risposta alla controdomanda non valida.';
  return null;
}

function promptCompleto({ oggi, liste = {}, comuni = [] }) {
  const righeListe = Object.entries(liste).map(([nome, voci]) => `- ${nome}: ${voci.join(' | ')}`).join('\n');
  return `${PROMPT_SISTEMA}

## Dati di contesto
Oggi è ${oggi}.
Voci delle liste:
${righeListe || '- (nessuna)'}
Comuni presenti in archivio: ${comuni.length ? comuni.join(' | ') : '(nessuno)'}`;
}

function messaggioUtente({ domanda, controdomanda }) {
  if (!controdomanda) return domanda;
  return `Domanda: ${domanda}
Tu hai chiesto: ${controdomanda.testo}
Risposta dell'utente: ${controdomanda.risposta}
Ora rispondi con una query o un rifiuto, senza altre controdomande.`;
}

/** Chiede a un modello la traduzione; restituisce la risposta validata o null se non è conforme. */
async function traduci(fetchAnthropic, env, modello, corpo) {
  const sonnet = modello.startsWith('claude-sonnet');
  const intestazioni = {
    'content-type': 'application/json', 'x-api-key': env.CHIAVE_ANTHROPIC, 'anthropic-version': '2023-06-01',
  };
  // Sonnet, il secondo tentativo: se i suoi filtri di sicurezza rifiutano, il server riprova con il modello consigliato
  if (sonnet) intestazioni['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  const risposta = await fetchAnthropic(URL_ANTHROPIC, {
    method: 'POST',
    headers: intestazioni,
    signal: AbortSignal.timeout(ATTESA_MASSIMA),
    body: JSON.stringify({
      model: modello,
      // Haiku senza ragionamento: tutti i token vanno al JSON. Sonnet ragiona poco (sforzo basso), con più spazio.
      ...(sonnet
        ? { max_tokens: 2000, output_config: { effort: 'low' }, fallbacks: 'default' }
        : { max_tokens: 600, thinking: { type: 'disabled' }, output_config: { effort: 'low' } }),
      system: promptCompleto(corpo),
      messages: [{ role: 'user', content: messaggioUtente(corpo) }],
    }),
  });
  if (!risposta.ok) throw Object.assign(new Error(`Anthropic ${risposta.status}`), { stato: risposta.status });
  const dati = await risposta.json();
  if (dati.stop_reason === 'refusal') return null;
  const testo = (dati.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const esito = validaQuery(estraiJson(testo));
  if (!esito.ok) return null;
  if (corpo.controdomanda && esito.query.tipo === 'controdomanda') return null; // al massimo una controdomanda
  return esito.query;
}

async function rispondiDomanda(richiesta, env, fetchAnthropic) {
  if (!env.PAROLA_ORDINE || !env.CHIAVE_ANTHROPIC) {
    return errore(503, 'Il servizio delle domande non è ancora configurato: mancano i segreti su Cloudflare.');
  }
  let corpo;
  try {
    corpo = await richiesta.json();
  } catch {
    return errore(400, 'Richiesta non valida.');
  }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return errore(400, 'Richiesta non valida.');
  if (!stessaParola(corpo.parolaOrdine, env.PAROLA_ORDINE)) return errore(401, 'Parola d\'ordine errata.');
  const motivo = erroreCorpo(corpo);
  if (motivo) return errore(400, motivo);
  try {
    for (const modello of MODELLI) {
      const query = await traduci(fetchAnthropic, env, modello, corpo);
      if (query) return json({ ...query, modello });
    }
    return errore(502, 'Non sono riuscito a tradurre la domanda.');
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return errore(504, 'Claude non ha risposto in tempo. Riprova.');
    if (e.stato === 401 || e.stato === 403) return errore(502, 'Claude ha rifiutato la chiave: controlla CHIAVE_ANTHROPIC su Cloudflare.');
    return errore(502, 'Claude non risponde in questo momento. Riprova tra poco.');
  }
}

/** Gestore con le dipendenze iniettabili, per i test. */
export function creaGestore({ fetchAnthropic = (...a) => globalThis.fetch(...a) } = {}) {
  return async (richiesta, env) => {
    const url = new URL(richiesta.url);
    if (richiesta.method === 'POST' && url.pathname === '/api/domanda') return rispondiDomanda(richiesta, env, fetchAnthropic);
    return env.ASSETS.fetch(richiesta);
  };
}

const gestisci = creaGestore();
export default { fetch: (richiesta, env) => gestisci(richiesta, env) };
