import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggiungiVoce, rinominaVoce, impostaAttiva, vociPerScelta } from '../js/core/liste.js';
import { LISTE_PREDEFINITE } from '../js/core/campi.js';

const ADESSO = new Date('2026-10-29T10:00:00.000Z');
const rec = (id, campi) => ({ id, updatedAt: '2026-01-01T00:00:00.000Z', deleted: false, ...campi });

test('aggiungere una voce: in fondo alla lista, attiva, con id dal nome', () => {
  const liste = aggiungiVoce(LISTE_PREDEFINITE, 'ospedale', '  Aosta ', ADESSO);
  assert.deepEqual(liste.ospedale.at(-1), {
    id: 'ospedale-aosta', voce: 'Aosta', attiva: true, sistema: false, updatedAt: ADESSO.toISOString(),
  });
  assert.equal(LISTE_PREDEFINITE.ospedale.at(-1).voce, 'Verduno', 'la lista originale non cambia');
});

test('aggiungere una voce vuota o già presente (anche con maiuscole diverse) è rifiutato', () => {
  assert.throws(() => aggiungiVoce(LISTE_PREDEFINITE, 'ospedale', '  ', ADESSO), /nome della voce/);
  assert.throws(() => aggiungiVoce(LISTE_PREDEFINITE, 'ospedale', 'biella', ADESSO), /esiste già/);
});

test('aggiungere una voce il cui id è già usato da una voce rinominata: id reso unico', () => {
  const rinominata = rinominaVoce(LISTE_PREDEFINITE, [], 'ospedale', 'ospedale-asti', 'Asti Cardinal Massaia', ADESSO).liste;
  const liste = aggiungiVoce(rinominata, 'ospedale', 'Asti', ADESSO);
  assert.equal(liste.ospedale.at(-1).id, 'ospedale-asti-2');
});

test('rinominare una voce aggiorna i record che la usano, invio e rientro, e solo quelli', () => {
  const records = [
    rec('a', { patologiaInvio: '09 - Gastro', patologiaRientro: '19 - Altro' }),
    rec('b', { patologiaInvio: '02 - Cardio', patologiaRientro: '09 - Gastro' }),
    rec('c', { patologiaInvio: '02 - Cardio', patologiaRientro: '02 - Cardio' }),
    rec('d', { patologiaInvio: '09 - Gastro', deleted: true }),
  ];
  const { liste, modificati } = rinominaVoce(LISTE_PREDEFINITE, records, 'patologia', 'patologia-09-gastro', '09 - Gastroenterica', ADESSO);
  assert.equal(liste.patologia.find((v) => v.id === 'patologia-09-gastro').voce, '09 - Gastroenterica');
  assert.deepEqual(modificati.map((r) => [r.id, r.patologiaInvio, r.patologiaRientro, r.updatedAt]), [
    ['a', '09 - Gastroenterica', '19 - Altro', ADESSO.toISOString()],
    ['b', '02 - Cardio', '09 - Gastroenterica', ADESSO.toISOString()],
  ]);
});

test('le voci di sistema non si rinominano né si disattivano', () => {
  assert.throws(() => rinominaVoce(LISTE_PREDEFINITE, [], 'esito', 'esito-trasportato', 'Trasporto', ADESSO), /non si può/);
  assert.throws(() => impostaAttiva(LISTE_PREDEFINITE, 'mezzo', 'mezzo-3040', false, ADESSO), /non si può/);
});

test('rinominare con un nome già usato da un\'altra voce è rifiutato', () => {
  assert.throws(() => rinominaVoce(LISTE_PREDEFINITE, [], 'ospedale', 'ospedale-asti', 'Biella', ADESSO), /esiste già/);
});

test('disattivare e riattivare una voce', () => {
  const spenta = impostaAttiva(LISTE_PREDEFINITE, 'ospedale', 'ospedale-asti', false, ADESSO);
  assert.equal(spenta.ospedale.find((v) => v.id === 'ospedale-asti').attiva, false);
  const accesa = impostaAttiva(spenta, 'ospedale', 'ospedale-asti', true, ADESSO);
  assert.equal(accesa.ospedale.find((v) => v.id === 'ospedale-asti').attiva, true);
});

test('voci proposte nel form: solo le attive, più il valore già salvato se non è tra queste', () => {
  const lista = impostaAttiva(LISTE_PREDEFINITE, 'sesso', 'sesso-femmina', true, ADESSO).sesso;
  assert.deepEqual(vociPerScelta(lista, ''), ['Maschio', 'Femmina']);
  const ospedali = impostaAttiva(LISTE_PREDEFINITE, 'ospedale', 'ospedale-asti', false, ADESSO).ospedale;
  assert.equal(vociPerScelta(ospedali, '').includes('Asti'), false);
  assert.equal(vociPerScelta(ospedali, 'Asti').includes('Asti'), true);
  assert.equal(vociPerScelta(ospedali, 'Ospedale Vecchio').at(-1), 'Ospedale Vecchio');
});
