// Prova a mano della lettura su una foto vera del tablet, solo su questo Mac e solo in WebKit (il motore di Safari).
// Uso: FOTO_TABLET=/percorso/fuori/dal/repository/foto.jpg node --test tests/e2e/foto-vera.e2e.mjs
// La foto ha dati veri di un paziente: resta fuori dal repository, e la prova non scrive nessun file e non fa
// screenshot. Stampa nel terminale i valori del modulo, i "Non letti" e i secondi, da confrontare a occhio con la foto.
// Non fa parte di npm run e2e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, realpathSync } from 'node:fs';
import { relative, isAbsolute, sep } from 'node:path';
import { RADICE, caricaPlaywright, avviaServer, avviaBrowser, nuovoContesto } from './aiuti-e2e.mjs';

/** Il file sta dentro il repository (anche passando da un collegamento): lì una foto vera rischia un commit. */
function nelRepository(percorso) {
  const relativo = relative(realpathSync(RADICE), realpathSync(percorso));
  return relativo !== '..' && !relativo.startsWith(`..${sep}`) && !isAbsolute(relativo);
}

const FOTO = process.env.FOTO_TABLET;
const motivo = !FOTO ? 'FOTO_TABLET non è impostata'
  : !existsSync(FOTO) || !statSync(FOTO).isFile() ? 'FOTO_TABLET non indica un file esistente'
    : nelRepository(FOTO) ? 'FOTO_TABLET è dentro il repository: spostala in una cartella temporanea fuori dal progetto'
      : null;

/** I campi che la foto può riempire, letti dall'interfaccia come li vede chi usa l'app. */
async function leggiModulo(page) {
  const valore = (etichetta) => page.getByLabel(etichetta, { exact: true }).inputValue();
  const scelto = async (gruppo, n = 0) => {
    const g = page.getByRole('group', { name: gruppo, exact: true }).nth(n);
    if (!(await g.count())) return '';
    const premuti = await g.getByRole('button', { pressed: true }).allTextContents();
    if (premuti.length) return premuti[0];
    const menu = g.locator('select');
    return (await menu.count()) ? menu.inputValue() : '';
  };
  const codice = async (n) => (await page.getByRole('radiogroup', { name: 'Codice', exact: true }).nth(n)
    .getByRole('radio', { checked: true }).allTextContents())[0] ?? '';
  return {
    data: await valore('Data'), oraAllert: await valore('Ora allert.'), liberoOperativo: await valore('Libero operativo'),
    missione: await page.getByLabel(/^Missione/).inputValue(), comune: await valore('Comune'),
    mezzo: await scelto('Mezzo'), tipologia: await scelto('Tipologia'),
    codiceInvio: await codice(0), codiceRientro: await codice(1),
    patologiaInvio: await scelto('Patologia', 0), patologiaRientro: await scelto('Patologia', 1),
    luogoInvio: await scelto('Luogo', 0), luogoRientro: await scelto('Luogo', 1),
    eta: await valore('Età'), sesso: await scelto('Sesso'), esito: await scelto('Esito'), ospedale: await scelto('Ospedale'),
  };
}

test('foto vera del tablet, in WebKit', { skip: motivo ?? false, timeout: 300000 }, async () => {
  const pw = await caricaPlaywright();
  const server = await avviaServer(8119 + Math.floor(Math.random() * 500));
  const browser = await avviaBrowser(pw, 'webkit');
  try {
    const ctx = await nuovoContesto(browser, { width: 390, height: 844 }, { serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errori = []; // un errore di lettura comparirebbe come "lettore non disponibile": qui si vede la causa
    page.on('pageerror', (e) => errori.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    await page.goto(server.url);
    await page.evaluate(() => { location.hash = '#/nuovo'; });
    const bottone = page.getByRole('button', { name: 'Foto tablet' });
    await bottone.waitFor();

    const [scelta] = await Promise.all([page.waitForEvent('filechooser'), bottone.click()]);
    const inizio = Date.now();
    await scelta.setFiles(FOTO);
    await page.locator('.foto-tablet .riquadro-foto, .foto-tablet .esito-foto > .messaggio').first()
      .waitFor({ timeout: 240000 });
    const secondi = (Date.now() - inizio) / 1000;

    const riquadro = page.locator('.foto-tablet .riquadro-foto');
    if (await riquadro.count()) {
      console.log('Valori nel modulo:', await leggiModulo(page));
      console.log(await riquadro.locator('.letti').textContent());
      const nonLetti = riquadro.locator('.non-letti');
      console.log((await nonLetti.count()) ? await nonLetti.textContent() : 'Non letti: nessuno');
    } else {
      console.log('Nessun valore:', (await page.locator('.foto-tablet .esito-foto').textContent()).trim());
    }
    console.log(`Lettura in ${secondi.toFixed(1)} s`);
    await ctx.close();
    assert.deepEqual(errori, [], 'nessun errore nella pagina');
  } finally {
    await browser.close();
    server.ferma();
  }
});
