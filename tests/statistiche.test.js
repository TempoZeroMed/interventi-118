import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaStatistiche, filtraPeriodo, arrotondaExcel } from '../js/core/statistiche.js';
import { LISTE_PREDEFINITE } from '../js/core/campi.js';
import { RECORD, r } from './fixtures/record-domande.js';

const TUTTO = { tipo: 'tutto' };

test('KPI della dashboard', () => {
  assert.deepEqual(calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO).kpi, {
    interventi: 5, valutati: 4, annullati: 1, annullatiPct: 20,
    trasportati: 1, trasportatiPct: 25, deceduti: 1, decedutiPct: 25,
    rossiRientro: 1, rossiRientroPct: 25, rossiInvio: 1, rossiInvioPct: 20, neri: 1,
    durataMediana: 42.5, durataMedia: 39, durataMax: 60, etaMediana: 50,
    maschiPct: 75, femminePct: 50, avvisi: 0, avvisiPct: 0,
  });
});

test('tabella 1 · riepilogo (sesso ed età contano anche gli annullati, come l\'Excel)', () => {
  assert.deepEqual(calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO).riepilogo, {
    totali: 5, annullati: 1, annullatiPct: 0.2, valutati: 4,
    trasportati: 1, trasportatiPct: 0.25, deceduti: 1, decedutiPct: 0.25,
    maschi: 3, maschiPct: 0.75, femmine: 2, femminePct: 0.5,
    india: 2, indiaPct: 0.4, mike: 3, mikePct: 0.6,
    etaMedia: 48, etaMediana: 50, etaMin: 5, etaMax: 85,
    durataMedia: 39, durataMediana: 42.5, durataMax: 60,
  });
});

test('tabelle 2, 3 e 3b · codici, matrice invio/rientro, cambio di codice (NERO escluso)', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.codici, [
    { voce: 'VERDE', invio: 1, invioPct: 0.2, rientro: 1, rientroPct: 0.25 },
    { voce: 'GIALLO', invio: 3, invioPct: 0.6, rientro: 1, rientroPct: 0.25 },
    { voce: 'ROSSO', invio: 1, invioPct: 0.2, rientro: 1, rientroPct: 0.25 },
    { voce: 'NERO', invio: null, invioPct: null, rientro: 1, rientroPct: 0.25 },
  ]);
  assert.deepEqual(s.matrice, [
    { invio: 'VERDE', celle: { VERDE: 0, GIALLO: 0, ROSSO: 0, NERO: 0 }, totale: 0 },
    { invio: 'GIALLO', celle: { VERDE: 1, GIALLO: 1, ROSSO: 1, NERO: 0 }, totale: 3 },
    { invio: 'ROSSO', celle: { VERDE: 0, GIALLO: 0, ROSSO: 0, NERO: 1 }, totale: 1 },
  ]);
  assert.deepEqual(s.cambioCodice, {
    piuGrave: 1, piuGravePct: 1 / 3, invariato: 1, invariatoPct: 1 / 3, menoGrave: 1, menoGravePct: 1 / 3,
  });
});

test('tabelle 4 e 5 · patologia e luogo: invio su totali, rientro su valutati', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.equal(s.patologia.length, 17);
  const pat = Object.fromEntries(s.patologia.map((x) => [x.voce, x]));
  assert.deepEqual(pat['01 - Trauma'], { voce: '01 - Trauma', invio: 2, invioPct: 0.4, rientro: 1, rientroPct: 0.25 });
  assert.deepEqual(pat['19 - Altro'], { voce: '19 - Altro', invio: 0, invioPct: 0, rientro: 1, rientroPct: 0.25 });
  assert.deepEqual(pat['06 - Onco'], { voce: '06 - Onco', invio: 0, invioPct: 0, rientro: 0, rientroPct: 0 });
  const luogo = Object.fromEntries(s.luogo.map((x) => [x.voce, x]));
  assert.deepEqual(luogo['S - Sierra'], { voce: 'S - Sierra', invio: 2, invioPct: 0.4, rientro: 1, rientroPct: 0.25 });
});

test('tabelle 6 e 7 · esito su totali, fasce d\'età su valutati', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.esito.map((x) => [x.voce, x.n, x.pct]), [
    ['Trasportato', 1, 0.2], ['Inviato con MSB', 0, 0], ['Inviato con MSA', 0, 0], ['Inviato con ELI', 0, 0],
    ['Non Necessita', 1, 0.2], ['Rifiuto Trasporto', 1, 0.2], ['Deceduto', 1, 0.2], ['Annullato da CO', 1, 0.2],
    ['Non Raggiungibile', 0, 0],
  ]);
  assert.deepEqual(s.fasceEta, [
    { voce: '0–17', n: 1, pct: 0.25 }, { voce: '18–40', n: 1, pct: 0.25 }, { voce: '41–65', n: 1, pct: 0.25 },
    { voce: '66–80', n: 1, pct: 0.25 }, { voce: 'oltre 80', n: 1, pct: 0.25 },
  ]);
});

test('fasce d\'età: un\'età non intera tra due fasce non viene contata, come nelle formule', () => {
  const s = calcolaStatistiche([r({ id: 'x', data: '2026-01-01', eta: 17.5 })], LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.fasceEta.map((x) => x.n), [0, 0, 0, 0, 0]);
});

test('tabella 8 · per mese: con "tutto" copre gli anni interi presenti, con l\'anno nell\'etichetta se sono più di uno', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.equal(s.mesi.length, 24);
  assert.deepEqual(s.mesi[0], { chiave: '2026-01', voce: 'Gen 2026', interventi: 2, rossiInvio: 1, trasportati: 1, durataMedia: 50 });
  assert.deepEqual(s.mesi[1], { chiave: '2026-02', voce: 'Feb 2026', interventi: 1, rossiInvio: 0, trasportati: 0, durataMedia: 10 });
  assert.deepEqual(s.mesi[2], { chiave: '2026-03', voce: 'Mar 2026', interventi: 0, rossiInvio: 0, trasportati: 0, durataMedia: null });
  assert.deepEqual(s.mesi[12], { chiave: '2027-01', voce: 'Gen 2027', interventi: 1, rossiInvio: 0, trasportati: 0, durataMedia: 45 });
});

test('tabella 9 · ora di allertamento (conta anche le righe senza data)', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.equal(s.ore.length, 24);
  assert.deepEqual(s.ore.filter((x) => x.n > 0), [
    { voce: '08', n: 1, pct: 0.2 }, { voce: '10', n: 1, pct: 0.2 }, { voce: '12', n: 1, pct: 0.2 },
    { voce: '14', n: 1, pct: 0.2 }, { voce: '23', n: 1, pct: 0.2 },
  ]);
});

test('tabella 10 · mezzo con India, Mike e durata media arrotondata', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  const mezzi = Object.fromEntries(s.mezzi.map((x) => [x.voce, x]));
  assert.deepEqual(mezzi['3030'], { voce: '3030', n: 3, pct: 0.6, india: 0, mike: 3, durataMedia: 38 });
  assert.deepEqual(mezzi['5022'], { voce: '5022', n: 1, pct: 0.2, india: 1, mike: 0, durataMedia: 40 });
  assert.deepEqual(mezzi['3040'], { voce: '3040', n: 1, pct: 0.2, india: 1, mike: 0, durataMedia: null });
});

test('tabella 11 · ospedali in percentuale sui soli trasportati, record eliminati esclusi', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, TUTTO);
  const osp = Object.fromEntries(s.ospedali.map((x) => [x.voce, x]));
  assert.deepEqual(osp.Biella, { voce: 'Biella', n: 1, pct: 1 });
  assert.deepEqual(osp.Novara, { voce: 'Novara', n: 0, pct: 0 });
});

test('filtro periodo: anno, mese e intervallo contano solo le righe con DATA', () => {
  const ids = (periodo) => filtraPeriodo(RECORD, periodo).map((x) => x.id);
  assert.deepEqual(ids(TUTTO), ['r1', 'r2', 'r3', 'r4', 'r5']);
  assert.deepEqual(ids({ tipo: 'anno', anno: 2026 }), ['r1', 'r2', 'r3']);
  assert.deepEqual(ids({ tipo: 'mese', anno: 2026, mese: 1 }), ['r1', 'r2']);
  assert.deepEqual(ids({ tipo: 'intervallo', da: '2026-01-15', a: '2026-02-05' }), ['r2', 'r3']);
});

test('statistiche di un anno: 12 mesi senza anno nell\'etichetta', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, { tipo: 'anno', anno: 2026 });
  assert.equal(s.kpi.interventi, 3);
  assert.deepEqual(s.mesi.map((m) => m.voce), ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']);
});

test('statistiche di un intervallo a cavallo d\'anno: solo i mesi dell\'intervallo', () => {
  const s = calcolaStatistiche(RECORD, LISTE_PREDEFINITE, { tipo: 'intervallo', da: '2026-12-01', a: '2027-01-31' });
  assert.deepEqual(s.mesi.map((m) => [m.voce, m.interventi]), [['Dic 2026', 0], ['Gen 2027', 1]]);
});

test('il duplicato di MISSIONE si cerca in tutto l\'archivio, anche fuori dal periodo', () => {
  const conDuplicato = [...RECORD, r({ id: 'r8', data: '2026-03-01', missione: '04AA0001' })];
  const s = calcolaStatistiche(conDuplicato, LISTE_PREDEFINITE, { tipo: 'mese', anno: 2026, mese: 3 });
  assert.equal(s.kpi.interventi, 1);
  assert.equal(s.controlli.righeConAvvisi, 1);
  assert.deepEqual(s.controlli.perTipo.find((t) => t.voce === 'Missione duplicata'), { voce: 'Missione duplicata', n: 1 });
});

test('un valore assente dalla lista compare comunque in fondo alla tabella', () => {
  const s = calcolaStatistiche([r({ id: 'x', data: '2026-01-01', mezzo: 'X-TEST' })], LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.mezzi.at(-1), { voce: 'X-TEST', n: 1, pct: 1, india: 0, mike: 0, durataMedia: null });
});

test('voci disattivate: compaiono solo se usate nel periodo', () => {
  const liste = {
    ...LISTE_PREDEFINITE,
    ospedale: LISTE_PREDEFINITE.ospedale.map((v) => (['Asti', 'Biella'].includes(v.voce) ? { ...v, attiva: false } : v)),
  };
  const voci = calcolaStatistiche(RECORD, liste, TUTTO).ospedali.map((x) => x.voce);
  assert.equal(voci.includes('Asti'), false);
  assert.equal(voci.includes('Biella'), true);
});

test('arrotondamento come ROUND di Excel', () => {
  assert.equal(arrotondaExcel(1.005, 2), 1.01);
  assert.equal(arrotondaExcel(67.55, 1), 67.6);
  assert.equal(arrotondaExcel(2.5, 0), 3);
  assert.equal(arrotondaExcel(-2.5, 0), -3);
});
