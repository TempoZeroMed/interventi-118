// Pulsante "Foto tablet" del nuovo intervento: la foto della schermata Missione si legge sul dispositivo con Tesseract.
// Qui stanno la foto, il ritocco su canvas, il lettore e il riquadro con l'esito; i valori li applica inserimento.js.
// La foto resta solo in memoria: niente bozza, niente archivio, e l'URL della miniatura si rilascia chiudendo il riquadro.
import { stato, trova } from '../stato.js';
import { verificaSalvataggio } from '../core/controlli.js';
import { suggerimentiComuni } from '../core/elenco.js';
import { leggiSchermata, daTesseract, spostaLettura, unisciLetture, etichetta } from '../core/tablet.js';
import { caricaScript, TESSERACT, CARTELLA_TESSERACT } from './file.js';
import { h, icona, dataBreve } from './dom.js';

const LATO_MASSIMO = 2000;
// dopo il contrasto i grigi medi si scuriscono (v^1,5): le scritte grigie e il bianco sui riquadri blu si staccano di più.
// Tarato sulla foto vera del tablet, storta e con riflessi: senza, missione, mezzo, comune ed età restavano non letti.
const CURVA = 1.5;
const INGRANDIMENTO = 2; // la fila degli orari si rilegge ingrandita
// avanzamento mostrato: la lettura della foto intera fino all'80%, le due della fila degli orari il resto
const QUOTA_INTERA = 0.8;

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
 * grigi medi più scuri.
 */
export async function preparaFoto(file) {
  const bitmap = await apri(file);
  const scala = Math.min(1, LATO_MASSIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * scala), height: Math.round(bitmap.height * scala),
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
  return canvas;
}

/** La fila degli orari: da un'altezza dell'etichetta Allarme sopra di essa a 5 sotto, larga quanto la foto, ingrandita. */
function ritaglia(foto, allarme, invertito) {
  const altezza = allarme.y1 - allarme.y0;
  const dy = Math.max(0, Math.floor(allarme.y0 - altezza));
  const fine = Math.min(foto.height, Math.ceil(allarme.y1 + 5 * altezza));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: foto.width * INGRANDIMENTO, height: Math.max(1, fine - dy) * INGRANDIMENTO,
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(foto, 0, dy, foto.width, fine - dy, 0, 0, canvas.width, canvas.height);
  if (invertito) { // i riquadri scuri con le scritte chiare diventano scritte scure su chiaro
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < immagine.data.length; i += 4) {
      immagine.data[i] = 255 - immagine.data[i];
      immagine.data[i + 1] = 255 - immagine.data[i + 1];
      immagine.data[i + 2] = 255 - immagine.data[i + 2];
    }
    ctx.putImageData(immagine, 0, 0);
  }
  return { canvas, dy };
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
   * Foto intera, poi, se c'è l'etichetta Allarme, sempre anche la fila degli orari ingrandita, normale e invertita.
   * I ritagli trovano gli orari che sfuggono alla foto intera (Arrivo H bianco su blu scuro) e la controllano: un orario
   * letto in due modi diversi sotto la stessa etichetta resta non letto, invece di entrare sbagliato.
   */
  async function leggiFoto(foto, attuale) {
    const opzioni = { liste: stato.liste, adesso: new Date(), comuniNoti: suggerimentiComuni(stato.record) };
    const intera = await riconosci(foto, (p) => attuale() && avanzamento(p * QUOTA_INTERA));
    const allarme = etichetta(intera, 'ALLARME');
    if (!allarme) return leggiSchermata(intera, opzioni);
    const ritagli = [];
    for (const [i, invertito] of [false, true].entries()) {
      if (!attuale()) return null;
      const { canvas, dy } = ritaglia(foto, allarme, invertito);
      const quota = (1 - QUOTA_INTERA) / 2;
      const lettura = await riconosci(canvas, (p) => attuale() && avanzamento(QUOTA_INTERA + (i + p) * quota));
      ritagli.push(spostaLettura(lettura, { scala: INGRANDIMENTO, dx: 0, dy }));
    }
    // la foto intera prima: a parità vince lei; il ripiego sui sei orari si calcola solo su di lei
    return leggiSchermata(unisciLetture(intera, ...ritagli), { ...opzioni, intera });
  }

  async function leggi(file) {
    chiudiPannello();
    const numero = letture;
    const attuale = () => numero === letture;
    inLettura(true);
    let foto;
    try {
      foto = await preparaFoto(file);
    } catch {
      if (attuale()) errore(NON_SI_APRE); // es. una foto HEIC in un browser che non la apre, o un file che non è una foto
      return;
    }
    if (!attuale()) return;
    let risultato;
    try {
      risultato = await leggiFoto(foto, attuale);
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

  function avanzamento(frazione) {
    const n = Math.round(frazione * 100);
    testo.textContent = `Leggo la foto… ${n}%`;
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

  /** Lo stesso messaggio del modulo per una missione già in archivio, con il link all'intervento salvato. */
  function duplicato(missione) {
    const id = verificaSalvataggio({ id: null, missione }, stato.record).duplicatoDi;
    const salvato = id && trova(id);
    if (!salvato) return null;
    return h('div', { class: 'messaggio errore', role: 'alert' }, icona('avviso'),
      h('div', {},
        h('p', {}, h('strong', {}, `La missione ${missione} è già registrata`),
          salvato.data ? ` (${dataBreve(salvato.data)}${salvato.comune ? `, ${salvato.comune}` : ''}).` : '.'),
        h('div', { class: 'azioni-mess' }, h('a', { class: 'bottone piccolo', href: `#/intervento/${encodeURIComponent(id)}` }, 'Apri'))));
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
