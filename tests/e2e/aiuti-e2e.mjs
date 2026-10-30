// Utilità per le prove end-to-end con Playwright. Non fanno parte dell'app.
// Playwright non è una dipendenza del progetto: si usa quello installato sul computer
// (pacchetto "playwright", oppure il playwright-core di @playwright/cli, oppure PLAYWRIGHT_CORE=percorso/index.mjs).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RADICE = fileURLToPath(new URL('../../', import.meta.url));
export const DEMO = join(RADICE, 'tests/fixtures/demo.json');
export const SCREENSHOT = join(RADICE, 'docs/screenshots');

const CANDIDATI = [
  process.env.PLAYWRIGHT_CORE,
  'playwright',
  '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs',
  '/usr/local/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs',
].filter(Boolean);

export async function caricaPlaywright() {
  for (const c of CANDIDATI) {
    try {
      return await import(c);
    } catch { /* prova il successivo */ }
  }
  throw new Error('Playwright non trovato: installa @playwright/cli oppure imposta PLAYWRIGHT_CORE.');
}

/** Avvia tools/server_sviluppo.py su una porta libera e aspetta che risponda. */
export async function avviaServer(porta) {
  const processo = spawn('python3', [join(RADICE, 'tools/server_sviluppo.py'), String(porta)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${porta}/`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return { url, ferma: () => processo.kill() };
    } catch { /* non ancora pronto */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  processo.kill();
  throw new Error(`Il server di prova non risponde su ${url}`);
}

/** Avvia il browser; per Chromium ripiega sull'ultima build installata se quella attesa manca. */
export async function avviaBrowser(pw, nome) {
  try {
    return await pw[nome].launch();
  } catch (errore) {
    if (nome !== 'chromium' || !/Executable doesn't exist/.test(errore.message)) throw errore;
    const cache = join(homedir(), 'Library/Caches/ms-playwright');
    const build = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1);
    const eseguibile = build && join(cache, build, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
    if (!eseguibile || !existsSync(eseguibile)) throw errore;
    return pw.chromium.launch({ executablePath: eseguibile });
  }
}

/**
 * Contesto del browser per le prove. Senza `finestraSalvataggio` la finestra di salvataggio di Chromium
 * (showSaveFilePicker) viene tolta, così le esportazioni scaricano il file come in Safari.
 */
export async function nuovoContesto(browser, { width, height }, { finestraSalvataggio = false, ...extra } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, locale: 'it-IT', timezoneId: 'Europe/Rome', colorScheme: 'light',
    reducedMotion: 'reduce', acceptDownloads: true, ...extra,
  });
  if (!finestraSalvataggio) await ctx.addInitScript(() => { delete Window.prototype.showSaveFilePicker; delete window.showSaveFilePicker; });
  return ctx;
}

/** Aspetta che un elemento contenga un testo (stringa o espressione regolare). */
export async function attendiTesto(locator, atteso, timeout = 5000) {
  const fine = Date.now() + timeout;
  let ultimo = '';
  while (Date.now() < fine) {
    ultimo = (await locator.first().textContent().catch(() => '')) ?? '';
    if (typeof atteso === 'string' ? ultimo.includes(atteso) : atteso.test(ultimo)) return ultimo;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(`Testo atteso ${atteso} non trovato; ultimo testo: "${ultimo.trim().slice(0, 200)}"`);
}

/** Numero di interventi mostrato in cima all'elenco ("91 interventi" o "3 di 91 interventi"). */
export async function conteggioElenco(page) {
  const testo = await attendiTesto(page.locator('.riepilogo-elenco, .vuoto-stato h2'), /interventi|Nessun intervento/);
  const m = /(\d+)(?: di \d+)? interventi/.exec(testo.replace(/\./g, ''));
  return m ? Number(m[1]) : 0;
}

export async function scattaSchermata(page, nome, { inCima = false } = {}) {
  mkdirSync(SCREENSHOT, { recursive: true });
  // niente messaggi temporanei né cursore nel campo: lo screenshot mostra la schermata a riposo
  await page.evaluate((cima) => {
    document.getElementById('toast')?.classList.remove('visibile');
    document.activeElement?.blur();
    if (cima) window.scrollTo(0, 0);
  }, inCima);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SCREENSHOT, `${nome}.png`) });
}
