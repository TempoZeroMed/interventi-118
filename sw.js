// Service worker: mette in cache i file dell'app e li serve anche senza rete (cache-first).
// Non vede né trasmette dati: gli interventi stanno in IndexedDB, non passano di qui.
// Cambiando un file dell'app, aggiorna VERSIONE perché i dispositivi scarichino la nuova copia.

const VERSIONE = 'interventi118-v1.3.0';
const FILE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/stato.js',
  'js/core/calcolati.js',
  'js/core/campi.js',
  'js/core/controlli.js',
  'js/core/elenco.js',
  'js/core/excel.js',
  'js/core/liste.js',
  'js/core/merge.js',
  'js/core/modulo.js',
  'js/core/statistiche.js',
  'js/core/tablet.js',
  'js/core/volo.js',
  'js/ui/dom.js',
  'js/ui/elenco.js',
  'js/ui/file.js',
  'js/ui/fototablet.js',
  'js/ui/impostazioni.js',
  'js/ui/inserimento.js',
  'js/ui/statistiche.js',
  'js/ui/volo.js',
  'vendor/chart-4.5.1.umd.min.js',
  'vendor/xlsx-0.20.3.full.min.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// Il lettore di testo (Tesseract, circa 6 MB per dispositivo) ha una cache a parte: non si cancella quando cambia
// VERSIONE, così un aggiornamento dell'app non lo riscarica. Cambiando versione di Tesseract, cambia la cartella e questo nome.
const LETTORE = 'lettore-testo-7.0.0';
const CARTELLA_LETTORE = 'vendor/tesseract-7.0.0/';
const FILE_LETTORE = [
  'vendor/tesseract-7.0.0/tesseract.min.js',
  'vendor/tesseract-7.0.0/worker.min.js',
  'vendor/tesseract-7.0.0/ita.traineddata.gz',
];

// Stesse prove di wasm-feature-detect 1.9.0, la libreria con cui Tesseract sceglie il core:
// in cache va solo la variante che questo dispositivo userà.
const RELAXED_SIMD = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11];
const SIMD = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];

function varianteCore() {
  if (WebAssembly.validate(new Uint8Array(RELAXED_SIMD))) return 'tesseract-core-relaxedsimd-lstm.wasm.js';
  if (WebAssembly.validate(new Uint8Array(SIMD))) return 'tesseract-core-simd-lstm.wasm.js';
  return 'tesseract-core-lstm.wasm.js';
}

// Aggiunge alla cache del lettore solo i file che non ci sono già: un aggiornamento dell'app non li riscarica.
async function scaricaLettore() {
  const cache = await caches.open(LETTORE);
  const richieste = [];
  for (const f of [...FILE_LETTORE, CARTELLA_LETTORE + varianteCore()]) {
    if (!(await cache.match(f))) richieste.push(new Request(f, { cache: 'reload' }));
  }
  await cache.addAll(richieste);
}

self.addEventListener('install', (evento) => {
  // cache: 'reload' scavalca la cache HTTP del browser (GitHub Pages la tiene 10 minuti):
  // una nuova versione deve salvare i file nuovi, non copie vecchie
  const richieste = FILE.map((f) => new Request(f, { cache: 'reload' }));
  // Un errore del lettore non fa fallire l'installazione: i file che mancano arrivano al primo uso (vedi fetch)
  evento.waitUntil(Promise.all([
    caches.open(VERSIONE).then((cache) => cache.addAll(richieste)),
    scaricaLettore().catch(() => {}),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(caches.keys()
    .then((nomi) => Promise.all(nomi.filter((n) => n !== VERSIONE && n !== LETTORE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  const url = new URL(richiesta.url);
  if (richiesta.method !== 'GET' || url.origin !== self.location.origin) return;
  // I file del lettore si cercano nella sua cache e, se mancano, si scaricano e si salvano lì
  const nomeCache = url.pathname.includes('/vendor/tesseract-') ? LETTORE : VERSIONE;
  evento.respondWith((async () => {
    const cache = await caches.open(nomeCache);
    const trovata = await cache.match(richiesta, { ignoreSearch: true })
      ?? (richiesta.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (trovata) return trovata;
    const risposta = await fetch(richiesta);
    if (risposta.ok) cache.put(richiesta, risposta.clone());
    return risposta;
  })());
});
