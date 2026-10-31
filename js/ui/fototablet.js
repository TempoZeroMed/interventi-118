// Pulsante "Foto tablet" del nuovo intervento: la foto della schermata Missione si legge sul dispositivo con Tesseract.
// Qui stanno la foto, il ritocco su canvas, il lettore e il riquadro con l'esito; i valori li applica inserimento.js.
// La foto resta solo in memoria: niente bozza, niente archivio, e l'URL della miniatura si rilascia chiudendo il riquadro.
import { stato, trova } from '../stato.js';
import { verificaSalvataggio } from '../core/controlli.js';
import { suggerimentiComuni } from '../core/elenco.js';
import {
  leggiSchermata, daTesseract, spostaLettura, unisciLetture, etichetta, zonaOrari, etichettaValutazione, zonaCodice,
  zonaColore, coloreRiquadro, scritteSulRiquadro, etichettaNascita, zonaSesso, punteggioSchermata, rotazioniDaProvare,
} from '../core/tablet.js';
import { caricaScript, TESSERACT, CARTELLA_TESSERACT } from './file.js';
import { h, icona, messaggioDuplicato, messaggioCollegata } from './dom.js';

const LATO_MASSIMO = 2000;
// dopo il contrasto i grigi medi si scuriscono (v^1,5): le scritte grigie e il bianco sui riquadri blu si staccano di più.
// Tarato sulla foto vera del tablet, storta e con riflessi: senza, missione, mezzo, comune ed età restavano non letti.
const CURVA = 1.5;
const INGRANDIMENTO = 2; // la fila degli orari, il riquadro del codice e la riga Sesso si rileggono ingranditi
// avanzamento mostrato: la lettura della foto intera fino all'80%, quelle dei ritagli il resto
const QUOTA_INTERA = 0.8;
// con almeno tante parole fisse della schermata la foto è dritta e non si provano le altre rotazioni (dritta se ne leggono
// una decina; girata nessuna). Con una sola si provano lo stesso, perché una parola può uscire per caso.
const PAROLE_FISSE_SICURE = 2;

/** Un ritocco di un ritaglio che fa di ogni punto il grigio tono(r, g, b). Nella foto ritoccata r = g = b. */
const inGrigio = (tono) => (px) => {
  for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = tono(px[i], px[i + 1], px[i + 2]);
};
const INVERTITO = inGrigio((v) => 255 - v); // i riquadri scuri con le scritte chiare diventano scritte scure su chiaro
// Il riquadro del codice ha il colore del codice: in grigi il ritocco scurisce il verde acceso quasi come la scritta nera,
// quindi si rilegge dalla foto a colori. Il canale più alto rende chiaro ogni colore acceso e lascia scura una scritta nera.
const SCRITTA_SCURA = inGrigio((r, g, b) => Math.max(r, g, b));

const NON_SI_APRE = 'Non riesco ad aprire questa foto: riprova con un\'altra.';
const SENZA_LETTORE = 'Il lettore non è ancora disponibile: apri l\'app una volta con la rete e riprova.';
const SENZA_DATI = 'Non trovo i dati della schermata Missione: riprova con la foto dritta, intera e senza riflessi.';
const RULLINO = 'Se l\'hai presa dalla Libreria foto, resta nel Rullino: cancellala da Foto quando hai finito.';

/** Il lettore non si è caricato (primo uso senza rete, un file mancante): l'unico errore che chiede di riaprire l'app. */
class SenzaLettore extends Error {}

/** La foto orientata come è stata scattata; un Safari meno recente non conosce l'opzione e si riprova senza. */
async function apri(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (errore) {
    if (errore instanceof TypeError || errore instanceof RangeError) return createImageBitmap(file);
    throw errore;
  }
}

/**
 * La foto pronta per il lettore: orientata, lato lungo al massimo 2000 px, in grigi, contrasto tra il 2° e il 98° percentile,
 * grigi medi più scuri. `colori` è la stessa foto prima dei grigi, per rileggere il riquadro colorato del codice.
 */
export async function preparaFoto(file) {
  const bitmap = await apri(file);
  const scala = Math.min(1, LATO_MASSIMO / Math.max(bitmap.width, bitmap.height));
  const nuovo = () => Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * scala), height: Math.round(bitmap.height * scala),
  });
  const canvas = nuovo();
  const colori = nuovo();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  colori.getContext('2d').drawImage(canvas, 0, 0);
  bitmap.close();
  const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = immagine.data;
  const grigi = new Uint8ClampedArray(px.length / 4);
  const istogramma = new Uint32Array(256);
  for (let i = 0; i < grigi.length; i++) {
    grigi[i] = 0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2];
    istogramma[grigi[i]] += 1;
  }
  const percentile = (p) => {
    let somma = 0;
    for (let v = 0; v < 256; v++) if ((somma += istogramma[v]) >= grigi.length * p) return v;
    return 255;
  };
  const scuro = percentile(0.02);
  const ampiezza = Math.max(1, percentile(0.98) - scuro);
  const tono = Array.from({ length: 256 }, (_, v) => 255 * Math.min(1, Math.max(0, (v - scuro) / ampiezza)) ** CURVA);
  for (let i = 0; i < grigi.length; i++) {
    px[4 * i] = px[4 * i + 1] = px[4 * i + 2] = tono[grigi[i]];
    px[4 * i + 3] = 255;
  }
  ctx.putImageData(immagine, 0, 0);
  return { foto: canvas, colori };
}

/** La foto preparata girata di `gradi` in senso orario (90, 180 o 270): sia quella in grigi sia quella a colori. */
export function giraFoto({ foto, colori }, gradi) {
  const gira = (sorgente) => {
    const canvas = Object.assign(document.createElement('canvas'), {
      width: gradi % 180 ? sorgente.height : sorgente.width, height: gradi % 180 ? sorgente.width : sorgente.height,
    });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((gradi * Math.PI) / 180);
    ctx.drawImage(sorgente, -sorgente.width / 2, -sorgente.height / 2);
    return canvas;
  };
  return { foto: gira(foto), colori: gira(colori) };
}

/** La `zona` di `sorgente`, ingrandita; `ritocco(punti, larghezza, altezza)`, se c'è, ne cambia i punti RGBA. */
function ritaglia(sorgente, { x0, y0, x1, y1 }, ritocco) {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: (x1 - x0) * INGRANDIMENTO, height: (y1 - y0) * INGRANDIMENTO,
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sorgente, x0, y0, x1 - x0, y1 - y0, 0, 0, canvas.width, canvas.height);
  if (ritocco) {
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ritocco(immagine.data, canvas.width, canvas.height);
    ctx.putImageData(immagine, 0, 0);
  }
  return canvas;
}

/** Il riquadro della foto e il suo lettore. `dopoLettura({ valori, nonLetti })` riceve solo letture con qualche valore. */
export function creaFotoTablet({ dopoLettura }) {
  let letture = 0; // vale solo il risultato dell'ultima foto, e solo finché il riquadro è aperto e il modulo c'è
  let lettore = null; // Promise del worker di Tesseract: si crea al primo tocco, si chiude con smonta()
  let inCorso = Promise.resolve(); // l'ultima lettura chiesta al worker, finita o no
  let suAvanzamento = () => {};
  let url = null; // la miniatura, finché il riquadro è aperto

  const input = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: () => {
      const file = input.files[0];
      input.value = ''; // la stessa foto scelta di nuovo si rilegge
      if (file) leggi(file);
    },
  });
  const testo = h('span', {}, 'Foto tablet');
  // il lettore si prepara mentre si scatta la foto
  const bottone = h('button', { type: 'button', class: 'bottone', onclick: () => { avviaLettore(); input.click(); } },
    icona('fotocamera'), testo);
  const esito = h('div', { class: 'esito-foto', 'aria-live': 'polite' });
  const elemento = h('div', { class: 'foto-tablet' }, bottone, input, esito);

  function avviaLettore() {
    if (lettore) return lettore;
    const cartella = new URL(CARTELLA_TESSERACT, location.href).href; // dentro il worker un percorso relativo partirebbe dalla sua cartella
    const nuovo = caricaScript(TESSERACT).then(() => new Promise((risolvi, rifiuta) => {
      // se manca un file dopo il core (es. la lingua) Tesseract non rifiuta createWorker: lo dice solo qui
      window.Tesseract.createWorker('ita', 1, {
        workerPath: `${cartella}worker.min.js`, corePath: cartella, langPath: cartella.replace(/\/$/, ''),
        cacheMethod: 'none', workerBlobURL: false,
        logger: (m) => { if (m.status === 'recognizing text') suAvanzamento(m.progress); },
        errorHandler: (errore) => rifiuta(new Error(String(errore))),
      }, { debug_file: '/dev/null' }).then(risolvi, rifiuta); // senza i messaggi di Tesseract nella console
    }));
    lettore = nuovo;
    nuovo.catch(() => { if (lettore === nuovo) lettore = null; }); // al prossimo tocco si riprova
    return nuovo;
  }

  /** Chiuso a metà di una lettura, Tesseract darebbe un errore (manda la foto a un worker che non c'è più): prima la finisce. */
  function chiudiLettore() {
    const finita = inCorso;
    lettore?.then(async (w) => {
      await finita;
      await w.terminate();
    }).catch(() => {});
    lettore = null;
  }

  async function riconosci(immagine, avanza) {
    suAvanzamento = avanza;
    const richiesto = avviaLettore();
    const worker = await richiesto.catch((causa) => { throw new SenzaLettore('Lettore non caricato', { cause: causa }); });
    // chiuso mentre si aspettava (si è usciti dal modulo): niente lavoro nuovo, e chiudiLettore non lo aspetterebbe
    if (richiesto !== lettore) throw new Error('Lettore chiuso');
    const lavoro = worker.recognize(immagine, {}, { blocks: true });
    inCorso = lavoro.catch(() => {});
    const { data } = await lavoro;
    return daTesseract(data);
  }

  /**
   * La foto intera letta nel verso giusto: com'è e, se non vi si riconosce la schermata, girata. Il lettore non legge il
   * testo girato, e l'orientamento scritto nella foto non basta: una foto scattata con il telefono in piano sopra il
   * tablet, o già girata nella libreria, arriva coricata. Si prova ogni rotazione finché la schermata si riconosce
   * (abbastanza parole fisse); se non si riconosce mai, vale la lettura con più parole fisse, a parità la foto com'è.
   * Null se nel frattempo la lettura è stata lasciata cadere.
   */
  async function leggiNelVersoGiusto(preparata, attuale) {
    let migliore = null;
    for (const gradi of rotazioniDaProvare(preparata.foto)) {
      if (!attuale()) return null;
      const girata = gradi ? giraFoto(preparata, gradi) : preparata;
      const intera = await riconosci(girata.foto, (p) => attuale() && avanzamento(p * QUOTA_INTERA, gradi !== 0));
      const punteggio = punteggioSchermata(intera);
      if (!migliore || punteggio > migliore.punteggio) migliore = { ...girata, intera, punteggio };
      if (punteggio >= PAROLE_FISSE_SICURE) break;
    }
    return migliore;
  }

  /**
   * Foto intera, nel verso giusto, poi sempre anche i ritagli ingranditi: se c'è l'etichetta Allarme la fila degli orari, normale e
   * invertita; se c'è l'etichetta Valutazione il riquadro del codice, dalla foto a colori, con il canale più alto e, se
   * il colore del riquadro è chiaro, con la sola scritta chiusa nel riquadro (anche bianca, sul rosso o sul nero); se c'è
   * "nascita" le righe Sesso e Data di nascita (la F da sola, piccola, nella foto intera diventa 'È' o si perde).
   * I ritagli trovano quello che sfugge alla foto intera (Arrivo H bianco su blu scuro, il codice sul verde) e la
   * controllano: un orario, un codice o un sesso letto in due modi diversi resta non letto, invece di entrare sbagliato.
   * Il colore del riquadro, che sul tablet è quello del codice, controlla anche la lettera.
   */
  async function leggiFoto(preparata, attuale) {
    const opzioni = { liste: stato.liste, adesso: new Date(), comuniNoti: suggerimentiComuni(stato.record) };
    const dritta = await leggiNelVersoGiusto(preparata, attuale);
    if (!dritta) return null;
    const { foto, colori, intera } = dritta;
    const allarme = etichetta(intera, 'ALLARME');
    const valutazione = etichettaValutazione(intera);
    const codice = valutazione && zonaCodice(valutazione, foto);
    const dove = valutazione && zonaColore(valutazione, foto);
    const coloreCodice = dove && coloreRiquadro(colori.getContext('2d')
      .getImageData(dove.x0, dove.y0, dove.x1 - dove.x0, dove.y1 - dove.y0).data);
    const soloScritta = (px, larghezza, altezza) => scritteSulRiquadro(px, larghezza, altezza, coloreCodice);
    const nascita = etichettaNascita(intera);
    const sesso = nascita && zonaSesso(nascita, foto);
    // gli orari prima, come sono sempre stati letti
    const ritagli = [
      ...(allarme ? [[foto, zonaOrari(allarme, foto), null], [foto, zonaOrari(allarme, foto), INVERTITO]] : []),
      ...(codice ? [[colori, codice, SCRITTA_SCURA]] : []),
      ...(codice && coloreCodice ? [[colori, codice, soloScritta]] : []),
      ...(sesso ? [[foto, sesso, null]] : []),
    ];
    const quota = (1 - QUOTA_INTERA) / ritagli.length;
    const riletti = [];
    for (const [i, [sorgente, zona, ritocco]] of ritagli.entries()) {
      if (!attuale()) return null;
      const lettura = await riconosci(ritaglia(sorgente, zona, ritocco),
        (p) => attuale() && avanzamento(QUOTA_INTERA + (i + p) * quota));
      riletti.push(spostaLettura(lettura, { scala: INGRANDIMENTO, dx: zona.x0, dy: zona.y0 }));
    }
    // la foto intera prima: a parità vince lei; il ripiego sui sei orari si calcola solo su di lei
    return leggiSchermata(unisciLetture(intera, ...riletti), { ...opzioni, intera, coloreCodice });
  }

  async function leggi(file) {
    chiudiPannello();
    const numero = letture;
    const attuale = () => numero === letture;
    inLettura(true);
    let preparata;
    try {
      preparata = await preparaFoto(file);
    } catch {
      if (attuale()) errore(NON_SI_APRE); // es. una foto HEIC in un browser che non la apre, o un file che non è una foto
      return;
    }
    if (!attuale()) return;
    let risultato;
    try {
      risultato = await leggiFoto(preparata, attuale);
    } catch (e) {
      if (!attuale()) return;
      chiudiLettore(); // al prossimo tocco si ricrea
      const senzaLettore = e instanceof SenzaLettore;
      if (!senzaLettore) console.error(e); // un errore nel ritocco, nella lettura o nel calcolo dei valori: il lettore c'è
      errore(senzaLettore ? SENZA_LETTORE : NON_SI_APRE);
      return;
    }
    if (!attuale() || !risultato) return;
    if (!Object.keys(risultato.valori).length) {
      errore(SENZA_DATI); // il modulo non cambia, nemmeno la data
      return;
    }
    inLettura(false);
    dopoLettura(risultato);
    url = URL.createObjectURL(file);
    esito.replaceChildren(riquadro(risultato));
  }

  function inLettura(attivo) {
    bottone.disabled = attivo;
    if (attivo) {
      bottone.setAttribute('aria-busy', 'true');
      avanzamento(0);
    } else {
      bottone.removeAttribute('aria-busy');
      bottone.style.removeProperty('--avanzamento');
      testo.textContent = 'Foto tablet';
    }
  }

  function avanzamento(frazione, girata = false) {
    const n = Math.round(frazione * 100);
    testo.textContent = `Leggo la foto${girata ? ' girata' : ''}… ${n}%`;
    bottone.style.setProperty('--avanzamento', `${n}%`);
  }

  function errore(messaggio) {
    inLettura(false);
    esito.replaceChildren(h('div', { class: 'messaggio errore', role: 'alert' }, icona('avviso'), h('p', {}, messaggio)));
  }

  function riquadro({ valori, nonLetti }) {
    const n = Object.keys(valori).length;
    const intera = h('dialog', { class: 'foto-intera', onclick: () => intera.close() },
      h('img', { src: url, alt: 'Foto del tablet' }));
    return h('div', { class: 'riquadro-foto' },
      h('button', { type: 'button', class: 'miniatura', 'aria-label': 'Apri la foto intera', onclick: () => intera.showModal() },
        h('img', { src: url, alt: '' })),
      h('div', { class: 'riepilogo-foto' },
        h('p', { class: 'letti' }, n === 1 ? 'Letto 1 campo' : `Letti ${n} campi`),
        nonLetti.length > 0 && h('p', { class: 'non-letti' }, `Non letti: ${nonLetti.join(', ')}`),
        h('button', { type: 'button', class: 'bottone piccolo', onclick: chiudiPannello }, icona('x'), 'Togli foto')),
      valori.missione && duplicato(valori.missione),
      h('p', { class: 'nota-rullino' }, icona('avviso'), RULLINO),
      intera);
  }

  /**
   * Gli stessi riquadri del modulo per una missione già in archivio: verde se la prima scheda ha la spunta "Paziente
   * multiplo" (la foto è di un altro paziente dello stesso intervento), rosso con il link all'intervento salvato se no.
   */
  function duplicato(missione) {
    const v = verificaSalvataggio({ id: null, missione }, stato.record);
    const prima = v.collegataA && trova(v.collegataA);
    if (prima) return messaggioCollegata(prima);
    const salvato = v.duplicatoDi && trova(v.duplicatoDi);
    return salvato ? messaggioDuplicato(missione, salvato, v.duplicatoDi, { nota: v.errori[1], link: 'Apri' }) : null;
  }

  /** Chiude il riquadro (i valori restano nel modulo) e lascia cadere una lettura ancora in corso. */
  function chiudiPannello() {
    letture += 1;
    inLettura(false);
    esito.replaceChildren();
    if (url) URL.revokeObjectURL(url);
    url = null;
  }

  return {
    elemento,
    chiudiPannello,
    /** Uscendo dal modulo: via il riquadro e la foto, chiuso il lettore. */
    smonta() {
      chiudiPannello();
      chiudiLettore();
    },
  };
}
