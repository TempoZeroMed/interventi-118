// Service worker: mette in cache i file dell'app e li serve anche senza rete (cache-first).
// Non vede né trasmette dati: gli interventi stanno in IndexedDB, non passano di qui.
// Cambiando un file dell'app, aggiorna VERSIONE perché i dispositivi scarichino la nuova copia.

const VERSIONE = 'interventi118-v1.1.0';
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
  'js/core/volo.js',
  'js/ui/dom.js',
  'js/ui/elenco.js',
  'js/ui/file.js',
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

self.addEventListener('install', (evento) => {
  // cache: 'reload' scavalca la cache HTTP del browser (GitHub Pages la tiene 10 minuti):
  // una nuova versione deve salvare i file nuovi, non copie vecchie
  const richieste = FILE.map((f) => new Request(f, { cache: 'reload' }));
  evento.waitUntil(caches.open(VERSIONE).then((cache) => cache.addAll(richieste)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(caches.keys()
    .then((nomi) => Promise.all(nomi.filter((n) => n !== VERSIONE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== self.location.origin) return;
  evento.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    const trovata = await cache.match(richiesta, { ignoreSearch: true })
      ?? (richiesta.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (trovata) return trovata;
    const risposta = await fetch(richiesta);
    if (risposta.ok) cache.put(richiesta, risposta.clone());
    return risposta;
  })());
});
