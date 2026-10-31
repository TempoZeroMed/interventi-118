import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filtraElenco, ordinaRecenti, suggerimentiComuni, piuUsate, etichettaPaziente, conteggioInterventi,
} from '../js/core/elenco.js';
import { indiceMissioni } from '../js/core/controlli.js';

const VUOTO = {
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
  data: '', oraAllert: '', missione: '', pazienti: null, comune: '', mezzo: '', tipologia: '', codiceInvio: '', patologiaInvio: '',
  luogoInvio: '', eta: null, sesso: '', esito: '', ospedale: '', codiceRientro: '', patologiaRientro: '',
  luogoRientro: '', liberoOperativo: '',
};
const r = (campi) => ({ ...VUOTO, ...campi });

const RECORD = [
  r({ id: 'a', data: '2026-03-01', oraAllert: '08:00', missione: '04AA0001', comune: 'BIELLA', mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'GIALLO', codiceRientro: 'ROSSO', patologiaInvio: '02 - Cardio', esito: 'Trasportato', ospedale: 'Biella' }),
  r({ id: 'b', data: '2026-03-01', oraAllert: '21:15', missione: '04AA0002', comune: 'CANDELO', mezzo: '5022', tipologia: 'India',
    codiceInvio: 'ROSSO', codiceRientro: 'NERO', patologiaRientro: '02 - Cardio', esito: 'Deceduto' }),
  r({ id: 'c', data: '2026-04-12', oraAllert: '10:00', missione: '99ZE', comune: 'BIELLA', mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'VERDE', esito: 'Non Necessita' }),
  r({ id: 'd', missione: '04AA0004', comune: 'NOVARA', createdAt: '2026-05-01T00:00:00.000Z' }),
  r({ id: 'e', data: '2026-04-20', missione: '04AA0005', comune: 'BIELLA', deleted: true }),
];
const ids = (elenco) => elenco.map((x) => x.id);

test('senza filtri: tutti gli interventi non eliminati', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, {})).sort(), ['a', 'b', 'c', 'd']);
});

test('ricerca per missione o comune, senza badare alle maiuscole', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, { testo: 'cand' })), ['b']);
  assert.deepEqual(ids(filtraElenco(RECORD, { testo: '0004' })), ['d']);
  assert.deepEqual(ids(filtraElenco(RECORD, { testo: ' biella ' })).sort(), ['a', 'c']);
});

test('filtri combinabili su mezzo, tipologia, codici ed esito', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, { mezzo: '3030', codiceInvio: 'VERDE' })), ['c']);
  assert.deepEqual(ids(filtraElenco(RECORD, { tipologia: 'India' })), ['b']);
  assert.deepEqual(ids(filtraElenco(RECORD, { codiceRientro: 'ROSSO', esito: 'Trasportato', ospedale: 'Biella' })), ['a']);
});

test('filtro patologia: vale sia per l\'invio sia per il rientro', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, { patologia: '02 - Cardio' })).sort(), ['a', 'b']);
});

test('filtro periodo: come nelle statistiche, le righe senza data restano solo in "tutto"', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, { periodo: { tipo: 'mese', anno: 2026, mese: 3 } })).sort(), ['a', 'b']);
  assert.deepEqual(ids(filtraElenco(RECORD, { periodo: { tipo: 'tutto' } })).sort(), ['a', 'b', 'c', 'd']);
});

test('solo righe con avvisi', () => {
  assert.deepEqual(ids(filtraElenco(RECORD, { soloAvvisi: true })), ['c']);
});

test('ordine: dal più recente, a parità di data per ora; le righe senza data in fondo', () => {
  assert.deepEqual(ids(ordinaRecenti(filtraElenco(RECORD, {}))), ['c', 'b', 'a', 'd']);
});

test('suggerimenti per COMUNE: dal più usato, poi in ordine alfabetico, senza eliminati', () => {
  assert.deepEqual(suggerimentiComuni(RECORD), ['BIELLA', 'CANDELO', 'NOVARA']);
});

test('voci più usate per le scorciatoie del form', () => {
  assert.deepEqual(piuUsate(RECORD, ['mezzo'], 2), ['3030', '5022']);
  assert.deepEqual(piuUsate(RECORD, ['patologiaInvio', 'patologiaRientro'], 3), ['02 - Cardio']);
});

// --- Intervento con più pazienti ---

test('etichetta "Paziente n di N" solo nei gruppi collegati, nell\'ordine della prima scheda', () => {
  const g = [r({ id: 'b', createdAt: '2026-01-01T10:05:00.000Z', missione: '99ZZ0001', pazienti: 3 }), r({ id: 'a', missione: '99ZZ0001', pazienti: 3 }), r({ id: 'c', missione: '99ZZ0002' })];
  const indice = indiceMissioni(g);
  assert.deepEqual(g.map((x) => etichettaPaziente(x, indice)), ['Paziente 2 di 3', 'Paziente 1 di 3', '']);
  const dup = [r({ id: 'a', missione: '99ZZ0001' }), r({ id: 'b', missione: '99ZZ0001' })];
  assert.equal(etichettaPaziente(dup[0], indiceMissioni(dup)), '');
  assert.deepEqual(conteggioInterventi(g), { interventi: 2, schede: 3 });
});
