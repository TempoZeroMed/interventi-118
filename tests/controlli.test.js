import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avvisi, indiceMissioni, verificaSalvataggio, TIPI_AVVISO } from '../js/core/controlli.js';

function rec(campi = {}) {
  return {
    id: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
    data: '2026-01-01', oraAllert: '10:12', missione: '99ZZ0101', pazienti: null, comune: 'COSSATO', mezzo: '3080',
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

// --- Intervento con più pazienti ---

const T1 = '2026-01-01T00:05:00.000Z';
const gruppo = (n, pazienti, extra = []) => [
  rec({ id: 'p1', pazienti }),
  ...Array.from({ length: n - 1 }, (_, i) => rec({ id: `p${i + 2}`, createdAt: T1, pazienti, ...(extra[i] ?? {}) })),
];

test('gruppo collegato: nessun duplicato; numero di schede confrontato con i pazienti dichiarati', () => {
  const ok = gruppo(2, 2);
  assert.deepEqual(avvisi(ok[0], indiceMissioni(ok)), []);
  assert.deepEqual(avvisi(ok[1], indiceMissioni(ok)), []);
  const troppe = gruppo(3, 2);
  assert.deepEqual(avvisi(troppe[2], indiceMissioni(troppe)), ['Schede in più rispetto ai pazienti']);
  const poche = gruppo(1, 3);
  assert.deepEqual(avvisi(poche[0], indiceMissioni(poche)), ['Mancano schede paziente']);
});

test('gruppo non collegato (prima scheda senza spunta): Missione duplicata anche se la seconda ha la spunta', () => {
  const r = [rec({ id: 'p1' }), rec({ id: 'p2', createdAt: T1, pazienti: 2 })];
  assert.deepEqual(avvisi(r[0], indiceMissioni(r)), ['Missione duplicata']);
  assert.deepEqual(avvisi(r[1], indiceMissioni(r)), ['Missione duplicata']);
});

test('numero pazienti non valido, diverso tra le schede, tempo di volo diverso', () => {
  assert.deepEqual(avvisiDi(rec({ pazienti: 1 })), ['Numero pazienti non valido']);
  assert.deepEqual(avvisiDi(rec({ pazienti: 'due' })), ['Numero pazienti non valido']);
  assert.deepEqual(avvisiDi(rec({ pazienti: '' })), [], 'numero cancellato: lo blocca il salvataggio, non un avviso');
  const r = gruppo(2, 2, [{ pazienti: null }]);
  assert.deepEqual(avvisi(r[1], indiceMissioni(r)), ['Numero pazienti diverso tra le schede']);
  const v = gruppo(2, 2, [{ tempoVolo: 30 }]).map((x) => ({ ...x, mezzo: 'V-ECHO', tipoMissione: 'HEMS', tempoVolo: x.tempoVolo ?? 25 }));
  assert.deepEqual(avvisi(v[1], indiceMissioni(v)), ['Tempo volo diverso tra le schede']);
  assert.deepEqual(avvisi(v[0], indiceMissioni(v)), []);
});

test('prima scheda eliminata: la seconda diventa prima e il gruppo segue la sua spunta', () => {
  const r = [rec({ id: 'p1', deleted: true, pazienti: 2 }), rec({ id: 'p2', createdAt: T1, pazienti: 2 }), rec({ id: 'p3', createdAt: T1, pazienti: null })];
  assert.deepEqual(avvisi(r[2], indiceMissioni(r)), ['Numero pazienti diverso tra le schede']);
});

test('salvataggio: scheda nuova con la missione di una prima scheda con la spunta si collega', () => {
  const prima = rec({ id: 'p1', pazienti: 2 });
  // una scheda nuova è sempre l'ultima del gruppo, anche con un createdAt più vecchio (bozza lasciata a metà)
  const v = verificaSalvataggio(rec({ id: 'n', createdAt: '2025-12-31T00:00:00.000Z', pazienti: null }), [prima]);
  assert.deepEqual([v.ok, v.collegataA, v.duplicatoDi], [true, 'p1', null]);
});

test('salvataggio: senza spunta sulla prima scheda resta l\'errore, con la frase sul paziente multiplo', () => {
  const v = verificaSalvataggio(rec({ id: 'n' }), [rec({ id: 'p1' })]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.errori, ['La MISSIONE 99ZZ0101 è già registrata.', 'Se è un altro paziente dello stesso intervento, apri la prima scheda e attiva Paziente multiplo.']);
  assert.equal(v.duplicatoDi, 'p1');
});

test('prima scheda collegata: MISSIONE e spunta bloccate; libera se è l\'unica', () => {
  const prima = rec({ id: 'p1', pazienti: 2 });
  const seconda = rec({ id: 'p2', createdAt: T1, pazienti: 2 });
  const cambioMissione = verificaSalvataggio({ ...prima, missione: '99ZZ0102' }, [prima, seconda], prima);
  assert.deepEqual([cambioMissione.ok, cambioMissione.bloccata, cambioMissione.errori], [false, 1, ['Questa scheda è collegata a 1 altra scheda: la MISSIONE non si può cambiare.']]);
  const toltaSpunta = verificaSalvataggio({ ...prima, pazienti: null }, [prima, seconda], prima);
  assert.deepEqual([toltaSpunta.ok, toltaSpunta.errori], [false, ['Questa scheda è collegata a 1 altra scheda: Paziente multiplo resta attivo.']]);
  assert.equal(verificaSalvataggio({ ...prima, pazienti: null }, [prima], prima).ok, true);
  const collegata = verificaSalvataggio({ ...seconda, missione: '99ZZ0102', pazienti: null }, [prima, seconda], seconda);
  assert.equal(collegata.ok, true, 'la scheda collegata cambia MISSIONE liberamente');
  assert.equal(verificaSalvataggio(seconda, [prima, seconda], seconda).collegataA, 'p1');
  assert.equal(verificaSalvataggio(prima, [prima, seconda], prima).collegataA, null, 'la prima scheda non è collegata a nessuno');
});

test('salvataggio: spunta accesa senza numero si blocca, un numero non valido si salva con l\'avviso', () => {
  const vuoto = verificaSalvataggio(rec({ id: 'n', pazienti: '' }), []);
  assert.deepEqual([vuoto.ok, vuoto.errori], [false, ['Scrivi il numero di pazienti, oppure togli Paziente multiplo.']]);
  assert.equal(verificaSalvataggio(rec({ id: 'n', pazienti: 1 }), []).ok, true);
});

test('TIPI_AVVISO nell\'ordine della colonna CONTROLLI', () => {
  assert.deepEqual(TIPI_AVVISO.slice(4, 9), ['Missione duplicata', 'Numero pazienti non valido', 'Schede in più rispetto ai pazienti', 'Mancano schede paziente', 'Numero pazienti diverso tra le schede']);
  assert.equal(TIPI_AVVISO.at(-1), 'Tempo volo diverso tra le schede');
});

test('salvataggio: una scheda già salvata e più vecchia che corregge la MISSIONE entra nel gruppo collegato', () => {
  // A salvata per prima con un refuso nella MISSIONE; B (con la spunta) e C sono l'intervento giusto
  const a = rec({ id: 'a', createdAt: '2025-12-31T09:00:00.000Z', missione: '99ZZ0010' });
  const b = rec({ id: 'b', pazienti: 3 });
  const c = rec({ id: 'c', createdAt: T1, pazienti: 3 });
  const v = verificaSalvataggio({ ...a, missione: '99ZZ0101', pazienti: 3 }, [a, b, c], a);
  assert.deepEqual([v.ok, v.collegataA, v.duplicatoDi, v.errori], [true, 'b', null, []]);
});
