// Lettura della schermata "Missione" del tablet: solo letture inventate (missioni 99ZZ…), mai dati reali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leggiSchermata, applicaLettura, orarioDa, daTesseract, spostaLettura, unisciLetture, etichetta, etichettaValutazione,
  zonaCodice, zonaColore, coloreRiquadro, scritteSulRiquadro, zonaOrari, etichettaNascita, zonaSesso, CAMPI_TABLET,
} from '../js/core/tablet.js';
import { recordVuoto } from '../js/core/modulo.js';
import { LISTE_PREDEFINITE } from '../js/core/campi.js';

// Una parola con il suo riquadro, una riga di parole, una riga letta come un'unica parola larga.
const p = (testo, x, y, w = 90, h = 24) => ({ testo, x0: x, y0: y, x1: x + w, y1: y + h });
const riga = (...parole) => ({ testo: parole.map((q) => q.testo).join(' '), parole });
const frase = (testo, y) => riga(p(testo, 40, y, 700));
const filaEtichette = ({ allarme = 'Allarme', larghezzaOperativo = 90 } = {}) => riga(p(allarme, 100, 600),
  p('Partenza', 250, 600), p('Arrivo', 400, 600), p('Partenza', 550, 600), p('H', 645, 600, 20), p('Arrivo', 700, 600),
  p('H', 795, 600, 20), p('Operativo', 850, 600, larghezzaOperativo));
const ETICHETTE = filaEtichette();
const orari = (valori) => riga(...valori.map((o, i) => o && p(o, 100 + 150 * i, 640)).filter(Boolean));

// Le posizioni imitano la schermata: barra di stato, testata con mezzo e stato, target, paziente, ospedale, orari.
function schermata({ barra = ['06:15', 'Sab 31 Ott'], missione = '99ZZ0042/3', mezzo = 'N03050',
  indirizzo = 'VIA DELLE PROVE, 12 NOVARA | Coscienza SI', codice = 'R 04 S', eta = '40 anni', sesso = 'F',
  ospedale = 'OSPEDALE MAGGIORE NOVARA', tempi = ['21:05', '21:07', '21:20', '21:40', '21:52', '22:10'], conEtichette = true,
  etichette = ETICHETTE } = {}) {
  return { righe: [
    riga(p(barra[0], 40, 10, 60), p(barra[1], 110, 10, 120)),
    frase(`SaveOnBoard | Missione in corso: ${missione}`, 40), riga(p(mezzo, 900, 40), p('Operativo', 1000, 40)),
    frase(`TARGET VALUTAZIONE ${codice}`, 100), frase(indirizzo, 160), frase('SCALA --, PIANO 2 Respiro SI', 190),
    frase(`Sesso ${sesso}`, 400), frase(`Data di nascita ${eta}`, 430), frase('OSPEDALE', 460), frase(ospedale, 490),
    ...(conEtichette ? [etichette] : []), orari(tempi),
  ] };
}
const ADESSO = new Date(2026, 9, 31, 6, 15);
const OPZ = { liste: LISTE_PREDEFINITE, adesso: ADESSO, comuniNoti: ['NOVARA', 'TRECATE'] };
const leggi = (opzioni, altre = {}) => leggiSchermata(schermata(opzioni), { ...OPZ, ...altre });

const LETTI = {
  data: '2026-10-30', oraAllert: '21:05', liberoOperativo: '22:10', missione: '99ZZ0042', comune: 'NOVARA', mezzo: '3050',
  codiceInvio: 'ROSSO', codiceRientro: 'ROSSO', patologiaInvio: '04 - Neuro', patologiaRientro: '04 - Neuro',
  luogoInvio: 'S - Sierra', luogoRientro: 'S - Sierra', eta: 41, sesso: 'Femmina', esito: 'Trasportato', ospedale: 'Novara',
};

test('legge tutti i campi della schermata Missione', () => {
  const { valori, nonLetti } = leggiSchermata(schermata(), OPZ);
  assert.deepEqual(valori, LETTI);
  assert.deepEqual(nonLetti, []);
});

test('missione: parte prima della barra, O e I corrette solo dove vanno cifre', () => {
  for (const missione of ['99ZZ0042/1', '99ZZ0042/4', '99ZZ 0042/2']) assert.equal(leggi({ missione }).valori.missione, '99ZZ0042');
  assert.equal(leggi({ missione: 'O9ZZOO42/2' }).valori.missione, '09ZZ0042');
  const corta = leggi({ missione: '99ZZ042/1' });
  assert.equal(corta.valori.missione, undefined);
  assert.ok(corta.nonLetti.includes('Missione'));
});

test('missione: 2 cifre, 2 lettere, 4 cifre (come 04AA0000), altrimenti non letta', () => {
  for (const missione of ['99Z21234/2', '99ZZ12S4/2', 'ABCDEFGH/1']) {
    const { valori, nonLetti } = leggi({ missione });
    assert.equal(valori.missione, undefined, missione);
    assert.ok(nonLetti.includes('Missione'), missione);
  }
});

test('mezzo: le 4 cifre dopo N0, solo se in lista', () => {
  assert.equal(leggi({ mezzo: 'N03030' }).valori.mezzo, '3030');
  assert.equal(leggi({ mezzo: 'NO3O30' }).valori.mezzo, '3030');
  const fuoriLista = leggi({ mezzo: 'N09999' });
  assert.equal(fuoriLista.valori.mezzo, undefined);
  assert.ok(fuoriLista.nonLetti.includes('Mezzo'));
});

// la foto letta due giorni dopo, dalla Libreria foto: la data non è quella del telefono
const DOPO = { adesso: new Date(2026, 10, 2, 10, 0) };
const SENZA_ORARI = [null, null, null, null, null, null];

test('data: quella della barra di stato del tablet, o il giorno prima se l\'allarme è più avanti della sua ora', () => {
  assert.equal(leggi({}, DOPO).valori.data, '2026-10-30'); // foto alle 06:15 di sabato 31, allarme alle 21:05
  assert.equal(leggi({ barra: ['23:30', 'Sab 31 Ott'] }, DOPO).valori.data, '2026-10-31');
  const tempi = ['23:55', '23:57', '00:05', '00:10', '00:12', '00:18'];
  assert.equal(leggi({ tempi, barra: ['00:20', 'Dom 1 Nov'] }, DOPO).valori.data, '2026-10-31');
  assert.equal(leggi({ barra: ['O6.l5', 'sab 3l ott'] }, DOPO).valori.data, '2026-10-30'); // O e l dove vanno cifre
  const senzaOrari = leggi({ tempi: SENZA_ORARI }, DOPO);
  assert.equal(senzaOrari.valori.data, '2026-10-31');
  assert.deepEqual(senzaOrari.nonLetti, ['Ora allert.', 'Libero operativo']);
});

test('data: l\'anno manca sulla barra, è quello che la porta a oggi o prima', () => {
  const capodanno = { adesso: new Date(2026, 0, 2, 9, 0) };
  assert.equal(leggi({ barra: ['23:40', 'Mer 31 Dic'] }, capodanno).valori.data, '2025-12-31');
  assert.equal(leggi({ barra: ['23:40', 'Ven 2 Gen'] }, capodanno).valori.data, '2026-01-02'); // oggi
});

test('data non letta sulla barra: oggi o ieri secondo il telefono, come prima, ma tra i non letti', () => {
  // giorno della settimana che non torna (un giorno letto male), giorno o ora illeggibili, data che non esiste, niente barra
  const barre = [['06:15', 'Ven 31 Ott'], ['06:15', 'Sab 3? Ott'], ['0?:15', 'Sab 31 Ott'], ['06:15', 'Sab 31 Nov'],
    ['', '']];
  for (const barra of barre) {
    const { valori, nonLetti } = leggi({ barra }, DOPO);
    assert.equal(valori.data, '2026-11-01', barra.join(' ')); // allarme alle 21:05, più avanti delle 10:00 del telefono
    assert.deepEqual(nonLetti, ['Data'], barra.join(' '));
  }
  assert.equal(leggi({ barra: ['', ''], tempi: SENZA_ORARI }, DOPO).valori.data, '2026-11-02');
});

test('orarioDa corregge solo dove il formato è certo', () => {
  assert.equal(orarioDa('22-47'), '22:47');
  assert.equal(orarioDa('2l.O5'), '21:05');
  assert.equal(orarioDa('2105'), '21:05');
  assert.equal(orarioDa('21 05'), '21:05');
  assert.equal(orarioDa('25:10'), null);
  assert.equal(orarioDa('a 031'), null);
  assert.equal(orarioDa('00:'), null);
});

test('l\'ora della barra di stato non è l\'ora allert.', () => {
  assert.equal(leggi({ tempi: [null, null, null, null, null, null] }).valori.oraAllert, undefined);
  const senzaEtichette = leggi({ conEtichette: false, tempi: ['21:05', '21:07', '21:20', '21:40', '21:52', '22:10'] });
  assert.equal(senzaEtichette.valori.oraAllert, '21:05');
  assert.equal(senzaEtichette.valori.liberoOperativo, '22:10');
  const cinque = leggi({ conEtichette: false, tempi: ['21:05', '21:07', '21:20', '21:40', '22:10'] });
  assert.equal(cinque.valori.oraAllert, undefined);
  assert.equal(cinque.valori.liberoOperativo, undefined);
});

test('Arrivo H: basta un orario impreciso per Trasportato', () => {
  assert.equal(leggi({ tempi: ['21:05', '21:07', '21:20', '21:40', '2l5Z2', '22:10'] }).valori.esito, 'Trasportato');
  const vuoto = leggi({ tempi: ['21:05', '21:07', '21:20', '21:40', null, '22:10'] });
  assert.equal(vuoto.valori.esito, undefined);
  assert.equal(vuoto.valori.ospedale, undefined);
  assert.deepEqual(vuoto.nonLetti, []);
});

test('letture unite: due orari diversi sotto la stessa etichetta non si leggono', () => {
  const diversi = leggiSchermata(unisciLetture(schermata(), { righe: [riga(p('23:10', 850, 641))] }), OPZ);
  assert.equal(diversi.valori.liberoOperativo, undefined);
  assert.ok(diversi.nonLetti.includes('Libero operativo'));
  const uguali = leggiSchermata(unisciLetture(schermata(), { righe: [riga(p('22:10', 850, 641))] }), OPZ);
  assert.equal(uguali.valori.liberoOperativo, '22:10');
});

test('letture unite: il ripiego sui sei orari si calcola solo sulla foto intera', () => {
  // orari di Allarme e Operativo illeggibili in tutte le letture; la foto intera legge 2 orari di mezzo, un ritaglio 4
  const intera = schermata({ tempi: [null, '21:07', '21:20', null, null, null] });
  const ritaglio = spostaLettura({ righe: [orari([null, '21:07', '21:20', '21:40', '21:52', null])] },
    { scala: 1, dx: 1, dy: 1 });
  for (const lettura of [intera, unisciLetture(intera, ritaglio)]) {
    const { valori, nonLetti } = leggiSchermata(lettura, { ...OPZ, intera });
    assert.deepEqual([valori.oraAllert, valori.liberoOperativo], [undefined, undefined]); // non 21:07 e 21:52
    assert.ok(nonLetti.includes('Ora allert.') && nonLetti.includes('Libero operativo'));
  }
  // senza etichette, sei orari nella foto intera: il ripiego vale anche con i ritagli uniti
  const sei = schermata({ conEtichette: false });
  const { valori } = leggiSchermata(unisciLetture(sei, ritaglio), { ...OPZ, intera: sei });
  assert.deepEqual([valori.oraAllert, valori.liberoOperativo], ['21:05', '22:10']);
});

test('spostaLettura riporta un ritaglio ingrandito sulla foto intera', () => {
  const [spostata] = spostaLettura({ righe: [riga(p('22:10', 1700, 80))] }, { scala: 2, dx: 0, dy: 600 }).righe[0].parole;
  assert.deepEqual(spostata, { testo: '22:10', x0: 850, y0: 640, x1: 895, y1: 652 });
});

test('etichetta: Operativo e Arrivo H della fila di Allarme; senza Allarme quella con un orario sotto, o la prima', () => {
  const senzaOrari = schermata({ tempi: [null, null, null, null, null, null] });
  assert.equal(etichetta(schermata(), 'OPERATIVO').y0, 600);
  assert.equal(etichetta(senzaOrari, 'OPERATIVO').y0, 600); // non lo stato del mezzo nella testata, anche senza orari
  assert.equal(etichetta(senzaOrari, 'ALLARME').x0, 100);
  assert.equal(etichetta(schermata(), 'ARRIVO H').x0, 700);
  const allarmeIllegibile = schermata({ etichette: filaEtichette({ allarme: 'A1larne' }) });
  assert.equal(etichetta(allarmeIllegibile, 'ALLARME'), null);
  assert.equal(etichetta(allarmeIllegibile, 'OPERATIVO').y0, 600); // la prima con un orario sotto
  assert.equal(etichetta(schermata({ conEtichette: false }), 'ALLARME'), null);
  assert.equal(etichetta(schermata({ conEtichette: false }), 'OPERATIVO').y0, 40); // la prima trovata
});

test('etichetta con il segno di spunta attaccato: "Y_Operativo" è Operativo, "Cooperativo" no', () => {
  const spunte = riga(p('vAllarme', 100, 600), ...ETICHETTE.parole.slice(1, -1), p('Y_Operativo', 850, 600));
  // un orario illeggibile: senza le etichette non varrebbe nemmeno il ripiego sui sei orari
  const { valori } = leggi({ etichette: spunte, tempi: ['21:05', '2?:07', '21:20', '21:40', '21:52', '22:10'] });
  assert.deepEqual([valori.oraAllert, valori.liberoOperativo, valori.esito], ['21:05', '22:10', 'Trasportato']);
  const soloOperativo = riga(...ETICHETTE.parole.slice(0, -1), p('Y_Operativo', 850, 600));
  assert.equal(leggi({ etichette: soloOperativo }).valori.liberoOperativo, '22:10');
  const altra = leggi({ etichette: riga(...ETICHETTE.parole.slice(0, -1), p('Cooperativo', 850, 600)) });
  assert.equal(altra.valori.liberoOperativo, undefined);
  assert.ok(altra.nonLetti.includes('Libero operativo'));
});

test('orario illeggibile: l\'etichetta non prende l\'orario della colonna vicina', () => {
  const { valori, nonLetti } = leggi({ etichette: filaEtichette({ larghezzaOperativo: 130 }),
    tempi: ['21:05', '21:07', '21:20', '21:40', '21:52', '2?:1O'] });
  assert.equal(valori.liberoOperativo, undefined); // non 21:52, l'orario di Arrivo H
  assert.ok(nonLetti.includes('Libero operativo'));
  assert.equal(valori.oraAllert, '21:05');
  const leggibile = leggi({ etichette: filaEtichette({ larghezzaOperativo: 130 }) }); // niente falso disaccordo con 21:52
  assert.equal(leggibile.valori.liberoOperativo, '22:10');
});

test('Arrivo H vuoto: l\'orario di Operativo, anche se vicino, non vale come trasporto', () => {
  const vicino = { righe: [riga(p('22:10', 780, 640))] }; // dentro la zona di Arrivo, ma più vicino a Operativo
  const senzaArrivoH = schermata({ tempi: ['21:05', '21:07', '21:20', '21:40', null, null] });
  const { valori } = leggiSchermata(unisciLetture(senzaArrivoH, vicino), OPZ);
  assert.equal(valori.esito, undefined);
  assert.equal(valori.ospedale, undefined);
  assert.equal(valori.liberoOperativo, '22:10');
});

test('Operativo: conta quello della fila di Allarme, non lo stato del mezzo nella testata', () => {
  const sottoLaTestata = { righe: [riga(p('21:03', 1000, 70))] };
  assert.equal(leggiSchermata(unisciLetture(schermata(), sottoLaTestata), OPZ).valori.liberoOperativo, '22:10');
});

test('letture unite: le etichette lette solo nel ritaglio fanno parte della fila di Allarme', () => {
  const prima = schermata({ etichette: riga(...ETICHETTE.parole.slice(0, -1)), // "Operativo" non letta
    tempi: ['21:05', '21:07', '21:20', '21:40', '21:52', null] });
  const ritaglio = spostaLettura({ righe: [ETICHETTE, riga(p('22:10', 850, 640))] }, { scala: 1, dx: 1, dy: 1 });
  const { valori } = leggiSchermata(unisciLetture(prima, ritaglio), OPZ);
  assert.deepEqual([valori.oraAllert, valori.liberoOperativo, valori.esito], ['21:05', '22:10', 'Trasportato']);
});

test('codice: il riquadro Valutazione e la zona alla sua destra da rileggere, anche con l\'etichetta letta male', () => {
  const lettura = { righe: [riga(p('@', 1300, 490, 40, 30), p('vaLurazione', 1354, 495, 164, 21),
    p('NIDI', 1541, 471, 141, 68))] };
  const e = etichettaValutazione(lettura);
  assert.equal(e.testo, 'vaLurazione');
  assert.deepEqual(zonaCodice(e, { width: 2000, height: 1500 }), { x0: 1518, y0: 453, x1: 1728, y1: 558 });
  assert.deepEqual(zonaCodice(e, { width: 1600, height: 500 }), { x0: 1518, y0: 453, x1: 1600, y1: 500 }); // dentro la foto
  assert.equal(zonaCodice(e, { width: 1518, height: 1500 }), null); // l'etichetta sul bordo: niente da ritagliare
  assert.equal(etichettaValutazione(schermata({ codice: '' })).y0, 100);
  assert.equal(etichettaValutazione({ righe: [riga(p('vaLutTazione', 1300, 100))] }).x0, 1300); // una lettera in più
  assert.equal(etichettaValutazione({ righe: [riga(p('vaLutTaziIone', 1300, 100))] }).x0, 1300); // due, anche nella I
  assert.equal(etichettaValutazione({ righe: [frase('VIA DELLA STAZIONE, 4', 100)] }), null);
  assert.equal(etichettaValutazione({ righe: [riga(p('VALUTA', 1300, 100), p('ZIONE', 1400, 100))] }), null); // spezzata
});

test('codice: letto solo nel ritaglio, attaccato; letto in due modi diversi resta non letto', () => {
  const intera = schermata({ codice: 'NIDI' }); // il codice sul riquadro colorato, illeggibile nella foto intera
  const ritaglio = (testo) => ({ righe: [riga(p(testo, 1541, 100))] });
  const { valori } = leggiSchermata(unisciLetture(intera, ritaglio('G13Q Li'), ritaglio('vasi')), OPZ);
  assert.deepEqual([valori.codiceInvio, valori.codiceRientro], ['GIALLO', 'GIALLO']);
  assert.deepEqual([valori.patologiaInvio, valori.luogoRientro], ['13 - Dermato', 'Q - Scuola']);
  assert.equal(leggiSchermata(unisciLetture(schermata(), ritaglio('R04S')), OPZ).valori.codiceInvio, 'ROSSO');
  const diversi = leggiSchermata(unisciLetture(intera, ritaglio('G 13 Q'), ritaglio('G 18 Q')), OPZ);
  assert.deepEqual([diversi.valori.codiceInvio, diversi.valori.patologiaInvio, diversi.valori.luogoInvio],
    [undefined, undefined, undefined]);
  assert.deepEqual(diversi.nonLetti, ['Codice', 'Patologia', 'Luogo']);
});

test('colore del riquadro: verde, giallo, rosso, nero; null se non è chiaro', () => {
  // i punti RGBA di una zona, da una lista di [colore, quanti]
  const punti = (...parti) => Uint8ClampedArray.from(parti.flatMap(([rgb, n]) => Array(n).fill([...rgb, 255]).flat()));
  const nero = [15, 15, 15];
  const bianco = [240, 240, 240];
  assert.equal(coloreRiquadro(punti([[95, 215, 30], 65], [nero, 35])), 'VERDE');
  assert.equal(coloreRiquadro(punti([[60, 120, 25], 65], [nero, 35])), 'VERDE'); // foto scura
  assert.equal(coloreRiquadro(punti([[242, 194, 48], 65], [nero, 35])), 'GIALLO');
  assert.equal(coloreRiquadro(punti([[220, 30, 40], 65], [bianco, 35])), 'ROSSO');
  assert.equal(coloreRiquadro(punti([nero, 65], [bianco, 35])), 'NERO');
  assert.equal(coloreRiquadro(punti([bianco, 65], [nero, 35])), null); // un riflesso copre il riquadro
  assert.equal(coloreRiquadro(punti([[95, 215, 30], 40], [[220, 30, 40], 40], [nero, 20])), null); // né l'uno né l'altro
  assert.equal(coloreRiquadro(punti([[40, 90, 200], 65], [bianco, 35])), null); // blu: non è il colore di un codice
  assert.equal(coloreRiquadro(new Uint8ClampedArray()), null);
});

test('colore del riquadro: si guarda dentro il riquadro, subito a destra dell\'etichetta', () => {
  const e = p('VALUTAZIONE', 1354, 495, 164, 20);
  assert.deepEqual(zonaColore(e, { width: 2000, height: 1500 }), { x0: 1548, y0: 485, x1: 1638, y1: 525 });
  assert.deepEqual(zonaColore(e, { width: 1600, height: 510 }), { x0: 1548, y0: 485, x1: 1600, y1: 510 });
  assert.equal(zonaColore(e, { width: 1540, height: 1500 }), null);
});

test('scritte sul riquadro: nere solo quelle chiuse dentro il riquadro, di qualunque colore siano', () => {
  // un ritaglio di 9×7: pannello bianco intorno ('.'), il riquadro ('#'), la scritta al centro e una x fuori, sul bordo
  const disegno = (riquadro, scritta, pannello) => (righe) => Uint8ClampedArray.from(righe.join('').split('')
    .flatMap((c) => [...({ '#': riquadro, x: scritta, '.': pannello }[c]), 255]));
  const nero = [15, 15, 15];
  const bianco = [240, 240, 240];
  const righe = ['.........', '.#######.', '.###x###.', '.##xxx##.', '.###x###.', '.#######.', '...x.....'];
  const attesa = ['.........', '.........', '....x....', '...xxx...', '....x....', '.........', '.........'].join('')
    .split('').map((c) => (c === 'x' ? 0 : 255));
  const grigi = (punti) => Array.from({ length: punti.length / 4 }, (_, i) => punti[4 * i]);
  for (const [colore, riquadro, scritta] of [['VERDE', [95, 215, 30], nero], ['NERO', nero, bianco], ['ROSSO', [220, 30, 40], bianco]]) {
    const punti = disegno(riquadro, scritta, bianco)(righe);
    assert.deepEqual(grigi(scritteSulRiquadro(punti, 9, 7, colore)), attesa, colore);
  }
});

test('codice: il colore del riquadro conferma la lettera, e basta da solo se la lettera manca, tranne il nero', () => {
  const con = (codice, coloreCodice) => leggiSchermata(schermata({ codice }), { ...OPZ, coloreCodice });
  assert.equal(con('R 04 S', 'ROSSO').valori.codiceRientro, 'ROSSO');
  assert.equal(con('R 04 S', null).valori.codiceRientro, 'ROSSO'); // colore non chiaro: vale la lettera
  const diversi = con('V 04 S', 'GIALLO'); // lettera e colore in disaccordo: il codice non si legge, numero e luogo sì
  assert.deepEqual([diversi.valori.codiceInvio, diversi.valori.codiceRientro], [undefined, undefined]);
  assert.deepEqual(diversi.nonLetti, ['Codice']);
  assert.deepEqual([diversi.valori.patologiaRientro, diversi.valori.luogoRientro], ['04 - Neuro', 'S - Sierra']);
  const soloColore = con('NIDI', 'VERDE'); // la scritta illeggibile: il codice dal colore, patologia e luogo no
  assert.deepEqual([soloColore.valori.codiceInvio, soloColore.valori.codiceRientro], ['VERDE', 'VERDE']);
  assert.deepEqual(soloColore.nonLetti, ['Patologia', 'Luogo']);
  assert.equal(con('B 19 Z', 'GIALLO').valori.codiceRientro, 'GIALLO'); // B non è un codice: vale il colore
  // un riquadro scuro può essere solo una foto buia: senza la N il nero non si legge
  assert.equal(con('NIDI', 'NERO').valori.codiceRientro, undefined);
  assert.ok(con('NIDI', 'NERO').nonLetti.includes('Codice'));
});

test('codice nero: solo nel rientro, l\'invio non ha il NERO; patologia e luogo in tutti e due', () => {
  for (const coloreCodice of [null, 'NERO']) {
    const { valori, nonLetti } = leggiSchermata(schermata({ codice: 'N 19 Z' }), { ...OPZ, coloreCodice });
    assert.deepEqual([valori.codiceInvio, valori.codiceRientro], [undefined, 'NERO']);
    assert.deepEqual([valori.patologiaInvio, valori.patologiaRientro], ['19 - Altro', '19 - Altro']);
    assert.deepEqual([valori.luogoInvio, valori.luogoRientro], ['Z - Altro', 'Z - Altro']);
    assert.deepEqual(nonLetti, []);
  }
  const r = applicaLettura(recordVuoto('x', ADESSO), leggi({ codice: 'N 19 Z' }).valori);
  assert.deepEqual([r.codiceInvio, r.codiceRientro], ['', 'NERO']);
});

test('codice in invio e rientro; B lascia vuoto il codice', () => {
  const v = leggi({ codice: 'V 09L' }).valori; // manca lo spazio tra numero e lettera, come capita al lettore
  assert.deepEqual([v.codiceInvio, v.codiceRientro], ['VERDE', 'VERDE']);
  assert.deepEqual([v.patologiaInvio, v.patologiaRientro], ['09 - Gastro', '09 - Gastro']);
  assert.deepEqual([v.luogoInvio, v.luogoRientro], ['L - Lavoro', 'L - Lavoro']);
  const b = leggi({ codice: 'B 19 Z' });
  assert.deepEqual([b.valori.codiceInvio, b.valori.codiceRientro], [undefined, undefined]);
  assert.ok(b.nonLetti.includes('Codice'));
  assert.deepEqual([b.valori.patologiaInvio, b.valori.patologiaRientro], ['19 - Altro', '19 - Altro']);
  assert.deepEqual([b.valori.luogoInvio, b.valori.luogoRientro], ['Z - Altro', 'Z - Altro']);
});

test('età +1 tra 0 e 120, mesi non letti', () => {
  assert.equal(leggi({ eta: '40 anni' }).valori.eta, 41);
  assert.equal(leggi({ eta: '0 anni' }).valori.eta, 1);
  assert.equal(leggi({ eta: '119 anni' }).valori.eta, 120);
  for (const eta of ['120 anni', '8 mesi']) {
    const { valori, nonLetti } = leggi({ eta });
    assert.equal(valori.eta, undefined, eta);
    assert.ok(nonLetti.includes('Età'), eta);
  }
  assert.equal(leggi({ sesso: 'M' }).valori.sesso, 'Maschio');
});

test('età: solo dalla riga di "Data di nascita", non dagli anni letti accanto al piano', () => {
  const piano = leggiSchermata(unisciLetture(schermata({ eta: '' }), { righe: [frase('SCALA --, PIANO 7 ANNI', 200)] }), OPZ);
  assert.equal(piano.valori.eta, undefined);
  assert.ok(piano.nonLetti.includes('Età'));
  const { righe } = schermata();
  const prima = { righe: [...righe.slice(0, 5), frase('SCALA --, PIANO 7 ANNI', 190), ...righe.slice(6)] };
  assert.equal(leggiSchermata(prima, OPZ).valori.eta, 41);
});

test('comune: dopo il civico, colonna di destra tagliata, senza civico un comune noto', () => {
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 NOVARA | Coscienza SI' }).valori.comune, 'NOVARA');
  assert.equal(leggi({ indirizzo: 'VIA ROMA, 3/B SAN PIETRO MOSEZZO' }).valori.comune, 'SAN PIETRO MOSEZZO');
  assert.equal(leggi({ indirizzo: 'STRADA PROVINCIALE TRECATE' }).valori.comune, 'TRECATE');
  const ignoto = leggi({ indirizzo: 'STRADA DEL BOSCO' });
  assert.equal(ignoto.valori.comune, undefined);
  assert.ok(ignoto.nonLetti.includes('Comune'));
});

test('comune: una riga di segni tra l\'indirizzo e "SCALA" non lo nasconde', () => {
  const { righe } = schermata({ indirizzo: 'VIA DELLE PROVE, 7 GALLIATE Coscienza si' });
  const conSegni = { righe: [...righe.slice(0, 5), frase('v =', 175), ...righe.slice(5)] };
  assert.equal(leggiSchermata(conSegni, OPZ).valori.comune, 'GALLIATE');
  const noto = schermata({ indirizzo: 'STRADA PROVINCIALE TRECATE' });
  assert.equal(leggiSchermata({ righe: [...noto.righe.slice(0, 5), frase('v =', 175), ...noto.righe.slice(5)] }, OPZ)
    .valori.comune, 'TRECATE');
});

test('comune: in fondo si tolgono i segni di un carattere e quelli senza lettere', () => {
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 GALLIATE È Coscienza SI' }).valori.comune, 'GALLIATE');
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 GALLIATE — 1' }).valori.comune, 'GALLIATE');
  assert.equal(leggi({ indirizzo: 'VIA ROMA, 3/B SAN PIETRO MOSEZZO N' }).valori.comune, 'SAN PIETRO MOSEZZO');
  const solo = leggi({ indirizzo: 'VIA ROMA, 3 È' });
  assert.equal(solo.valori.comune, undefined);
  assert.ok(solo.nonLetti.includes('Comune'));
});

test('comune: con parole di due lettere in fondo, solo un comune già in archivio, mai un nome troncato', () => {
  const noti = { comuniNoti: ['SAN SEBASTIANO DA PO', 'MORANO SUL PO', 'NOVARA', 'RE'] };
  assert.equal(leggi({ indirizzo: 'VIA ROMA, 3 SAN SEBASTIANO DA PO' }, noti).valori.comune, 'SAN SEBASTIANO DA PO');
  assert.equal(leggi({ indirizzo: 'VIA ROMA, 3 MORANO SUL PO | Coscienza SI' }, noti).valori.comune, 'MORANO SUL PO');
  assert.equal(leggi({ indirizzo: 'VIA ROMA, 3 RE' }, noti).valori.comune, 'RE');
  for (const indirizzo of ['VIA ROMA, 3 SAN SEBASTIANO DA PO', 'VIA ROMA, 3 MORANO SUL PO', 'VIA ROMA, 3 RE']) {
    const ignoto = leggi({ indirizzo }); // in archivio solo NOVARA e TRECATE: né 'SAN SEBASTIANO' né 'MORANO SUL'
    assert.equal(ignoto.valori.comune, undefined, indirizzo);
    assert.ok(ignoto.nonLetti.includes('Comune'), indirizzo);
  }
  // un segno letto in fondo: il nome senza di esso vale solo se è un comune noto
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 NOVARA fi Coscienza SI' }).valori.comune, 'NOVARA');
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 NOVARA fi È' }).valori.comune, 'NOVARA');
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 GALLIATE fi' }).valori.comune, undefined);
});

test('comune: una cifra o un segno rimasti nel nome lo lasciano non letto, salvo lo stesso nome già in archivio', () => {
  const sonde = ['NOVARA.', 'N0VARA', 'MORANO SUL P0', 'NOVARA -I'];
  for (const comune of sonde) {
    const { valori, nonLetti } = leggi({ indirizzo: `VIA DELLE PROVE, 12 ${comune}` }, { comuniNoti: [] });
    assert.equal(valori.comune, undefined, comune);
    assert.ok(nonLetti.includes('Comune'), comune);
  }
  // con NOVARA e MORANO SUL PO in archivio: le stesse parole prendono la scrittura dell'archivio, una cifra al posto di
  // una lettera o un pezzo in più no
  const noti = { comuniNoti: ['NOVARA', 'MORANO SUL PO'] };
  const letto = (comune) => leggi({ indirizzo: `VIA DELLE PROVE, 12 ${comune}` }, noti).valori.comune;
  assert.equal(letto('NOVARA.'), 'NOVARA');
  for (const comune of ['N0VARA', 'MORANO SUL P0', 'NOVARA -I']) assert.equal(letto(comune), undefined, comune);
});

test('comune: lettere accentate, apostrofo e trattino dentro il nome', () => {
  for (const comune of ['CAVAGLIÀ', 'SANT\'ANDREA', 'SANT’ANDREA', 'VALLE-SAN NICOLAO']) {
    assert.equal(leggi({ indirizzo: `VIA ROMA, 3 ${comune}` }, { comuniNoti: [] }).valori.comune, comune);
  }
  for (const comune of ['SANT\'', 'ANDREA-', 'SANT\'\'ANDREA']) {
    assert.equal(leggi({ indirizzo: `VIA ROMA, 3 ${comune}` }, { comuniNoti: [] }).valori.comune, undefined, comune);
  }
});

test('ospedale: voce più lunga contenuta nel testo, accenti ignorati', () => {
  assert.equal(leggi({ ospedale: 'OSPEDALE DI CIRIE' }).valori.ospedale, 'Ciriè');
  const voce = (v) => ({ id: `ospedale-${v}`, voce: v, attiva: true, sistema: false, updatedAt: '1970-01-01T00:00:00.000Z' });
  const liste = { ...LISTE_PREDEFINITE, ospedale: [voce('Torino'), voce('Torino CTO')] };
  assert.equal(leggi({ ospedale: 'PRESIDIO TORINO CTO' }, { liste }).valori.ospedale, 'Torino CTO');
  assert.equal(leggi({ ospedale: 'OSPEDALE CASTIGLIONE' }).valori.ospedale, undefined); // parole intere: non Asti
  const nessuno = leggi({ ospedale: '--' }).valori;
  assert.equal(nessuno.ospedale, undefined);
  assert.equal(nessuno.esito, 'Trasportato');
});

test('foto sbagliata: nessun campo, nemmeno la data', () => {
  const { valori, nonLetti } = leggiSchermata({ righe: [frase('LISTA DELLA SPESA 12 UOVA', 100)] }, OPZ);
  assert.deepEqual(valori, {});
  assert.deepEqual(nonLetti, CAMPI_TABLET.map(([, nome]) => nome));
});

test('applicaLettura: ordine del form e regole', () => {
  const r = applicaLettura(recordVuoto('x', ADESSO), LETTI);
  assert.equal(r.tipologia, 'India'); // 3050 alle 21:05: l'ora è già nel record quando arriva il mezzo
  assert.equal(r.ospedale, 'Novara');
  assert.equal(r.data, '2026-10-30');
  assert.equal(applicaLettura(recordVuoto('x', ADESSO), { ...LETTI, oraAllert: '10:00' }).tipologia, 'Mike');
});

test('daTesseract', () => {
  const data = { blocks: [{ paragraphs: [{ lines: [{
    text: ' Allarme \n', words: [{ text: 'Allarme', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }],
  }] }] }] };
  assert.deepEqual(daTesseract(data), { righe: [{ testo: 'Allarme', parole: [{ testo: 'Allarme', x0: 1, y0: 2, x1: 3, y1: 4 }] }] });
  assert.deepEqual(daTesseract({ blocks: null }), { righe: [] });
});

test('orari: un\'etichetta letta male nel ritaglio, sopra quella giusta, non si prende l\'orario', () => {
  // il ritaglio legge 'Alame' al posto di Allarme, mezzo pixel più vicino all'orario: l'orario resta di Allarme
  const ritaglio = { righe: [riga(p('Alame', 99.5, 600.5), p('Partenza', 250, 600.5)), riga(p('21:05', 100, 640))] };
  const { valori, nonLetti } = leggiSchermata(unisciLetture(schermata(), ritaglio), OPZ);
  assert.equal(valori.oraAllert, '21:05');
  assert.deepEqual(nonLetti, []);
});

test('orari: l\'orario sta fino a cinque altezze dell\'etichetta sotto di essa', () => {
  const { righe } = schermata({ tempi: SENZA_ORARI });
  const bassi = { righe: [...righe, orari(['21:05', '21:07', '21:20', '21:40', '21:52', '22:10']).parole
    .reduce((r, q) => ({ ...r, parole: [...r.parole, { ...q, y0: 710, y1: 734 }] }), { testo: '', parole: [] })] };
  const { valori } = leggiSchermata(bassi, OPZ); // etichette a y 600, alte 24: orari a 710 = 600 + 4,6 altezze
  assert.deepEqual([valori.oraAllert, valori.liberoOperativo], ['21:05', '22:10']);
  // a 725 = 5,2 altezze: no (cinque orari soltanto, così non scatta il ripiego sui sei orari in basso)
  const troppo = { righe: [...righe, { ...bassi.righe.at(-1), parole: bassi.righe.at(-1).parole.slice(1).map((q) => ({ ...q, y0: 725, y1: 749 })) }] };
  assert.equal(leggiSchermata(troppo, OPZ).valori.liberoOperativo, undefined);
});

test('zonaOrari: la fila degli orari, da un\'altezza sopra Allarme a otto sotto, larga quanto la foto', () => {
  const allarme = p('Allarme', 100, 600); // alta 24
  assert.deepEqual(zonaOrari(allarme, { width: 2000, height: 1500 }), { x0: 0, y0: 576, x1: 2000, y1: 816 });
  assert.deepEqual(zonaOrari(allarme, { width: 1000, height: 700 }), { x0: 0, y0: 576, x1: 1000, y1: 700 });
  assert.deepEqual(zonaOrari(p('Allarme', 100, 10), { width: 1000, height: 700 }), { x0: 0, y0: 0, x1: 1000, y1: 226 });
});

test('sesso: la riga "Sesso" si rilegge ingrandita, trovata da "nascita"', () => {
  const lettura = { righe: [riga(p('Data', 1338, 1025, 45, 18), p('di', 1393, 1027, 16, 17), p('nascita', 1418, 1031, 75, 16),
    p('88', 1594, 1033, 23, 17), p('anni', 1627, 1037, 41, 13))] };
  const e = etichettaNascita(lettura);
  assert.equal(e.testo, 'nascita');
  // otto altezze a sinistra ('Data di '), quattordici a destra (il valore), cinque sopra (la riga Sesso) e una sotto
  assert.deepEqual(zonaSesso(e, { width: 2000, height: 1500 }), { x0: 1290, y0: 951, x1: 1717, y1: 1063 });
  assert.deepEqual(zonaSesso(e, { width: 1600, height: 1060 }), { x0: 1290, y0: 951, x1: 1600, y1: 1060 });
  assert.equal(zonaSesso(e, { width: 1290, height: 1500 }), null);
  assert.equal(etichettaNascita({ righe: [riga(p('nascita,', 1418, 1031))] }).testo, 'nascita,');
  assert.equal(etichettaNascita({ righe: [riga(p('rinascita', 1418, 1031))] }), null);
  assert.equal(etichettaNascita(schermata()), null); // nelle letture di prova la riga è una parola sola
});

test('sesso: letto solo nel ritaglio vale; letto in due modi diversi resta non letto', () => {
  const ritaglio = (testo) => ({ righe: [frase(testo, 401)] });
  // la foto intera non legge la F ('P'): la legge il ritaglio
  assert.equal(leggiSchermata(unisciLetture(schermata({ sesso: 'P' }), ritaglio('Sesso F')), OPZ).valori.sesso, 'Femmina');
  // la F letta E o È vale F: sul tablet ci sono solo M e F; con la F del ritaglio non è un disaccordo
  assert.equal(leggi({ sesso: 'E' }).valori.sesso, 'Femmina');
  assert.equal(leggi({ sesso: 'È' }).valori.sesso, 'Femmina');
  assert.equal(leggiSchermata(unisciLetture(schermata({ sesso: 'È' }), ritaglio('Sesso F')), OPZ).valori.sesso, 'Femmina');
  assert.equal(leggi({ sesso: 'P' }).valori.sesso, undefined);
  const diversi = leggiSchermata(unisciLetture(schermata({ sesso: 'M' }), ritaglio('Sesso F')), OPZ);
  assert.equal(diversi.valori.sesso, undefined);
  assert.deepEqual(diversi.nonLetti, ['Sesso']);
  assert.equal(leggiSchermata(unisciLetture(schermata({ sesso: 'F' }), ritaglio('Sesso F')), OPZ).valori.sesso, 'Femmina');
});

test('comune: la colonna di destra (Valutazione) si taglia per posizione, anche letta male', () => {
  // l'indirizzo a sinistra e, sulla stessa riga, 'Coscienza Si' della colonna di destra letto 'Cosdenza Si'
  const indirizzo = riga(p('FRAZIONE', 40, 160), p('PROVE,', 140, 160), p('27', 240, 160, 30), p('CAMERI', 280, 160, 150),
    p('Cosdenza', 1100, 160), p('Si', 1300, 160, 20));
  const { righe } = schermata();
  const conColonna = (etichette) => ({ righe: [...righe.slice(0, 4), indirizzo, righe[5], ...etichette, ...righe.slice(6)] });
  const sesso = riga(p('Sesso', 1070, 400, 50, 16), p('F', 1300, 400, 10, 16));
  assert.equal(leggiSchermata(conColonna([sesso]), OPZ).valori.comune, 'CAMERI');
  const nascita = riga(p('Data', 1070, 430, 45), p('di', 1120, 430, 16), p('nascita', 1140, 430, 75), p('40', 1300, 430), p('anni', 1330, 430));
  assert.equal(leggiSchermata(conColonna([nascita]), OPZ).valori.comune, 'CAMERI');
  assert.equal(leggiSchermata(conColonna([riga(p('Dolore', 1070, 300), p('--', 1300, 300))]), OPZ).valori.comune, 'CAMERI');
  // senza nessuna etichetta della colonna di destra la posizione non dice niente: 'CAMERI COSDENZA SI' non è un comune
  assert.equal(leggiSchermata(conColonna([]), OPZ).valori.comune, undefined);
});

test('comune: "Coscienza" nel testo chiude l\'indirizzo anche senza la C', () => {
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 NOVARA oscienza Si' }).valori.comune, 'NOVARA');
  assert.equal(leggi({ indirizzo: 'VIA DELLE PROVE, 12 GALLIATE Coscienza' }).valori.comune, 'GALLIATE');
});
