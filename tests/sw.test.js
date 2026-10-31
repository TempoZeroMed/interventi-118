// Il service worker eseguito davvero (node:vm) con cache, rete e WebAssembly finti.
// I controlli sul testo di tests/pwa.test.js non dicono se il codice fa quello che c'è scritto (vale anche un commento).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SORGENTE = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const BASE = 'https://esempio.test/';
const VERSIONE = 'interventi118-v1.5.0';
const LETTORE = 'lettore-testo-7.0.0';
const CARTELLA = 'vendor/tesseract-7.0.0/';
const FILE_LETTORE = ['tesseract.min.js', 'worker.min.js', 'ita.traineddata.gz'].map((f) => CARTELLA + f);

// Le prove di wasm-feature-detect 1.9.0, copiate qui e non lette da sw.js: un errore di battitura in sw.js deve vedersi.
// Il WebAssembly finto riconosce le prove dal contenuto, non dall'ordine delle chiamate.
const RELAXED_SIMD = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11].join(',');
const SIMD = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11].join(',');

const COMBINAZIONI = [
  ['relaxed SIMD e SIMD', [RELAXED_SIMD, SIMD], 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['solo SIMD', [SIMD], 'tesseract-core-simd-lstm.wasm.js'],
  ['nessuna delle due', [], 'tesseract-core-lstm.wasm.js'],
];

const href = (percorso) => new URL(percorso, BASE).href;
const delLettore = (url) => url.includes('/vendor/tesseract-');
const attendi = () => new Promise((risolvi) => setImmediate(risolvi));

/**
 * Carica sw.js in un contesto isolato. `cacheIniziali`: { nomeCache: [percorsi] }; `supportate`: le prove che
 * WebAssembly.validate riconosce; `rifiuta(url)`: true se la rete finta deve fallire per quell'indirizzo.
 */
function creaAmbiente({ cacheIniziali = {}, supportate = [RELAXED_SIMD, SIMD], rifiuta = () => false } = {}) {
  const magazzino = new Map(); // nome della cache -> Map(indirizzo -> risposta)
  const eliminate = [];
  const rete = []; // le richieste arrivate alla rete finta
  const ascoltatori = {};
  const chiamate = { skipWaiting: 0, claim: 0 };
  const indirizzo = (richiesta) => new URL(richiesta.url ?? richiesta, BASE).href;
  const senzaRicerca = (url) => Object.assign(new URL(url), { search: '' }).href;

  async function fetchFinto(richiesta) {
    const url = indirizzo(richiesta);
    rete.push({ url, cache: richiesta.cache });
    if (rifiuta(url)) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, url, clone() { return this; } };
  }

  function apri(nome) {
    if (!magazzino.has(nome)) magazzino.set(nome, new Map());
    const voci = magazzino.get(nome);
    const cache = {
      async match(richiesta, { ignoreSearch = false } = {}) {
        const normale = ignoreSearch ? senzaRicerca : (url) => url;
        for (const [url, risposta] of voci) if (normale(url) === normale(indirizzo(richiesta))) return risposta;
        return undefined;
      },
      async put(richiesta, risposta) { voci.set(indirizzo(richiesta), risposta); },
      async add(richiesta) { await cache.addAll([richiesta]); },
      async addAll(richieste) { // come quello vero: se una richiesta fallisce, non si salva niente
        const risposte = await Promise.all(richieste.map(fetchFinto));
        if (risposte.some((r) => !r.ok)) throw new TypeError('Risposta non valida');
        richieste.forEach((r, i) => voci.set(indirizzo(r), risposte[i]));
      },
      async keys() { return [...voci.keys()].map((url) => ({ url })); },
    };
    return cache;
  }

  for (const [nome, percorsi] of Object.entries(cacheIniziali)) {
    apri(nome);
    for (const p of percorsi) magazzino.get(nome).set(href(p), { ok: true, status: 200, url: href(p), clone() { return this; } });
  }

  const sandbox = {
    self: {
      location: { origin: new URL(BASE).origin },
      addEventListener: (tipo, funzione) => { ascoltatori[tipo] = funzione; },
      skipWaiting: async () => { chiamate.skipWaiting += 1; },
      clients: { claim: async () => { chiamate.claim += 1; } },
    },
    caches: {
      open: async (nome) => apri(nome),
      keys: async () => [...magazzino.keys()],
      delete: async (nome) => { eliminate.push(nome); return magazzino.delete(nome); },
    },
    fetch: fetchFinto,
    Request: class { constructor(url, { cache } = {}) { this.url = href(url); this.cache = cache; this.method = 'GET'; } },
    URL,
    WebAssembly: { validate: (byte) => supportate.includes(Array.from(byte).join(',')) },
  };
  vm.createContext(sandbox);
  vm.runInContext(SORGENTE, sandbox, { filename: 'sw.js' });

  return {
    rete, eliminate, chiamate,
    variante: () => vm.runInContext('varianteCore()', sandbox),
    file: () => Array.from(vm.runInContext('FILE', sandbox)),
    nomiCache: () => [...magazzino.keys()],
    contenuto: (nome) => [...(magazzino.get(nome)?.keys() ?? [])],
    reteDelLettore: () => rete.filter((r) => delLettore(r.url)),
    async install() {
      assert.ok(ascoltatori.install, 'sw.js non ascolta install');
      const attese = [];
      ascoltatori.install({ waitUntil: (p) => attese.push(p) });
      await Promise.all(attese);
    },
    async attiva() {
      assert.ok(ascoltatori.activate, 'sw.js non ascolta activate');
      const attese = [];
      ascoltatori.activate({ waitUntil: (p) => attese.push(p) });
      await Promise.all(attese);
    },
    async richiedi(url) {
      assert.ok(ascoltatori.fetch, 'sw.js non ascolta fetch');
      let risposta;
      ascoltatori.fetch({ request: { method: 'GET', url, mode: 'cors' }, respondWith: (p) => { risposta = p; } });
      assert.ok(risposta, `sw.js non risponde a ${url}`);
      const esito = await risposta;
      await attendi(); // il salvataggio in cache non è atteso dal service worker
      return esito;
    },
  };
}

for (const [nome, supportate, atteso] of COMBINAZIONI) {
  test(`varianteCore sceglie ${atteso} quando il dispositivo ha: ${nome}`, () => {
    assert.equal(creaAmbiente({ supportate }).variante(), atteso);
  });
}

test('l\'attivazione cancella le cache vecchie e tiene quella dell\'app e quella del lettore', async () => {
  const amb = creaAmbiente({ cacheIniziali: { 'interventi118-v1.2.0': ['index.html'], [LETTORE]: FILE_LETTORE, [VERSIONE]: ['index.html'], altra: [] } });
  await amb.attiva();
  assert.deepEqual([...amb.eliminate].sort(), ['altra', 'interventi118-v1.2.0']);
  assert.deepEqual(amb.nomiCache().sort(), [VERSIONE, LETTORE].sort());
  assert.equal(amb.contenuto(LETTORE).length, FILE_LETTORE.length, 'i file del lettore restano');
  assert.equal(amb.chiamate.claim, 1);
});

test('l\'installazione riesce anche se il lettore non si scarica: i file dell\'app sono comunque in cache', async () => {
  const amb = creaAmbiente({ rifiuta: delLettore });
  await amb.install();
  assert.ok(amb.reteDelLettore().length > 0, 'la prova deve far fallire davvero le richieste del lettore');
  assert.deepEqual(amb.contenuto(VERSIONE).sort(), amb.file().map(href).sort());
  assert.deepEqual(amb.contenuto(LETTORE), [], 'un lettore a metà non si salva');
  assert.equal(amb.chiamate.skipWaiting, 1);
});

test('l\'installazione fallisce se manca un file dell\'app (solo gli errori del lettore si ignorano)', async () => {
  const amb = creaAmbiente({ rifiuta: (url) => url.endsWith('/js/app.js') });
  await assert.rejects(amb.install(), TypeError);
  assert.equal(amb.chiamate.skipWaiting, 0);
});

for (const [nome, supportate, variante] of COMBINAZIONI) {
  test(`l'installazione scarica nel lettore i tre file e il core adatto (${nome})`, async () => {
    const amb = creaAmbiente({ supportate });
    await amb.install();
    const attesi = [...FILE_LETTORE, CARTELLA + variante].map(href).sort();
    assert.deepEqual(amb.reteDelLettore().map((r) => r.url).sort(), attesi);
    assert.ok(amb.reteDelLettore().every((r) => r.cache === 'reload'), 'senza cache del browser');
    assert.deepEqual(amb.contenuto(LETTORE).sort(), attesi);
    assert.ok(amb.contenuto(VERSIONE).every((url) => !delLettore(url)), 'i file del lettore non vanno nella cache dell\'app');
  });
}

test('l\'installazione non riscarica i file del lettore già in cache, ne scarica solo quelli che mancano', async () => {
  const core = CARTELLA + 'tesseract-core-relaxedsimd-lstm.wasm.js';
  const completa = creaAmbiente({ cacheIniziali: { [LETTORE]: [...FILE_LETTORE, core] } });
  await completa.install();
  assert.deepEqual(completa.reteDelLettore(), [], 'nessuna richiesta per il lettore');
  assert.ok(completa.rete.length > 0, 'i file dell\'app si scaricano comunque');

  const parziale = creaAmbiente({ cacheIniziali: { [LETTORE]: [FILE_LETTORE[1], core] } });
  await parziale.install();
  assert.deepEqual(parziale.reteDelLettore().map((r) => r.url).sort(), [FILE_LETTORE[0], FILE_LETTORE[2]].map(href).sort());
  assert.equal(parziale.contenuto(LETTORE).length, 4);
});

for (const base of ['', 'sottocartella/']) {
  test(`un file del lettore (${base}vendor/tesseract-...) va in rete una volta sola e si salva nella cache del lettore`, async () => {
    const amb = creaAmbiente();
    const url = href(`${base}${CARTELLA}worker.min.js`);
    await amb.richiedi(url);
    assert.deepEqual(amb.rete.map((r) => r.url), [url]);
    assert.deepEqual(amb.contenuto(LETTORE), [url]);
    assert.deepEqual(amb.contenuto(VERSIONE), [], 'non nella cache dell\'app');
    await amb.richiedi(url);
    assert.equal(amb.rete.length, 1, 'la seconda volta risponde la cache');
  });
}

test('un file dell\'app si salva ancora nella cache dell\'app, non in quella del lettore', async () => {
  const amb = creaAmbiente();
  const url = href('css/app.css');
  await amb.richiedi(url);
  assert.deepEqual(amb.contenuto(VERSIONE), [url]);
  assert.deepEqual(amb.contenuto(LETTORE), []);
});
