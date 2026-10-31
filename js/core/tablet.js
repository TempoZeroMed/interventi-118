// Lettura della schermata "Missione" del tablet SaveOnBoard: dal testo letto sulla foto ai valori del form. Nessun DOM.
// Una lettura è { righe: [{ testo, parole: [{ testo, x0, y0, x1, y1 }] }] }, con i riquadri in pixel della foto.
// Un valore illeggibile o fuori formato non si inventa: resta fuori da `valori` e finisce tra i non letti.
import { impostaCampo, dataLocale } from './modulo.js';
import { isOraValida, minutiDaOra } from './campi.js';

/** Campi della scheda che stanno sulla schermata, con il nome da mostrare tra i "non letti". */
export const CAMPI_TABLET = [
  ['data', 'Data'], ['missione', 'Missione'], ['mezzo', 'Mezzo'], ['oraAllert', 'Ora allert.'],
  ['liberoOperativo', 'Libero operativo'], ['comune', 'Comune'], ['codiceRientro', 'Codice'], ['patologiaRientro', 'Patologia'],
  ['luogoRientro', 'Luogo'], ['eta', 'Età'], ['sesso', 'Sesso'],
]; // il codice sul tablet è quello di rientro: se c'è il rientro è letto, anche quando l'invio resta vuoto (NERO)

/** Ordine del form: l'ora allert. entra prima del mezzo (la tipologia la usa), l'esito prima dell'ospedale. */
export const ORDINE_APPLICAZIONE = [
  'data', 'oraAllert', 'liberoOperativo', 'missione', 'comune', 'mezzo', 'codiceInvio', 'codiceRientro',
  'patologiaInvio', 'patologiaRientro', 'luogoInvio', 'luogoRientro', 'eta', 'sesso', 'esito', 'ospedale',
];

const CODICI = { V: 'VERDE', G: 'GIALLO', R: 'ROSSO', N: 'NERO' }; // B (bianco) non è nella lista: codice non letto
const SOLO_RIENTRO = ['NERO']; // la lista dei codici di invio non ce l'ha
/** Sul tablet il sesso è M o F: la F, un'asta con due tratti, il lettore la legge spesso E (o È), che non può essere una M. */
const SESSI = { M: 'Maschio', F: 'Femmina', E: 'Femmina' };
/** Come li scrive la barra di stato del tablet ('Sab 31 Ott'); i giorni nell'ordine di getDay(). */
const GIORNI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
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
/** Le sei etichette della fila degli orari, da sinistra. */
const NOMI_FILA = ['ALLARME', 'PARTENZA', 'ARRIVO', 'PARTENZAH', 'ARRIVOH', 'OPERATIVO'];

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

/**
 * Parole sotto un'etichetta: centro entro una sua larghezza dai lati, cima tra mezza e 5 sue altezze più in basso
 * (sul tablet gli orari sono grandi il doppio delle etichette e partono circa 2,5 altezze sotto).
 */
function sotto(lettura, e) {
  const larghezza = e.x1 - e.x0;
  const h = altezza(e);
  return paroleDi(lettura).filter((q) => {
    const centro = centroX(q);
    return centro >= e.x0 - larghezza && centro <= e.x1 + larghezza && q.y0 >= e.y0 + h / 2 && q.y0 <= e.y0 + 5 * h;
  });
}

/**
 * Gli orari (anche illeggibili) sotto `e` che le appartengono: quelli il cui centro è più vicino a un'etichetta della
 * fila con il suo nome che a tutte le altre. Così un orario illeggibile non lascia il posto a quello della colonna accanto.
 * Contano solo le etichette con uno dei sei nomi: una letta male in un ritaglio ('Alame'), sovrapposta a quella giusta
 * e per caso più vicina all'orario, non glielo porta via.
 */
function suoi(lettura, e, nome) {
  const etichetteFila = fila(lettura, e).filter((f) => NOMI_FILA.includes(f.nome));
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

/**
 * La fila degli orari da ritagliare: da un'altezza dell'etichetta Allarme sopra di essa a otto sotto (gli orari sono alti il
 * doppio e finiscono circa 5,5 altezze sotto: con meno, le cifre tagliate in basso si leggono male), larga quanto la foto.
 */
export function zonaOrari(allarme, { width, height }) {
  const h = altezza(allarme);
  const y0 = Math.max(0, Math.floor(allarme.y0 - h));
  return { x0: 0, y0, x1: width, y1: Math.max(y0 + 1, Math.min(height, Math.ceil(allarme.y1 + 8 * h))) };
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

// --- Il codice: sul riquadro colorato la foto intera spesso non lo legge, e si rilegge un ritaglio ---

/** Il riquadro del codice, a destra dell'etichetta: largo dieci sue altezze, due sopra e due sotto; null se fuori dalla foto. */
export function zonaCodice(e, { width, height }) {
  const h = altezza(e);
  const zona = {
    x0: Math.floor(e.x1), y0: Math.max(0, Math.floor(e.y0 - 2 * h)),
    x1: Math.min(width, Math.ceil(e.x1 + 10 * h)), y1: Math.min(height, Math.ceil(e.y1 + 2 * h)),
  };
  return zona.x1 > zona.x0 && zona.y1 > zona.y0 ? zona : null;
}

/** Dove si guarda il colore: dentro il riquadro, da una volta e mezza a sei altezze dell'etichetta alla sua destra. */
export function zonaColore(e, { width, height }) {
  const h = altezza(e);
  const zona = {
    x0: Math.floor(e.x1 + 1.5 * h), y0: Math.max(0, Math.floor(e.y0 - h / 2)),
    x1: Math.min(width, Math.ceil(e.x1 + 6 * h)), y1: Math.min(height, Math.ceil(e.y1 + h / 2)),
  };
  return zona.x1 > zona.x0 && zona.y1 > zona.y0 ? zona : null;
}

/** Il tipo di un punto: 'scuro', 'chiaro' (bianco o grigio), o la tinta di un colore acceso ('VERDE', 'altro'…). */
function tipoDelPunto(r, g, b) {
  const alto = Math.max(r, g, b);
  const croma = alto - Math.min(r, g, b);
  if (alto < 60) return 'scuro';
  if (croma < 50 || croma < 0.35 * alto) return 'chiaro';
  const tinta = (alto === r ? ((g - b) / croma + 6) % 6 : alto === g ? (b - r) / croma + 2 : (r - g) / croma + 4) * 60;
  if (tinta < 20 || tinta >= 320) return 'ROSSO';
  if (tinta >= 35 && tinta < 70) return 'GIALLO';
  return tinta >= 75 && tinta < 170 ? 'VERDE' : 'altro';
}

/**
 * Il colore del riquadro del codice dai punti RGBA di zonaColore: sul tablet è il colore del codice. Vale se copre almeno
 * metà della zona (la scritta ne prende una parte); con più punti scuri che altro è NERO. Altrimenti null.
 */
export function coloreRiquadro(punti) {
  const conti = {};
  for (let i = 0; i < punti.length; i += 4) {
    const tipo = tipoDelPunto(punti[i], punti[i + 1], punti[i + 2]);
    conti[tipo] = (conti[tipo] ?? 0) + 1;
  }
  const meta = punti.length / 4 / 2;
  const colore = Object.keys(conti).find((tipo) => conti[tipo] >= meta);
  return { VERDE: 'VERDE', GIALLO: 'GIALLO', ROSSO: 'ROSSO', scuro: 'NERO' }[colore] ?? null;
}

/**
 * La scritta del riquadro del codice, nera su bianco, dai punti RGBA di un ritaglio (cambiati qui). Diventano bianchi i
 * punti del colore del riquadro e quelli raggiunti dal bordo del ritaglio senza attraversarlo (il pannello intorno, anche
 * se è chiaro come una scritta bianca); resta nero solo quello che il riquadro chiude dentro: la scritta, di ogni colore.
 */
export function scritteSulRiquadro(punti, larghezza, altezza, colore) {
  const tipo = colore === 'NERO' ? 'scuro' : colore;
  const n = larghezza * altezza;
  const bianco = new Uint8Array(n);
  for (let i = 0; i < n; i++) bianco[i] = tipoDelPunto(punti[4 * i], punti[4 * i + 1], punti[4 * i + 2]) === tipo ? 1 : 0;
  const daVedere = [];
  const raggiunto = (i) => {
    if (bianco[i]) return;
    bianco[i] = 1;
    daVedere.push(i);
  };
  for (let x = 0; x < larghezza; x++) [x, n - larghezza + x].forEach(raggiunto);
  for (let y = 0; y < altezza; y++) [y * larghezza, y * larghezza + larghezza - 1].forEach(raggiunto);
  while (daVedere.length) {
    const i = daVedere.pop();
    const x = i % larghezza;
    if (x > 0) raggiunto(i - 1);
    if (x < larghezza - 1) raggiunto(i + 1);
    if (i >= larghezza) raggiunto(i - larghezza);
    if (i < n - larghezza) raggiunto(i + larghezza);
  }
  for (let i = 0; i < n; i++) punti[4 * i] = punti[4 * i + 1] = punti[4 * i + 2] = bianco[i] ? 255 : 0;
  return punti;
}

// --- La colonna Valutazione: Sesso si rilegge ingrandito, e l'indirizzo si ferma dove la colonna comincia ---

/** Le etichette delle righe della colonna Valutazione, sotto il codice; 'Data di nascita' si riconosce da 'DATA' + 'DI'. */
const ETICHETTE_VALUTAZIONE = ['COSCIENZA', 'RESPIRO', 'MOTILITA', 'EMORRAGIA', 'DOLORE', 'DURATA', 'SESSO'];
const sembraValutazione = (testo) => /AL[A-Z]{1,4}ZI{1,2}ONE/.test(maiuscolo(testo).replace(/[^A-Z]/g, ''));

/** L'etichetta "VALUTAZIONE", anche letta male ('vaLurazione', 'vaLutTazione', 'vaLutTaziIone'); null se non c'è. */
export function etichettaValutazione(lettura) {
  return paroleDi(lettura).find((q) => sembraValutazione(q.testo)) ?? null;
}

/** La parola "nascita" di "Data di nascita": la riga di Sesso è subito sopra. Null se non c'è. */
export function etichettaNascita(lettura) {
  return paroleDi(lettura).find((q) => etichettaPulita(q.testo) === 'NASCITA') ?? null;
}

/**
 * Il ritaglio con le righe Sesso e Data di nascita, da rileggere ingrandito: nella foto intera la riga Sesso spesso si
 * perde, e la F da sola diventa 'È'. Da otto altezze a sinistra di "nascita" ('Data di ') a quattordici a destra (il
 * valore), da cinque sopra a una sotto; null se fuori dalla foto.
 */
export function zonaSesso(e, { width, height }) {
  const h = altezza(e);
  const zona = {
    x0: Math.max(0, Math.floor(e.x0 - 8 * h)), y0: Math.max(0, Math.floor(e.y0 - 5 * h)),
    x1: Math.min(width, Math.ceil(e.x1 + 14 * h)), y1: Math.min(height, Math.ceil(e.y1 + h)),
  };
  return zona.x1 > zona.x0 && zona.y1 > zona.y0 ? zona : null;
}

/**
 * Dove comincia la colonna Valutazione: un'altezza a sinistra della sua etichetta letta più a sinistra (Valutazione,
 * Coscienza, …, Sesso, 'Data di'). Infinity se non se ne legge nessuna.
 */
function bordoColonnaValutazione(lettura) {
  const etichette = lettura.righe.flatMap(({ parole }) => parole.filter((q, i) => {
    const nome = etichettaPulita(q.testo);
    // 'Valutazione' da sola (anche con una lettera in più), non una riga intera letta come una parola
    return ETICHETTE_VALUTAZIONE.includes(nome) || (nome === 'DATA' && etichettaPulita(parole[i + 1]?.testo) === 'DI')
      || (nome.length <= 14 && sembraValutazione(nome));
  }));
  if (!etichette.length) return Infinity;
  const prima = etichette.reduce((a, q) => (q.x0 < a.x0 ? q : a));
  return prima.x0 - altezza(prima);
}

// --- La foto girata: il lettore non legge il testo girato, e la foto si riprova girata finché la schermata non si riconosce ---

/** Le parole fisse della schermata Missione, come le dà nomeEtichetta (e 'VALUTAZIONE' anche letta male). */
const PAROLE_FISSE = [...NOMI_FILA, ...ETICHETTE_VALUTAZIONE, 'NASCITA', 'OSPEDALE', 'SCALA', 'PIANO', 'TARGET', 'SAVEONBOARD'];

/**
 * Quante parole fisse diverse della schermata ci sono nella lettura (etichette degli orari e della colonna Valutazione,
 * "nascita", "Ospedale", "Scala", "Piano", "Missione in corso"…). Da una foto girata il lettore tira fuori solo segni e
 * sillabe: zero. Serve a capire se la foto va girata, prima di leggere i campi.
 */
export function punteggioSchermata(lettura) {
  const trovate = new Set(lettura.righe.flatMap(({ parole }) => parole.map((q, i) => {
    const nome = nomeEtichetta(parole, i);
    return PAROLE_FISSE.includes(nome) ? nome : sembraValutazione(q.testo) ? 'VALUTAZIONE' : null;
  })).filter(Boolean));
  if (lettura.righe.some((r) => /MISSIONE\s+IN\s+CORSO/.test(maiuscolo(r.testo)))) trovate.add('MISSIONE IN CORSO');
  return trovate.size;
}

/**
 * I gradi (in senso orario) con cui provare a leggere la foto, dal più probabile: prima com'è; poi, se è verticale,
 * girata di 90° e di 270° (lo schermo del tablet è orizzontale: una foto verticale è quasi di sicuro girata di un quarto),
 * altrimenti di 180° (il telefono tenuto al contrario) e poi dei quarti.
 */
export function rotazioniDaProvare({ width, height }) {
  return height > width ? [0, 90, 270, 180] : [0, 180, 90, 270];
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

/**
 * 'R 04 S': codice, patologia e luogo, uguali in invio e in rientro (il NERO solo nel rientro). Letto in due modi diversi
 * (la foto intera e i ritagli del riquadro) resta non letto, come un orario. `colore` è quello del riquadro: se non torna
 * con la lettera il codice resta non letto; senza lettera basta lui, ma non il nero, che può essere solo una foto buia.
 */
function leggiCodice(testi, liste, colore) {
  const trovati = testi.flatMap((t) => [...t.matchAll(/\b([VGRBN])\s*(\d{2})\s*([KSLPQYZ])\b/g)]);
  const m = new Set(trovati.map((x) => x.slice(1).join(''))).size === 1 ? trovati[0] : null;
  const daLettera = m ? CODICI[m[1]] ?? null : null;
  const codice = daLettera && colore && daLettera !== colore ? null
    : daLettera ?? (colore === 'NERO' ? null : colore);
  const patologia = m ? voceCheInizia(liste.patologia, `${m[2]} -`) : null;
  const luogo = m ? voceCheInizia(liste.luogo, `${m[3]} -`) : null;
  return {
    codiceInvio: SOLO_RIENTRO.includes(codice) ? null : codice, codiceRientro: codice,
    patologiaInvio: patologia, patologiaRientro: patologia,
    luogoInvio: luogo, luogoRientro: luogo,
  };
}

/** Il tablet conta gli anni compiuti un anno indietro: +1. Solo sulla riga di "Data di nascita", non dopo il piano. */
function leggiEta(testi) {
  const m = primaCorrispondenza(testi, /\bNASCITA\b.*?\b(\d{1,3})\s*ANNI\b/);
  const eta = m ? Number(m[1]) + 1 : null;
  return eta !== null && eta <= 120 ? eta : null;
}

/** 'Sesso F', nella foto intera o nel ritaglio; letto in due modi diversi (M e F) resta non letto. */
function leggiSesso(testi) {
  const letti = new Set(testi.map((t) => SESSI[/\bSESSO\W*([MFE])\b/.exec(t)?.[1]]).filter(Boolean));
  return letti.size === 1 ? [...letti][0] : null;
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

/** Il comune dopo il civico di `indirizzo` ('…, 12 NOVARA'); undefined se non c'è un civico. */
function comuneDelCivico(indirizzo, comuniNoti) {
  const m = /,\s*\d+(?:\s*\/\s*[\p{L}\d]+|\p{L}(?!\p{L}))?\s+(\p{L}.*?)\s*$/u.exec(indirizzo); // ', 12', ', 3/B', ', 5A'
  return m ? comuneDopoIlCivico(m[1], comuniNoti) : undefined;
}

/**
 * L'indirizzo sta nelle righe prima di "SCALA … PIANO …": la più vicina con un civico, perché il lettore a volte mette
 * in mezzo una riga di segni. Il comune segue il civico; senza civico è un comune già in archivio con cui finisce la riga.
 * Sulla stessa riga, a destra, c'è la prima riga della colonna Valutazione ('Coscienza Si'), spesso letta male
 * ('oscienza'): le parole oltre il bordo della colonna non fanno parte dell'indirizzo, e nemmeno il testo da 'Coscienza'.
 */
function leggiComune(lettura, comuniNoti) {
  const { righe } = lettura;
  const i = righe.findIndex((r) => /\b(SCALA|PIANO)\b/.test(maiuscolo(r.testo)));
  if (i < 1) return null;
  const bordo = bordoColonnaValutazione(lettura);
  // la prima parola resta sempre: nelle letture senza colonne il bordo può cadere a sinistra di tutto
  const aSinistra = (r) => (r.parole?.length
    ? r.parole.filter((q, k) => k === 0 || centroX(q) < bordo).map((q) => q.testo).join(' ') : r.testo);
  const indirizzi = righe.slice(Math.max(0, i - 3), i).reverse()
    .map((r) => aSinistra(r).toUpperCase().split(/\||C?OSCIENZA/)[0]); // via la colonna di destra
  const conCivico = indirizzi.map((indirizzo) => comuneDelCivico(indirizzo, comuniNoti)).find((c) => c !== undefined);
  if (conCivico !== undefined) return conCivico;
  const finale = (indirizzo) => comuniNoti.filter((c) => aParole(indirizzo).endsWith(aParole(c)))
    .sort((a, b) => b.length - a.length)[0];
  return indirizzi.map(finale).find(Boolean) ?? null;
}

/** La riga dopo "OSPEDALE": la voce della lista più lunga che vi compare come parole intere. */
function leggiOspedale(testi, liste) {
  const i = testi.findIndex((t) => /\bOSPEDALE\b/.test(t));
  if (i < 0 || i + 1 >= testi.length) return null;
  const riga = aParole(testi[i + 1]);
  const trovate = (liste.ospedale ?? []).filter((v) => riga.includes(aParole(v.voce)));
  return trovate.sort((a, b) => b.voce.length - a.voce.length)[0]?.voce ?? null;
}

/**
 * Il momento della foto, dalla barra di stato del tablet ('06:15 Sab 31 Ott'). L'anno non c'è: è quello che porta la data
 * a oggi o prima. Vale solo se il giorno della settimana torna, così un giorno letto male non passa; altrimenti null.
 */
function leggiBarraDiStato(testi, adesso) {
  const barra = new RegExp(`(\\S+)\\s+(${GIORNI.join('|')})\\s+(\\S{1,2})\\s+(${MESI.join('|')})\\b`);
  const m = primaCorrispondenza(testi, barra);
  const ora = m ? orarioDa(m[1]) : null;
  const giorno = m ? cifre(m[3]) : '';
  if (ora === null || !/^\d{1,2}$/.test(giorno)) return null;
  const mese = MESI.indexOf(m[4]);
  const il = (anno) => new Date(anno, mese, Number(giorno), ...ora.split(':').map(Number));
  const anno = adesso.getFullYear();
  const foto = dataLocale(il(anno)) > dataLocale(adesso) ? il(anno - 1) : il(anno);
  const esiste = foto.getMonth() === mese && foto.getDate() === Number(giorno);
  return esiste && GIORNI[foto.getDay()] === m[2] ? foto : null;
}

/** Il giorno di `momento` (la foto), o quello prima se l'allarme è più avanti della sua ora (foto dopo mezzanotte). */
function dataDellaMissione(momento, oraAllert) {
  const ieri = oraAllert !== null && minutiDaOra(oraAllert) > momento.getHours() * 60 + momento.getMinutes();
  return dataLocale(ieri ? new Date(momento.getFullYear(), momento.getMonth(), momento.getDate() - 1) : momento);
}

/**
 * Valori del form letti dalla schermata e nomi dei campi di CAMPI_TABLET non letti. Nessun campo letto: `valori` vuoto.
 * `adesso` serve per l'anno della barra di stato e, se la barra non si legge, al posto della sua data e ora.
 * Con una lettura unita ai ritagli, `intera` è quella della sola foto intera: il ripiego sui sei orari si calcola lì.
 * `coloreCodice` è il colore del riquadro del codice (coloreRiquadro), se lo si è guardato.
 */
export function leggiSchermata(lettura, { liste, adesso, comuniNoti, intera = lettura, coloreCodice = null }) {
  const testi = lettura.righe.map((r) => maiuscolo(r.testo));
  const tempi = leggiTempi(lettura, intera);
  const foto = leggiBarraDiStato(testi, adesso);
  const letti = {
    data: foto && dataDellaMissione(foto, tempi.oraAllert),
    missione: leggiMissione(testi), mezzo: leggiMezzo(testi, liste),
    oraAllert: tempi.oraAllert, liberoOperativo: tempi.liberoOperativo, comune: leggiComune(lettura, comuniNoti),
    ...leggiCodice(testi, liste, coloreCodice), eta: leggiEta(testi), sesso: leggiSesso(testi),
  };
  const nonLetti = CAMPI_TABLET.filter(([chiave]) => letti[chiave] === null).map(([, nome]) => nome);
  if (nonLetti.length === CAMPI_TABLET.length) return { valori: {}, nonLetti };
  // barra illeggibile: la data tra i non letti, e intanto quella di prima, come se la foto fosse di adesso
  letti.data ??= dataDellaMissione(adesso, tempi.oraAllert);
  letti.esito = tempi.trasportato ? 'Trasportato' : null;
  letti.ospedale = tempi.trasportato ? leggiOspedale(testi, liste) : null;
  const valori = Object.fromEntries(ORDINE_APPLICAZIONE.filter((k) => letti[k] !== null).map((k) => [k, letti[k]]));
  return { valori, nonLetti };
}

/** Porta i valori letti nel record con le regole del form (tipologia, ospedale), nell'ordine del form. */
export function applicaLettura(r, valori) {
  return ORDINE_APPLICAZIONE.filter((k) => Object.hasOwn(valori, k)).reduce((x, k) => impostaCampo(x, k, valori[k]), r);
}
