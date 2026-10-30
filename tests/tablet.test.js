// Lettura della schermata "Missione" del tablet: solo letture inventate (missioni 99ZZ…), mai dati reali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leggiSchermata, applicaLettura, orarioDa, daTesseract, spostaLettura, unisciLetture, etichetta,
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
function schermata({ missione = '99ZZ0042/3', mezzo = 'N03050', indirizzo = 'VIA DELLE PROVE, 12 NOVARA | Coscienza SI',
  codice = 'R 04 S', eta = '40 anni', sesso = 'F', ospedale = 'OSPEDALE MAGGIORE NOVARA',
  tempi = ['21:05', '21:07', '21:20', '21:40', '21:52', '22:10'], conEtichette = true, etichette = ETICHETTE } = {}) {
  return { righe: [
    riga(p('06:15', 40, 10, 60), p('Sab 31 Ott', 110, 10, 120)),
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

test('data: oggi, o ieri se l\'allarme è più avanti dell\'ora attuale', () => {
  assert.equal(leggi({}, { adesso: new Date(2026, 9, 31, 6, 15) }).valori.data, '2026-10-30');
  assert.equal(leggi({}, { adesso: new Date(2026, 9, 31, 23, 30) }).valori.data, '2026-10-31');
  const tempi = ['23:55', '23:57', '00:05', '00:10', '00:12', '00:18'];
  assert.equal(leggi({ tempi }, { adesso: new Date(2026, 10, 1, 0, 20) }).valori.data, '2026-10-31');
  const senzaOrari = leggi({ tempi: [null, null, null, null, null, null] });
  assert.equal(senzaOrari.valori.data, '2026-10-31');
  assert.ok(senzaOrari.nonLetti.includes('Ora allert.'));
  assert.ok(senzaOrari.nonLetti.includes('Libero operativo'));
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
  assert.equal(nonLetti.length, 10);
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
