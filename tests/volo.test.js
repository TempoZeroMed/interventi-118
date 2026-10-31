import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaStatisticheVolo } from '../js/core/volo.js';
import { LISTE_PREDEFINITE } from '../js/core/campi.js';
import { rinominaVoce } from '../js/core/liste.js';

const VUOTO = {
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
  data: '', oraAllert: '', missione: '', pazienti: null, comune: '', mezzo: '', tipologia: '', codiceInvio: '',
  patologiaInvio: '', luogoInvio: '', eta: null, sesso: '', esito: '', ospedale: '', codiceRientro: '',
  patologiaRientro: '', luogoRientro: '', liberoOperativo: '', tipoMissione: '', tempoVolo: null, manovre: [],
};
const r = (campi) => ({ ...VUOTO, ...campi });
const senzaVolo = (campi) => {
  const x = r(campi);
  delete x.tempoVolo;
  delete x.manovre;
  return x;
};

// Valori attesi ricavati a mano da questi record.
const RECORD = [
  r({ id: 'v1', data: '2026-03-10', mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 30 }),
  r({ id: 'v2', data: '2026-03-20', mezzo: 'V-ECHO', tipoMissione: 'HSR', tempoVolo: 90, manovre: ['VD', 'VSP'] }),
  r({ id: 'v3', data: '2026-04-05', mezzo: 'T-ECHO', tipoMissione: 'HEMS', tempoVolo: 45, manovre: ['HD'] }),
  senzaVolo({ id: 'v4', data: '2026-04-06', mezzo: 'T-ECHO' }), // salvato prima dei campi di volo
  r({ id: 'a1', data: '2026-03-11', mezzo: '3030' }),
  r({ id: 'x', data: '2026-03-12', mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 100, manovre: ['HD'], deleted: true }),
];
const TUTTO = { tipo: 'tutto' };

test('basi, KPI e tempo di volo: solo elicotteri, eliminati esclusi', () => {
  const s = calcolaStatisticheVolo(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.basi, { missioni: 4, conTempo: 3 });
  assert.deepEqual(s.kpi, {
    missioni: 4,
    perMezzo: [{ voce: 'V-ECHO', n: 2 }, { voce: 'T-ECHO', n: 2 }, { voce: 'C-ECHO', n: 0 }, { voce: 'A-ECHO', n: 0 }],
    minutiVolo: 165,
    conTempo: 3, voloMedio: 55, voloMediana: 45, conManovre: 2, conManovrePct: 50,
  });
  assert.deepEqual(s.tempo, { totaleMinuti: 165, media: 55, mediana: 45, minimo: 30, massimo: 90 });
});

test('per mezzo e tipo di missione (% sui compilati, riga "Non compilato")', () => {
  const s = calcolaStatisticheVolo(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.mezzi, [
    { voce: 'V-ECHO', n: 2, pct: 0.5, minutiVolo: 120, voloMedio: 60, conTempo: 2 },
    { voce: 'T-ECHO', n: 2, pct: 0.5, minutiVolo: 45, voloMedio: 45, conTempo: 1 },
    { voce: 'C-ECHO', n: 0, pct: 0, minutiVolo: 0, voloMedio: null, conTempo: 0 },
    { voce: 'A-ECHO', n: 0, pct: 0, minutiVolo: 0, voloMedio: null, conTempo: 0 },
  ]);
  assert.deepEqual(s.tipi, {
    voci: [
      { voce: 'HEMS', n: 2, pct: 2 / 3, minutiVolo: 75 }, { voce: 'HSR', n: 1, pct: 1 / 3, minutiVolo: 90 },
      { voce: 'IFT', n: 0, pct: 0, minutiVolo: 0 },
    ],
    nonCompilato: 1,
  });
});

test('manovre in % sulle missioni; almeno una, più di una, nessuna', () => {
  const s = calcolaStatisticheVolo(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.manovre.voci.map((m) => [m.codice, m.n, m.pct]),
    [['HD', 1, 0.25], ['VD', 1, 0.25], ['HS', 0, 0], ['VS', 0, 0], ['VSP', 1, 0.25], ['VSB', 0, 0]]);
  assert.equal(s.manovre.voci[4].nome, 'Verricello salita pannolone');
  assert.deepEqual([s.manovre.almenoUna, s.manovre.piuDiUna, s.manovre.nessuna],
    [{ n: 2, pct: 0.5 }, { n: 1, pct: 0.25 }, { n: 2, pct: 0.5 }]);
});

test('per mese: i 12 mesi dell\'anno, ore del grafico arrotondate a un decimale', () => {
  const s = calcolaStatisticheVolo(RECORD, LISTE_PREDEFINITE, TUTTO);
  assert.equal(s.mesi.length, 12);
  assert.deepEqual(s.mesi[2], { chiave: '2026-03', voce: 'Mar', missioni: 2, minutiVolo: 120, voloMedio: 60, conManovre: 1, oreGrafico: 2 });
  assert.deepEqual(s.mesi[3], { chiave: '2026-04', voce: 'Apr', missioni: 2, minutiVolo: 45, voloMedio: 45, conManovre: 1, oreGrafico: 0.8 });
  assert.deepEqual(s.mesi[0], { chiave: '2026-01', voce: 'Gen', missioni: 0, minutiVolo: 0, voloMedio: null, conManovre: 0, oreGrafico: 0 });
});

test('periodo senza voli: tutto a zero, medie nulle', () => {
  const s = calcolaStatisticheVolo(RECORD, LISTE_PREDEFINITE, { tipo: 'anno', anno: 2025 });
  assert.deepEqual(s.basi, { missioni: 0, conTempo: 0 });
  assert.equal(s.tempo.media, null);
  assert.equal(s.tempo.totaleMinuti, 0);
  assert.equal(s.kpi.voloMedio, null);
  assert.equal(s.manovre.almenoUna.pct, 0);
  assert.deepEqual(s.mezzi.map((m) => m.voloMedio), [null, null, null, null]);
});

test('C-ECHO e A-ECHO contano come V-ECHO e T-ECHO', () => {
  const record = [
    r({ id: 'c', data: '2026-06-01', mezzo: 'C-ECHO', tipoMissione: 'HEMS', tempoVolo: 40, manovre: ['HD'] }),
    r({ id: 'a', data: '2026-06-02', mezzo: 'A-ECHO', tipoMissione: 'IFT', tempoVolo: 80 }),
    r({ id: 'v', data: '2026-06-03', mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: 30 }),
  ];
  const s = calcolaStatisticheVolo(record, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.basi, { missioni: 3, conTempo: 3 });
  assert.deepEqual(s.mezzi.map((m) => [m.voce, m.n, m.minutiVolo]),
    [['V-ECHO', 1, 30], ['T-ECHO', 0, 0], ['C-ECHO', 1, 40], ['A-ECHO', 1, 80]]);
  assert.equal(s.kpi.conManovre, 1);
});

test('voce rinominata: la tabella dei tipi usa il nome nuovo, il valore fuori lista compare in fondo', () => {
  const { liste } = rinominaVoce(LISTE_PREDEFINITE, [], 'tipoMissione', 'tipoMissione-hsr', 'HSR soccorso', new Date());
  const record = [
    r({ id: 'a', data: '2026-05-01', mezzo: 'V-ECHO', tipoMissione: 'HSR soccorso', tempoVolo: 40 }),
    r({ id: 'b', data: '2026-05-02', mezzo: 'V-ECHO', tipoMissione: 'Altro tipo', tempoVolo: 20 }),
  ];
  const { tipi } = calcolaStatisticheVolo(record, liste, TUTTO);
  assert.deepEqual(tipi.voci.map((t) => [t.voce, t.n]), [['HEMS', 0], ['HSR soccorso', 1], ['IFT', 0], ['Altro tipo', 1]]);
});

test('intervallo a cavallo d\'anno: mesi con l\'anno nell\'etichetta', () => {
  const record = [
    r({ id: 'a', data: '2026-12-30', mezzo: 'V-ECHO', tempoVolo: 30 }),
    r({ id: 'b', data: '2027-01-02', mezzo: 'T-ECHO', tempoVolo: 50 }),
  ];
  const s = calcolaStatisticheVolo(record, LISTE_PREDEFINITE, { tipo: 'intervallo', da: '2026-12-01', a: '2027-01-31' });
  assert.deepEqual(s.mesi.map((m) => m.voce), ['Dic 2026', 'Gen 2027']);
});

test('un tempo di volo non numerico non entra in somme e medie', () => {
  const record = [
    r({ id: 'a', data: '2026-05-01', mezzo: 'V-ECHO', tempoVolo: 40 }),
    r({ id: 'b', data: '2026-05-02', mezzo: 'V-ECHO', tempoVolo: NaN }),
    r({ id: 'c', data: '2026-05-03', mezzo: 'V-ECHO', tempoVolo: '45 min' }),
  ];
  const s = calcolaStatisticheVolo(record, LISTE_PREDEFINITE, TUTTO);
  assert.deepEqual(s.basi, { missioni: 3, conTempo: 1 });
  assert.deepEqual([s.kpi.minutiVolo, s.tempo.media], [40, 40]);
});
