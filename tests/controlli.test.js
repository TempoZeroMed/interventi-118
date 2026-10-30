import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avvisi, indiceMissioni, verificaSalvataggio } from '../js/core/controlli.js';

function rec(campi = {}) {
  return {
    id: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
    data: '2026-01-01', oraAllert: '10:12', missione: '99ZZ0101', comune: 'COSSATO', mezzo: '3080',
    tipologia: 'Mike', codiceInvio: 'GIALLO', patologiaInvio: '02 - Cardio', luogoInvio: 'K - Casa',
    eta: 72, sesso: 'Femmina', esito: 'Non Necessita', ospedale: '', codiceRientro: 'VERDE',
    patologiaRientro: '02 - Cardio', luogoRientro: 'K - Casa', liberoOperativo: '10:51',
    ...campi,
  };
}

function avvisiDi(r, altri = []) {
  return avvisi(r, indiceMissioni([r, ...altri]));
}

test('record corretto: nessun avviso', () => {
  assert.deepEqual(avvisiDi(rec()), []);
});

test('campi vuoti non generano avvisi di formato', () => {
  assert.deepEqual(avvisiDi(rec({ oraAllert: '', liberoOperativo: '', data: '', eta: null })), []);
});

test('ore non valide', () => {
  assert.deepEqual(avvisiDi(rec({ oraAllert: '25:00' })), ['Ora allert. non valida']);
  assert.deepEqual(avvisiDi(rec({ liberoOperativo: 'abc' })), ['Libero operativo non valido']);
});

test('data non valida', () => {
  assert.deepEqual(avvisiDi(rec({ data: '2026-13-01' })), ['Data non valida']);
  assert.deepEqual(avvisiDi(rec({ data: '31/01/2026' })), ['Data non valida']);
});

test('missione diversa da 8 caratteri', () => {
  assert.deepEqual(avvisiDi(rec({ missione: '99ZE' })), ['Missione non di 8 caratteri']);
  assert.deepEqual(avvisiDi(rec({ missione: '99Z5633' })), ['Missione non di 8 caratteri']);
});

test('missione duplicata: avviso su entrambe le righe', () => {
  const r1 = rec({ id: 'a' });
  const r2 = rec({ id: 'b', oraAllert: '10:27' });
  const indice = indiceMissioni([r1, r2]);
  assert.deepEqual(avvisi(r1, indice), ['Missione duplicata']);
  assert.deepEqual(avvisi(r2, indice), ['Missione duplicata']);
});

test('un record eliminato non conta come duplicato', () => {
  const r1 = rec({ id: 'a' });
  const r2 = rec({ id: 'b', deleted: true });
  assert.deepEqual(avvisi(r1, indiceMissioni([r1, r2])), []);
});

test('mezzi 3040, 5022, 5024 con tipologia Mike', () => {
  for (const mezzo of ['3040', '5022', '5024']) {
    assert.deepEqual(avvisiDi(rec({ mezzo, tipologia: 'Mike' })), ['Mezzo solo India'], mezzo);
    assert.deepEqual(avvisiDi(rec({ mezzo, tipologia: 'India' })), [], mezzo);
  }
  assert.deepEqual(avvisiDi(rec({ mezzo: '3030', tipologia: 'Mike' })), []);
});

test('ospedale compilato con esito diverso da Trasportato', () => {
  assert.deepEqual(avvisiDi(rec({ ospedale: 'Biella', esito: 'Non Necessita' })), ['Ospedale senza trasporto']);
  assert.deepEqual(avvisiDi(rec({ ospedale: 'Biella', esito: 'Trasportato' })), []);
});

test('età non intera o negativa', () => {
  assert.deepEqual(avvisiDi(rec({ eta: -1 })), ['Età non valida']);
  assert.deepEqual(avvisiDi(rec({ eta: 12.5 })), ['Età non valida']);
  assert.deepEqual(avvisiDi(rec({ eta: 'dodici' })), ['Età non valida']);
  assert.deepEqual(avvisiDi(rec({ eta: 0 })), []);
});

test('più avvisi sulla stessa riga, nell\'ordine della colonna CONTROLLI', () => {
  assert.deepEqual(
    avvisiDi(rec({ data: 'x', missione: '99ZE', mezzo: '5022', tipologia: 'Mike' })),
    ['Data non valida', 'Missione non di 8 caratteri', 'Mezzo solo India'],
  );
});

test('salvataggio: serve almeno DATA o MISSIONE', () => {
  const esito = verificaSalvataggio(rec({ data: '', missione: '' }), []);
  assert.equal(esito.ok, false);
  assert.match(esito.errori[0], /DATA o MISSIONE/);
  assert.equal(verificaSalvataggio(rec({ data: '' }), []).ok, true);
  assert.equal(verificaSalvataggio(rec({ missione: '' }), []).ok, true);
});

test('salvataggio: nuovo intervento con MISSIONE già usata è bloccato e indica il duplicato', () => {
  const esistente = rec({ id: 'x' });
  const nuovo = rec({ id: 'y' });
  const esito = verificaSalvataggio(nuovo, [esistente]);
  assert.equal(esito.ok, false);
  assert.equal(esito.duplicatoDi, 'x');
});

test('salvataggio: il confronto delle missioni ignora maiuscole e spazi', () => {
  const esito = verificaSalvataggio(rec({ id: 'y', missione: ' 99zz0101 ' }), [rec({ id: 'x' })]);
  assert.equal(esito.ok, false);
  assert.equal(esito.duplicatoDi, 'x');
});

test('salvataggio: modificare un duplicato già esistente senza cambiare MISSIONE è permesso', () => {
  const a = rec({ id: 'a' });
  const b = rec({ id: 'b', oraAllert: '10:27' });
  const modificato = { ...b, comune: 'GAGLIANICO' };
  assert.equal(verificaSalvataggio(modificato, [a, b], b).ok, true);
});

test('salvataggio: cambiare MISSIONE portandola su un valore usato è bloccato', () => {
  const a = rec({ id: 'a' });
  const b = rec({ id: 'b', missione: '04AA0999' });
  const esito = verificaSalvataggio({ ...b, missione: '99ZZ0101' }, [a, b], b);
  assert.equal(esito.ok, false);
  assert.equal(esito.duplicatoDi, 'a');
});

test('salvataggio: una MISSIONE di un record eliminato si può riusare', () => {
  const eliminato = rec({ id: 'x', deleted: true });
  assert.equal(verificaSalvataggio(rec({ id: 'y' }), [eliminato]).ok, true);
});

test('volo: tipo missione e tempo mancanti solo per gli elicotteri, anche su record senza i campi nuovi', () => {
  for (const mezzo of ['V-ECHO', 'T-ECHO', 'C-ECHO', 'A-ECHO']) {
    assert.deepEqual(avvisiDi(rec({ mezzo })), ['Tipo missione mancante', 'Tempo volo mancante'], mezzo);
  }
  assert.deepEqual(avvisiDi(rec({ mezzo: '3030', tipoMissione: '', tempoVolo: null, manovre: [] })), []);
});

test('volo: tempo non valido se non intero o fuori da 0–600', () => {
  const con = (tempoVolo) => avvisiDi(rec({ mezzo: 'T-ECHO', tipoMissione: 'HEMS', tempoVolo }));
  for (const buono of [0, 44, 600]) assert.deepEqual(con(buono), [], String(buono));
  for (const cattivo of [-1, 601, 44.5, '45 min']) assert.deepEqual(con(cattivo), ['Tempo volo non valido'], String(cattivo));
});
