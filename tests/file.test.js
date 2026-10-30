import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salvaFile, salvaConFinestra } from '../js/ui/file.js';

const BLOB = new Blob(['{"a":1}'], { type: 'application/json' });

/** File finto come quelli della File System Access API: raccoglie ciò che viene scritto. */
function fileFinto({ permesso = 'granted', errore = null } = {}) {
  const scritti = [];
  return {
    scritti,
    chiusi: 0,
    async requestPermission() { return permesso; },
    async createWritable() {
      if (errore) throw errore;
      return { write: async (b) => { scritti.push(b); }, close: async () => { this.chiusi += 1; } };
    },
  };
}

/** Finestra di salvataggio finta: registra le chiamate e restituisce il file indicato (o lancia). */
function finestraFinta(risposta) {
  const chiamate = [];
  const finestra = async (opzioni) => {
    chiamate.push(opzioni);
    if (risposta instanceof Error) throw risposta;
    return risposta;
  };
  return { finestra, chiamate };
}

const annullato = () => Object.assign(new Error('chiusa'), { name: 'AbortError' });

test('senza finestra di salvataggio scarica come oggi', async () => {
  const cliccati = [];
  globalThis.document = {
    createElement: () => ({ click() { cliccati.push(this); }, remove() {} }),
    body: { append() {} },
  };
  try {
    assert.equal(await salvaFile(BLOB, 'interventi118_Mac.json'), 'scaricato');
    assert.equal(cliccati.length, 1);
    assert.equal(cliccati[0].download, 'interventi118_Mac.json');
  } finally {
    delete globalThis.document;
  }
});

test('con file ricordato e permesso concesso riscrive senza aprire la finestra', async () => {
  const ricordato = fileFinto();
  const { finestra, chiamate } = finestraFinta(fileFinto());
  const ricordi = [];
  const esito = await salvaConFinestra(BLOB, 'interventi118_Mac.json', { ricordato, ricorda: async (f) => ricordi.push(f), finestra });
  assert.equal(esito, 'salvato');
  assert.equal(chiamate.length, 0);
  assert.deepEqual(ricordato.scritti, [BLOB]);
  assert.equal(ricordato.chiusi, 1);
  assert.equal(ricordi.length, 0);
});

test('file ricordato che non esiste più: riapre la finestra e ricorda il nuovo', async () => {
  const ricordato = fileFinto({ errore: Object.assign(new Error('sparito'), { name: 'NotFoundError' }) });
  const nuovo = fileFinto();
  const { finestra, chiamate } = finestraFinta(nuovo);
  const ricordi = [];
  const esito = await salvaConFinestra(BLOB, 'interventi118_Mac.json', { ricordato, ricorda: async (f) => ricordi.push(f), finestra });
  assert.equal(esito, 'salvato');
  assert.equal(chiamate.length, 1);
  assert.equal(chiamate[0].suggestedName, 'interventi118_Mac.json');
  assert.deepEqual(chiamate[0].types, [{ description: 'interventi118_Mac.json', accept: { 'application/json': ['.json'] } }]);
  assert.deepEqual(nuovo.scritti, [BLOB]);
  assert.deepEqual(ricordi, [nuovo]);
});

test('permesso negato sul file ricordato: riapre la finestra', async () => {
  const ricordato = fileFinto({ permesso: 'denied' });
  const nuovo = fileFinto();
  const { finestra, chiamate } = finestraFinta(nuovo);
  const esito = await salvaConFinestra(BLOB, 'interventi118_Mac.json', { ricordato, ricorda: async () => {}, finestra });
  assert.equal(esito, 'salvato');
  assert.equal(chiamate.length, 1);
  assert.deepEqual(ricordato.scritti, []);
  assert.deepEqual(nuovo.scritti, [BLOB]);
});

test('finestra chiusa senza salvare: annullato e niente ricordo', async () => {
  const { finestra } = finestraFinta(annullato());
  const ricordi = [];
  const esito = await salvaConFinestra(BLOB, 'interventi118_Mac.json', { ricordato: null, ricorda: async (f) => ricordi.push(f), finestra });
  assert.equal(esito, 'annullato');
  assert.equal(ricordi.length, 0);
});

test('senza chiave di ricordo non salva il riferimento', async () => {
  const nuovo = fileFinto();
  const { finestra, chiamate } = finestraFinta(nuovo);
  const esito = await salvaConFinestra(BLOB, 'interventi118_2026-10-30_2210.json', { ricordato: null, ricorda: null, finestra });
  assert.equal(esito, 'salvato');
  assert.equal(chiamate.length, 1);
  assert.deepEqual(nuovo.scritti, [BLOB]);
});
