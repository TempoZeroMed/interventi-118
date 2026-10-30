// La PWA funziona offline solo se il service worker mette in cache tutti i suoi file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = new URL('../', import.meta.url);
const leggi = (p) => readFileSync(new URL(p, radice), 'utf8');
const elenca = (cartella, filtro) => readdirSync(new URL(cartella, radice), { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile() && filtro.test(f.name))
  .map((f) => relative(fileURLToPath(radice), join(f.parentPath, f.name)));

const inCache = (() => {
  const blocco = /const FILE = \[([\s\S]*?)\];/.exec(leggi('sw.js'))[1];
  return [...blocco.matchAll(/'([^']+)'/g)].map((m) => m[1]);
})();

test('il service worker mette in cache ogni file dell\'app', () => {
  const necessari = [
    'index.html', 'manifest.webmanifest',
    ...elenca('css/', /\.css$/), ...elenca('js/', /\.js$/), ...elenca('vendor/', /\.js$/), ...elenca('icons/', /\.(png|svg)$/),
  ].filter((f) => !f.startsWith('vendor/tesseract-7.0.0/')); // il lettore ha la sua cache, che non segue la versione dell'app
  const mancanti = necessari.filter((f) => !inCache.includes(f));
  assert.deepEqual(mancanti, [], `file non in cache: ${mancanti.join(', ')}`);
});

test('ogni file in cache esiste davvero (un file mancante fa fallire l\'installazione)', () => {
  const inesistenti = inCache.filter((f) => f !== './' && !existsSync(new URL(f, radice)));
  assert.deepEqual(inesistenti, []);
});

test('il manifest punta a icone esistenti e funziona anche in una sottocartella del sito', () => {
  const m = JSON.parse(leggi('manifest.webmanifest'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(new URL(i.src, radice)), i.src);
  assert.ok(!m.start_url.startsWith('/') && !m.scope.startsWith('/'), 'percorsi relativi, non dalla radice del dominio');
});

test('nessuna risorsa esterna: script, fogli di stile e import solo locali', () => {
  const sorgenti = ['index.html', 'sw.js', ...elenca('js/', /\.js$/), ...elenca('css/', /\.css$/)];
  const esterni = sorgenti.filter((f) => /(src|href)=["']https?:|import\s[^;]*from\s+["']https?:|url\(["']?https?:|fetch\(["']https?:/.test(leggi(f)));
  assert.deepEqual(esterni, []);
});

test('la pubblicazione su Cloudflare pubblica tutti i file messi in cache, e solo quelli dell\'app', () => {
  const riga = /git archive HEAD (.+?) \|/.exec(leggi('tools/pubblica.sh'))[1].split(/\s+/);
  const scoperti = inCache.filter((f) => f !== './' && !riga.some((voce) => f === voce || f.startsWith(`${voce}/`)));
  assert.deepEqual(scoperti, [], `file dell'app non pubblicati: ${scoperti.join(', ')}`);
  const vietati = riga.filter((voce) => /^(data|tests|tools|docs|\.impeccable|\.claude)$|\.(md|xlsx|json)$/.test(voce));
  assert.deepEqual(vietati, [], 'nel sito pubblico finiscono solo i file dell\'app');
});

const CARTELLA_LETTORE = 'vendor/tesseract-7.0.0/';
const FILE_LETTORE_ATTESI = ['tesseract.min.js', 'worker.min.js', 'ita.traineddata.gz'].map((f) => CARTELLA_LETTORE + f);
const VARIANTI_CORE = ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'];

test('il lettore ha la sua cache: file esistenti, fuori da FILE, varianti del core presenti', () => {
  const sw = leggi('sw.js');
  const blocco = /const FILE_LETTORE = \[([\s\S]*?)\];/.exec(sw);
  assert.ok(blocco, 'sw.js non definisce FILE_LETTORE');
  const fileLettore = [...blocco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(fileLettore, FILE_LETTORE_ATTESI);
  const inesistenti = fileLettore.filter((f) => !existsSync(new URL(f, radice)));
  assert.deepEqual(inesistenti, []);
  assert.deepEqual(fileLettore.filter((f) => inCache.includes(f)), [], 'i file del lettore non vanno anche in FILE');
  for (const variante of VARIANTI_CORE) {
    assert.ok(sw.includes(variante), `sw.js non cita ${variante}`);
    assert.ok(existsSync(new URL(CARTELLA_LETTORE + variante, radice)), `${variante} non c'è in ${CARTELLA_LETTORE}`);
  }
});

test('l\'attivazione non cancella la cache del lettore', () => {
  const sw = leggi('sw.js');
  assert.ok(sw.includes("const LETTORE = 'lettore-testo-7.0.0'"));
  assert.match(sw, /n !== VERSIONE && n !== LETTORE/);
});

test('la versione dell\'app è la 1.3.1 ovunque', () => {
  assert.ok(leggi('sw.js').includes("const VERSIONE = 'interventi118-v1.3.1'"));
  assert.ok(leggi('js/app.js').includes("export const VERSIONE_APP = '1.3.1'"));
  assert.ok(leggi('js/ui/impostazioni.js').includes('Interventi 118, versione 1.3.1.'));
});
