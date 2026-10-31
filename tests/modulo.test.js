import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordVuoto, impostaCampo, copiaDaInvio, dataLocale, prontoPerSalvare, alternaManovra, collegaScheda, nuovaSchedaPaziente, bozzaConDati,
} from '../js/core/modulo.js';
import { tipologiaDelMezzo } from '../js/core/controlli.js';

const ADESSO = new Date(2026, 9, 29, 7, 5); // 29 ottobre 2026, 07:05 ora locale

test('nuovo intervento: DATA di oggi, tutto il resto vuoto', () => {
  const r = recordVuoto('id-1', ADESSO);
  assert.equal(r.id, 'id-1');
  assert.equal(r.data, '2026-10-29');
  assert.equal(r.oraAllert, '');
  assert.equal(r.eta, null);
  assert.deepEqual([r.tipoMissione, r.tempoVolo, r.manovre], ['', null, []]);
  assert.equal(r.deleted, false);
  assert.equal(r.createdAt, ADESSO.toISOString());
});

test('data di oggi in ora locale', () => {
  assert.equal(dataLocale(new Date(2026, 0, 3, 23, 59)), '2026-01-03');
});

test('mezzi 3040, 5022, 5024 impostano la TIPOLOGIA su India', () => {
  const base = { ...recordVuoto('x', ADESSO), tipologia: 'Mike' };
  assert.equal(impostaCampo(base, 'mezzo', '5022').tipologia, 'India');
  assert.equal(impostaCampo(base, 'mezzo', '3030').tipologia, 'Mike');
});

test('COMUNE e MISSIONE diventano maiuscoli mentre si scrive', () => {
  const r = recordVuoto('x', ADESSO);
  assert.equal(impostaCampo(r, 'comune', 'cavaglià').comune, 'CAVAGLIÀ');
  assert.equal(impostaCampo(r, 'missione', '99zz 0101').missione, '99ZZ0101');
});

test('cambiare ESITO da Trasportato svuota l\'OSPEDALE, che resta nascosto', () => {
  const trasportato = { ...recordVuoto('x', ADESSO), esito: 'Trasportato', ospedale: 'Biella' };
  assert.equal(impostaCampo(trasportato, 'esito', 'Rifiuto Trasporto').ospedale, '');
  assert.equal(impostaCampo(trasportato, 'esito', 'Trasportato').ospedale, 'Biella');
});

test('ETÀ: numero, oppure null se vuota', () => {
  const r = recordVuoto('x', ADESSO);
  assert.equal(impostaCampo(r, 'eta', '87').eta, 87);
  assert.equal(impostaCampo(r, 'eta', '').eta, null);
});

test('"copia da invio" riporta codice, patologia e luogo nel rientro', () => {
  const r = { ...recordVuoto('x', ADESSO), codiceInvio: 'ROSSO', patologiaInvio: '04 - Neuro', luogoInvio: 'K - Casa', codiceRientro: 'VERDE' };
  const c = copiaDaInvio(r);
  assert.deepEqual([c.codiceRientro, c.patologiaRientro, c.luogoRientro], ['ROSSO', '04 - Neuro', 'K - Casa']);
});

test('salvataggio: record normalizzato con updatedAt aggiornato e createdAt invariato', () => {
  const r = { ...recordVuoto('x', ADESSO), comune: ' biella ' };
  const dopo = new Date('2026-10-29T08:00:00.000Z');
  const s = prontoPerSalvare(r, dopo);
  assert.equal(s.comune, 'BIELLA');
  assert.equal(s.updatedAt, '2026-10-29T08:00:00.000Z');
  assert.equal(s.createdAt, ADESSO.toISOString());
});

test('manovre: un tocco accende, un secondo tocco spegne, ordine fisso', () => {
  let r = recordVuoto('x', new Date(2026, 0, 1));
  r = alternaManovra(r, 'VSB');
  r = alternaManovra(r, 'HD');
  assert.deepEqual(r.manovre, ['HD', 'VSB']);
  assert.deepEqual(alternaManovra(r, 'HD').manovre, ['VSB']);
});

test('cambio di mezzo: tra elicotteri i dati di volo restano, verso un\'ambulanza o togliendo il mezzo si svuotano', () => {
  const volo = { ...recordVuoto('x', new Date(2026, 0, 1)), mezzo: 'V-ECHO', tipoMissione: 'HSR', tempoVolo: 50, manovre: ['VD'] };
  for (const elicottero of ['T-ECHO', 'C-ECHO', 'A-ECHO']) {
    const r = impostaCampo(volo, 'mezzo', elicottero);
    assert.deepEqual([r.tipoMissione, r.tempoVolo, r.manovre], ['HSR', 50, ['VD']], elicottero);
  }
  for (const mezzo of ['3030', '']) {
    const r = impostaCampo(volo, 'mezzo', mezzo);
    assert.deepEqual([r.tipoMissione, r.tempoVolo, r.manovre], ['', null, []], mezzo || 'mezzo tolto');
  }
});

test('TEMPO VOLO: numero, null se vuoto, virgola accettata', () => {
  const r = recordVuoto('x', new Date(2026, 0, 1));
  assert.equal(impostaCampo(r, 'tempoVolo', '44').tempoVolo, 44);
  assert.equal(impostaCampo(r, 'tempoVolo', ' ').tempoVolo, null);
  assert.equal(impostaCampo(r, 'tempoVolo', '44,5').tempoVolo, 44.5);
});

test('TEMPO VOLO ed ETÀ scritti come testo restano testo, come nella normalizzazione (mai NaN)', () => {
  const r = recordVuoto('x', new Date(2026, 0, 1));
  assert.equal(impostaCampo(r, 'tempoVolo', '45 min').tempoVolo, '45 min');
  assert.equal(impostaCampo(r, 'tempoVolo', '-').tempoVolo, '-');
  assert.equal(impostaCampo(r, 'eta', 'abc').eta, 'abc');
  assert.equal(impostaCampo(r, 'tempoVolo', '45,').tempoVolo, '45,', 'la virgola in corso di scrittura non sparisce');
});

test('tipologia per mezzo e orario: 3050 Mike di giorno, 6021 Mike di notte', () => {
  assert.deepEqual(['07:59', '08:00', '19:59', '20:00'].map((o) => tipologiaDelMezzo('3050', o)), ['India', 'Mike', 'Mike', 'India']);
  assert.deepEqual(['07:59', '08:00', '19:59', '20:00'].map((o) => tipologiaDelMezzo('6021', o)), ['Mike', 'India', 'India', 'Mike']);
  assert.deepEqual([tipologiaDelMezzo('3050', ''), tipologiaDelMezzo('6021', '25:00'), tipologiaDelMezzo('', '10:00')], ['', '', '']);
  assert.deepEqual(['3040', '5022', '5024'].map((m) => tipologiaDelMezzo(m, '10:00')), ['India', 'India', 'India']);
  assert.deepEqual(['3030', 'V-ECHO', '9999'].map((m) => tipologiaDelMezzo(m, '')), ['Mike', 'Mike', 'Mike']);
});

test('impostaCampo: il mezzo mette la tipologia, l\'ora la ricalcola solo per 3050 e 6021', () => {
  const r = { ...recordVuoto('x', ADESSO), oraAllert: '21:05' };
  assert.equal(impostaCampo(r, 'mezzo', '3050').tipologia, 'India');
  assert.equal(impostaCampo(r, 'mezzo', '3030').tipologia, 'Mike');
  const notte = impostaCampo(r, 'mezzo', '6021');
  assert.equal(notte.tipologia, 'Mike');
  assert.equal(impostaCampo(notte, 'oraAllert', '09:30').tipologia, 'India');
  const aMano = { ...impostaCampo(r, 'mezzo', '3030'), tipologia: 'India' };
  assert.equal(impostaCampo(aMano, 'oraAllert', '09:30').tipologia, 'India', 'scelta a mano non toccata');
  assert.equal(impostaCampo(aMano, 'mezzo', '').tipologia, 'India', 'mezzo svuotato: tipologia com\'era');
  assert.equal(impostaCampo({ ...recordVuoto('y', ADESSO), tipologia: 'Mike' }, 'mezzo', '3050').tipologia, '', '3050 senza ora');
});

// --- Intervento con più pazienti ---

test('pazienti: spunta spenta nel record nuovo, numero, numero cancellato', () => {
  assert.equal(recordVuoto('x', new Date()).pazienti, null);
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', '3').pazienti, 3);
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', '').pazienti, '', 'numero cancellato: la spunta resta accesa');
  assert.equal(impostaCampo(recordVuoto('x', new Date()), 'pazienti', null).pazienti, null);
});

test('collegaScheda: eredita il numero dalla prima scheda con la spunta, lo perde quando la missione cambia', () => {
  const prima = { ...recordVuoto('p1', new Date('2026-01-01T10:00:00Z')), missione: '99ZZ0001', pazienti: 3 };
  const nuova = { ...recordVuoto('n', new Date('2026-01-01T11:00:00Z')), missione: '99ZZ0001' };
  const c = collegaScheda(nuova, [prima], null);
  assert.deepEqual([c.record.pazienti, c.collegataA], [3, 'p1']);
  const vecchia = collegaScheda({ ...nuova, createdAt: '2025-01-01T00:00:00.000Z' }, [prima], null);
  assert.equal(vecchia.collegataA, 'p1', 'una scheda nuova è sempre l\'ultima, anche con un createdAt più vecchio');
  const via = collegaScheda({ ...c.record, missione: '99ZZ0002' }, [prima], 'p1');
  assert.deepEqual([via.record.pazienti, via.collegataA], [null, null]);
  const libera = collegaScheda({ ...nuova, missione: '99ZZ0002', pazienti: 2 }, [prima], null);
  assert.deepEqual([libera.record.pazienti, libera.collegataA], [2, null], 'una spunta messa a mano resta');
  const senzaSpunta = collegaScheda(nuova, [{ ...prima, pazienti: null }], null);
  assert.deepEqual([senzaSpunta.record.pazienti, senzaSpunta.collegataA], [null, null]);
  const laPrima = collegaScheda({ ...prima, pazienti: 4 }, [prima, { ...c.record, createdAt: '2026-01-01T11:00:00.000Z' }], null);
  assert.deepEqual([laPrima.record.pazienti, laPrima.collegataA], [4, null], 'la prima scheda non eredita dalle altre');
});

test('nuovaSchedaPaziente: campi condivisi copiati, campi del paziente vuoti', () => {
  const prima = { ...recordVuoto('p1', new Date('2026-01-01T10:00:00Z')), data: '2026-01-01', oraAllert: '10:00', missione: '99ZZ0001', pazienti: 2,
    comune: 'BIELLA', mezzo: 'V-ECHO', tipologia: 'Mike', codiceInvio: 'ROSSO', patologiaInvio: '01 - Trauma', luogoInvio: 'S - Sierra',
    eta: 40, sesso: 'Maschio', esito: 'Trasportato', ospedale: 'Biella', codiceRientro: 'GIALLO', patologiaRientro: '01 - Trauma',
    luogoRientro: 'S - Sierra', liberoOperativo: '11:30', tipoMissione: 'HEMS', tempoVolo: 35, manovre: ['VD'] };
  const n = nuovaSchedaPaziente(prima, 'n', new Date('2026-01-02T08:00:00Z'));
  assert.equal(n.id, 'n');
  assert.deepEqual([n.data, n.oraAllert, n.missione, n.pazienti, n.comune, n.mezzo, n.tipologia, n.codiceInvio, n.patologiaInvio, n.luogoInvio, n.liberoOperativo, n.tipoMissione, n.tempoVolo],
    ['2026-01-01', '10:00', '99ZZ0001', 2, 'BIELLA', 'V-ECHO', 'Mike', 'ROSSO', '01 - Trauma', 'S - Sierra', '11:30', 'HEMS', 35]);
  assert.deepEqual([n.eta, n.sesso, n.esito, n.ospedale, n.codiceRientro, n.patologiaRientro, n.luogoRientro, n.manovre], [null, '', '', '', '', '', '', []]);
  assert.equal(n.createdAt, '2026-01-02T08:00:00.000Z');
});

test('salvataggio di una scheda nuova: createdAt diventa l\'istante del salvataggio', () => {
  const r = recordVuoto('x', new Date('2026-01-01T08:00:00.000Z'));
  const adesso = new Date('2026-01-01T09:30:00.000Z');
  assert.equal(prontoPerSalvare(r, adesso, { nuovo: true }).createdAt, '2026-01-01T09:30:00.000Z');
  assert.equal(prontoPerSalvare(r, adesso).createdAt, '2026-01-01T08:00:00.000Z');
});

test('bozzaConDati: la bozza che il modulo lascia da solo (solo la data di oggi) non conta', () => {
  const vuota = recordVuoto('x', new Date());
  assert.equal(bozzaConDati(vuota), false);
  assert.equal(bozzaConDati(null), false);
  assert.equal(bozzaConDati({ ...vuota, missione: '99ZZ0001' }), true);
  assert.equal(bozzaConDati({ ...vuota, eta: 30 }), true);
  assert.equal(bozzaConDati({ ...vuota, manovre: ['VD'] }), true);
});

test('collegaScheda: una scheda salvata più vecchia che prende la MISSIONE di un gruppo collegato ne eredita il numero', () => {
  const a = { ...recordVuoto('a', new Date('2026-01-01T09:00:00Z')), missione: '99ZZ0010' };
  const b = { ...recordVuoto('b', new Date('2026-01-01T10:00:00Z')), missione: '99ZZ0001', pazienti: 3 };
  const c = collegaScheda({ ...a, missione: '99ZZ0001' }, [a, b], null);
  assert.deepEqual([c.record.pazienti, c.collegataA], [3, 'b']);
});
