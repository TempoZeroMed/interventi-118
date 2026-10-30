// Lettura della schermata "Missione" del tablet SaveOnBoard: dal testo letto sulla foto ai valori del form. Nessun DOM.
// Una lettura è { righe: [{ testo, parole: [{ testo, x0, y0, x1, y1 }] }] }, con i riquadri in pixel della foto.
// Un valore illeggibile o fuori formato non si inventa: resta fuori da `valori` e finisce tra i non letti.
import { impostaCampo, dataLocale } from './modulo.js';
import { isOraValida, minutiDaOra } from './campi.js';

/** Campi della scheda che stanno sulla schermata, con il nome da mostrare tra i "non letti". */
export const CAMPI_TABLET = [
  ['missione', 'Missione'], ['mezzo', 'Mezzo'], ['oraAllert', 'Ora allert.'], ['liberoOperativo', 'Libero operativo'],
  ['comune', 'Comune'], ['codiceInvio', 'Codice'], ['patologiaInvio', 'Patologia'], ['luogoInvio', 'Luogo'],
  ['eta', 'Età'], ['sesso', 'Sesso'],
];

/** Ordine del form: l'ora allert. entra prima del mezzo (la tipologia la usa), l'esito prima dell'ospedale. */
export const ORDINE_APPLICAZIONE = [
  'data', 'oraAllert', 'liberoOperativo', 'missione', 'comune', 'mezzo', 'codiceInvio', 'codiceRientro',
  'patologiaInvio', 'patologiaRientro', 'luogoInvio', 'luogoRientro', 'eta', 'sesso', 'esito', 'ospedale',
];

const CODICI = { V: 'VERDE', G: 'GIALLO', R: 'ROSSO' }; // B (bianco) non è nella lista: codice non letto
const SESSI = { M: 'Maschio', F: 'Femmina' };
/** Una parola del nome di un comune: lettere, anche accentate, con un apostrofo o un trattino in mezzo ('SANT'ANDREA'). */
const SOLO_LETTERE = /^\p{L}+(?:['’-]\p{L}+)*$/u;

const maiuscolo = (testo) => String(testo ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
/** Solo lettere e cifre, a parole separate da uno spazio e con uno spazio ai lati: per cercare parole intere. */
const aParole = (testo) => ` ${maiuscolo(testo).replace(/[^A-Z0-9]+/g, ' ').trim()} `;
/** Errori tipici del lettore dove sono attese cifre. */
const cifre = (testo) => String(testo).replace(/O/g, '0').replace(/[IlL]/g, '1');
const voceCheInizia = (lista, inizio) => (lista ?? []).find((v) => v.voce.startsWith(inizio))?.voce ?? null;
const primaCorrispondenza = (testi, re) => testi.map((t) => re.exec(t)).find(Boolean) ?? null;

/** Dal risultato di `recognize(…, {}, { blocks: true })` di Tesseract: una riga per ogni riga letta. */
export function daTesseract(data) {
  const linee = (data?.blocks ?? []).flatMap((b) => b.paragraphs ?? []).flatMap((p) => p.lines ?? []);
  const parola = ({ text, bbox: { x0, y0, x1, y1 } }) => ({ testo: String(text ?? '').trim(), x0, y0, x1, y1 });
  return {
    righe: linee.map((linea) => ({
      testo: String(linea.text ?? '').replace(/\s+/g, ' ').trim(),
      parole: (linea.words ?? []).map(parola),
    })),
  };
}

/** Riporta sulla foto intera la lettura di un ritaglio ingrandito `scala` volte, preso da (dx, dy). */
export function spostaLettura(lettura, { scala, dx, dy }) {
  const sposta = (q) => ({ ...q, x0: q.x0 / scala + dx, y0: q.y0 / scala + dy, x1: q.x1 / scala + dx, y1: q.y1 / scala + dy });
  return { righe: lettura.righe.map((r) => ({ ...r, parole: r.parole.map(sposta) })) };
}

export const unisciLetture = (...letture) => ({ righe: letture.flatMap((l) => l.righe) });

/** '2l.O5' -> '21:05'; null se dopo le correzioni non è un'ora valida. */
export function orarioDa(testo) {
  const m = /^(\d{2})\s*[:.;-]?\s*(\d{2})$/.exec(cifre(String(testo ?? '').trim()));
  const ora = m ? `${m[1]}:${m[2]}` : null;
  return isOraValida(ora) ? ora : null;
}

// --- Orari: ogni orario è scritto sotto la sua etichetta ---

const paroleDi = (lettura) => lettura.righe.flatMap((r) => r.parole);
const altezza = (q) => q.y1 - q.y0;
const centroX = (q) => (q.x0 + q.x1) / 2;
const centroY = (q) => (q.y0 + q.y1) / 2;
/** Solo lettere e cifre, senza il segno di spunta che il lettore attacca all'etichetta: 'Y_Operativo' è 'OPERATIVO'. */
const etichettaPulita = (testo) => maiuscolo(testo).replace(/[^A-Z0-9]/g, '')
  .replace(/^[VY]{1,2}(?=(?:ALLARME|PARTENZAH?|ARRIVOH?|OPERATIVO)$)/, '');
/** Ha l'aspetto di un orario (almeno 4 cifre dopo le correzioni); per Arrivo H basta questo. */
const sembraOrario = (q) => (cifre(q.testo).match(/\d/g) ?? []).length >= 4;
/** Nome della parola i come etichetta: 'ARRIVO' seguita da 'H' è 'ARRIVOH', come la parola unica 'ARRIVOH'. */
const nomeEtichetta = (parole, i) => etichettaPulita(parole[i].testo) + (etichettaPulita(parole[i + 1]?.testo) === 'H' ? 'H' : '');

/** Le parole con quel nome ('ALLARME', 'OPERATIVO', 'ARRIVOH'), nell'ordine di lettura. */
const etichette = (lettura, nome) => lettura.righe
  .flatMap(({ parole }) => parole.filter((q, i) => nomeEtichetta(parole, i) === nome));

/**
 * Le etichette della fila di `e`, con il loro nome: le parole della sua riga o con il centro entro mezza sua altezza
 * (le etichette di una lettura unita), tolte le 'H' (fanno parte dell'etichetta prima) e quelle che sembrano orari.
 */
function fila(lettura, e) {
  return lettura.righe.flatMap(({ parole }) => parole
    .map((q, i) => ({ q, nome: nomeEtichetta(parole, i) }))
    .filter(({ q }) => (parole.includes(e) || Math.abs(centroY(q) - centroY(e)) <= altezza(e) / 2)
      && etichettaPulita(q.testo).length > 1 && !sembraOrario(q)));
}

/** Parole sotto un'etichetta: centro entro una sua larghezza dai lati, cima tra mezza e 4 sue altezze più in basso. */
function sotto(lettura, e) {
  const larghezza = e.x1 - e.x0;
  const h = altezza(e);
  return paroleDi(lettura).filter((q) => {
    const centro = centroX(q);
    return centro >= e.x0 - larghezza && centro <= e.x1 + larghezza && q.y0 >= e.y0 + h / 2 && q.y0 <= e.y0 + 4 * h;
  });
}

/**
 * Gli orari (anche illeggibili) sotto `e` che le appartengono: quelli il cui centro è più vicino a un'etichetta della
 * fila con il suo nome che a tutte le altre. Così un orario illeggibile non lascia il posto a quello della colonna accanto.
 */
function suoi(lettura, e, nome) {
  const etichetteFila = fila(lettura, e);
  return sotto(lettura, e).filter(sembraOrario).filter((t) => {
    const distanza = (f) => Math.abs(centroX(f.q) - centroX(t));
    return etichetteFila.reduce((a, f) => (distanza(f) < distanza(a) ? f : a)).nome === nome;
  });
}

/**
 * Operativo e Arrivo H sono quelli della fila di Allarme; la parola "Operativo" della testata (stato del mezzo) conta
 * solo se Allarme non c'è. Tra più etichette valide, la prima con un orario sotto, altrimenti la prima trovata
 * (per ritagliare la fila degli orari anche quando l'orario non si legge).
 */
export function etichetta(lettura, nome) {
  const cercata = nome.replace(' ', '');
  const allarme = cercata === 'ALLARME' ? null : etichetta(lettura, 'ALLARME');
  const trovate = allarme ? fila(lettura, allarme).filter((f) => f.nome === cercata).map((f) => f.q) : etichette(lettura, cercata);
  const conOrario = (e) => suoi(lettura, e, cercata).some((q) => cercata === 'ARRIVOH' || orarioDa(q.testo) !== null);
  return trovate.find(conOrario) ?? trovate[0] ?? null;
}

/** Gli orari validi di un'etichetta, senza ripetizioni: più di uno (letture unite in disaccordo) = non letto. */
const orariSotto = (lettura, e, nome) => (e ? [...new Set(suoi(lettura, e, nome).map((q) => orarioDa(q.testo)))] : [])
  .filter(Boolean);
const unico = (orari) => (orari.length === 1 ? orari[0] : null);

/** La fila più bassa di orari validi, da sinistra: vale solo se sono i sei della schermata, da Allarme a Operativo. */
function seiOrariInBasso(lettura) {
  const orari = paroleDi(lettura).filter((q) => orarioDa(q.testo) !== null);
  if (!orari.length) return null;
  const basso = orari.reduce((a, q) => (q.y0 > a.y0 ? q : a));
  const fila = orari.filter((q) => q.y0 >= basso.y0 - 2 * altezza(basso)).sort((a, b) => a.x0 - b.x0);
  return fila.length === 6 ? fila.map((q) => orarioDa(q.testo)) : null;
}

/** Il ripiego sui sei orari usa solo `intera`, la foto intera: unita ai ritagli, una colonna letta due volte conterebbe doppio. */
function leggiTempi(lettura, intera) {
  const allarme = orariSotto(lettura, etichetta(lettura, 'ALLARME'), 'ALLARME');
  const operativo = orariSotto(lettura, etichetta(lettura, 'OPERATIVO'), 'OPERATIVO');
  const arrivo = etichetta(lettura, 'ARRIVO H');
  const trasportato = arrivo !== null && suoi(lettura, arrivo, 'ARRIVOH').length > 0;
  if (allarme.length || operativo.length) return { oraAllert: unico(allarme), liberoOperativo: unico(operativo), trasportato };
  // la parola "Operativo" della testata c'è sempre: il ripiego scatta se sotto le etichette non c'è nessun orario
  const sei = seiOrariInBasso(intera);
  return { oraAllert: sei?.[0] ?? null, liberoOperativo: sei?.[5] ?? null, trasportato: trasportato || sei !== null };
}

// --- Gli altri campi, dal testo delle righe (in maiuscolo e senza accenti) ---

function leggiMissione(testi) {
  const m = primaCorrispondenza(testi, /MISSIONE\s+IN\s+CORSO\s*:?\s*([^/]*?)\s*\/\s*\d/);
  const codice = m ? m[1].replace(/\s+/g, '') : '';
  if (codice.length !== 8) return null;
  const corretto = cifre(codice.slice(0, 2)) + codice.slice(2, 4) + cifre(codice.slice(4));
  return /^\d{2}[A-Z]{2}\d{4}$/.test(corretto) ? corretto : null; // 2 cifre, 2 lettere, 4 cifre, come 04AA0000
}

function leggiMezzo(testi, liste) {
  const voci = (liste.mezzo ?? []).map((v) => v.voce); // anche le disattivate
  return testi.flatMap((t) => [...t.matchAll(/\bN[0O]([0-9O]{4})\b/g)])
    .map((m) => cifre(m[1])).find((mezzo) => voci.includes(mezzo)) ?? null;
}

/** 'R 04 S': codice, patologia e luogo, uguali in invio e in rientro. */
function leggiCodice(testi, liste) {
  const m = primaCorrispondenza(testi, /\b([VGRB])\s*(\d{2})\s*([KSLPQYZ])\b/);
  const codice = m ? CODICI[m[1]] ?? null : null;
  const patologia = m ? voceCheInizia(liste.patologia, `${m[2]} -`) : null;
  const luogo = m ? voceCheInizia(liste.luogo, `${m[3]} -`) : null;
  return {
    codiceInvio: codice, codiceRientro: codice, patologiaInvio: patologia, patologiaRientro: patologia,
    luogoInvio: luogo, luogoRientro: luogo,
  };
}

/** Il tablet conta gli anni compiuti un anno indietro: +1. Solo sulla riga di "Data di nascita", non dopo il piano. */
function leggiEta(testi) {
  const m = primaCorrispondenza(testi, /\bNASCITA\b.*?\b(\d{1,3})\s*ANNI\b/);
  const eta = m ? Number(m[1]) + 1 : null;
  return eta !== null && eta <= 120 ? eta : null;
}

function leggiSesso(testi) {
  const m = primaCorrispondenza(testi, /\bSESSO\W*([MF])\b/);
  return m ? SESSI[m[1]] : null;
}

/**
 * Il comune scritto dopo il civico. In fondo si tolgono i segni di un carattere e quelli senza lettere ('NOVARA È').
 * Se finisce con parole di due lettere ('… DA PO', o un segno letto come 'FI'), vale solo se è un comune già in archivio,
 * con o senza quelle parole: un nome troncato che non è un comune noto non si inventa.
 * Altrimenti: le stesse parole di un comune in archivio danno la scrittura dell'archivio ('NOVARA.' è NOVARA); un nome
 * nuovo vale solo se è fatto di lettere, e con una cifra o un segno rimasti ('N0VARA', 'NOVARA -I') resta non letto.
 */
function comuneDopoIlCivico(testo, comuniNoti) {
  const noto = (nome) => comuniNoti.find((c) => aParole(c) === aParole(nome)) ?? null;
  const parole = testo.split(/\s+/);
  while (parole.length && (parole.at(-1).length === 1 || !/\p{L}/u.test(parole.at(-1)))) parole.pop();
  let senzaCorte = parole.length;
  while (senzaCorte > 0 && /^\p{L}{2}$/u.test(parole[senzaCorte - 1])) senzaCorte -= 1;
  if (senzaCorte < parole.length) {
    return noto(parole.join(' ')) ?? (senzaCorte > 0 ? noto(parole.slice(0, senzaCorte).join(' ')) : null);
  }
  const nome = parole.join(' ');
  if (!nome) return null;
  return noto(nome) ?? (parole.every((parola) => SOLO_LETTERE.test(parola)) ? nome : null);
}

/** L'indirizzo è la riga prima di "SCALA … PIANO …"; il comune segue il civico, o è un comune già in archivio. */
function leggiComune(righe, comuniNoti) {
  const i = righe.findIndex((r) => /\b(SCALA|PIANO)\b/.test(maiuscolo(r.testo)));
  if (i < 1) return null;
  const indirizzo = righe[i - 1].testo.toUpperCase().split(/\||COSCIENZA/)[0]; // via la colonna di destra
  const m = /,\s*\d+(?:\s*\/\s*[\p{L}\d]+|\p{L}(?!\p{L}))?\s+(\p{L}.*?)\s*$/u.exec(indirizzo); // ', 12', ', 3/B', ', 5A'
  if (m) return comuneDopoIlCivico(m[1], comuniNoti);
  const finali = comuniNoti.filter((c) => aParole(indirizzo).endsWith(aParole(c)));
  return finali.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** La riga dopo "OSPEDALE": la voce della lista più lunga che vi compare come parole intere. */
function leggiOspedale(testi, liste) {
  const i = testi.findIndex((t) => /\bOSPEDALE\b/.test(t));
  if (i < 0 || i + 1 >= testi.length) return null;
  const riga = aParole(testi[i + 1]);
  const trovate = (liste.ospedale ?? []).filter((v) => riga.includes(aParole(v.voce)));
  return trovate.sort((a, b) => b.voce.length - a.voce.length)[0]?.voce ?? null;
}

/** Oggi, o ieri se l'allarme è più avanti dell'ora attuale (missione di ieri sera, foto dopo mezzanotte). */
function dataDellaMissione(adesso, oraAllert) {
  const ieri = oraAllert !== null && minutiDaOra(oraAllert) > adesso.getHours() * 60 + adesso.getMinutes();
  return dataLocale(ieri ? new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() - 1) : adesso);
}

/**
 * Valori del form letti dalla schermata e nomi dei campi di CAMPI_TABLET non letti. Nessun campo letto: `valori` vuoto.
 * Con una lettura unita ai ritagli, `intera` è quella della sola foto intera: il ripiego sui sei orari si calcola lì.
 */
export function leggiSchermata(lettura, { liste, adesso, comuniNoti, intera = lettura }) {
  const testi = lettura.righe.map((r) => maiuscolo(r.testo));
  const tempi = leggiTempi(lettura, intera);
  const letti = {
    missione: leggiMissione(testi), mezzo: leggiMezzo(testi, liste),
    oraAllert: tempi.oraAllert, liberoOperativo: tempi.liberoOperativo, comune: leggiComune(lettura.righe, comuniNoti),
    ...leggiCodice(testi, liste), eta: leggiEta(testi), sesso: leggiSesso(testi),
  };
  const nonLetti = CAMPI_TABLET.filter(([chiave]) => letti[chiave] === null).map(([, nome]) => nome);
  if (nonLetti.length === CAMPI_TABLET.length) return { valori: {}, nonLetti };
  letti.data = dataDellaMissione(adesso, tempi.oraAllert);
  letti.esito = tempi.trasportato ? 'Trasportato' : null;
  letti.ospedale = tempi.trasportato ? leggiOspedale(testi, liste) : null;
  const valori = Object.fromEntries(ORDINE_APPLICAZIONE.filter((k) => letti[k] !== null).map((k) => [k, letti[k]]));
  return { valori, nonLetti };
}

/** Porta i valori letti nel record con le regole del form (tipologia, ospedale), nell'ordine del form. */
export function applicaLettura(r, valori) {
  return ORDINE_APPLICAZIONE.filter((k) => Object.hasOwn(valori, k)).reduce((x, k) => impostaCampo(x, k, valori[k]), r);
}
