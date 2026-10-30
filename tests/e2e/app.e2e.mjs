// Prove end-to-end nel browser vero: WebKit (il motore di Safari) e Chromium, a 390 e 1440 px.
// Uso: npm run e2e   (oppure: node --test tests/e2e/)
// Solo dati inventati (tests/fixtures/demo.json). Gli screenshot della corsa WebKit vanno in docs/screenshots/.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import {
  DEMO, caricaPlaywright, avviaServer, avviaBrowser, nuovoContesto, attendiTesto, conteggioElenco, scattaSchermata,
} from './aiuti-e2e.mjs';

const demo = JSON.parse(readFileSync(DEMO, 'utf8')).record;
const BROWSER = (process.env.E2E_BROWSER ?? 'webkit,chromium').split(',');
const VIEWPORT = [{ nome: '390', width: 390, height: 844 }, { nome: '1440', width: 1440, height: 900 }];

const pw = await caricaPlaywright();
const server = await avviaServer(8119 + Math.floor(Math.random() * 500));
const cartellaFile = mkdtempSync(join(tmpdir(), 'i118-e2e-'));
after(() => {
  server.ferma();
  rmSync(cartellaFile, { recursive: true, force: true });
});

// ------------------------------------------------------------------ azioni sull'app, solo dall'interfaccia

const vai = async (page, hash) => {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(200);
};

async function importa(page, file) {
  await vai(page, '#/impostazioni');
  const [scelta] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importa backup' }).click()]);
  await scelta.setFiles(file);
  // il riepilogo dell'import precedente resta a video: aspetta quello di questo file
  await attendiTesto(page.locator('.esito-import'), `Import di ${basename(file)}`);
  const conteggi = {};
  for (const div of await page.locator('.esito-import .conteggi > div').all()) {
    conteggi[(await div.locator('dt').textContent()).trim().toLowerCase()] = Number((await div.locator('dd').textContent()).replace(/\D/g, ''));
  }
  return conteggi;
}

async function esporta(page, nomeBottone, file) {
  await vai(page, '#/impostazioni');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: nomeBottone }).click()]);
  await download.saveAs(file);
  return download.suggestedFilename();
}

/** Sceglie una voce: pulsante rapido se c'è, altrimenti dal menu "Altro…" dello stesso gruppo. */
async function scegli(page, gruppo, voce, n = 0) {
  const g = page.getByRole('group', { name: gruppo, exact: true }).nth(n);
  const bottone = g.getByRole('button', { name: voce, exact: true });
  if (await bottone.count()) await bottone.click();
  else await g.locator('select').selectOption(voce);
}

const premuto = async (locator) => (await locator.getAttribute('aria-pressed')) === 'true';

async function nuovoIntervento(page, { missione, comune, ora = '23:40', libero = '00:15' }) {
  await vai(page, '#/nuovo');
  await page.getByLabel('Ora allert.').fill(ora);
  await page.getByLabel(/^Missione/).fill(missione);
  await page.getByLabel('Comune', { exact: true }).fill(comune);
  await scegli(page, 'Mezzo', '5022');
  await page.getByRole('radio', { name: 'GIALLO' }).first().click();
  await scegli(page, 'Patologia', '04 - Neuro');
  await scegli(page, 'Luogo', 'K - Casa');
  await page.getByLabel('Età').fill('81');
  await scegli(page, 'Sesso', 'Femmina');
  await scegli(page, 'Esito', 'Trasportato');
  await scegli(page, 'Ospedale', 'Biella');
  await page.getByRole('button', { name: 'Copia da invio' }).click();
  await page.getByLabel('Libero operativo').fill(libero);
}

// ------------------------------------------------------------------ prove

for (const nomeBrowser of BROWSER) {
  describe(`${nomeBrowser}`, () => {
    let browser;
    before(async () => { browser = await avviaBrowser(pw, nomeBrowser); });
    after(async () => browser?.close());
    const foto = nomeBrowser === 'webkit';

    for (const vp of VIEWPORT) {
      describe(`${vp.nome} px`, () => {
        let ctx;
        let page;
        before(async () => {
          ctx = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
          page = await ctx.newPage();
          await page.goto(server.url);
          await importa(page, DEMO);
        });
        after(async () => ctx?.close());

        test('inserimento: regole del form, durata oltre mezzanotte, salvataggio', async () => {
          await nuovoIntervento(page, { missione: 'e2e00001', comune: 'biella' });
          assert.equal(await page.getByLabel(/^Missione/).inputValue(), 'E2E00001');
          assert.equal(await page.getByLabel('Comune', { exact: true }).inputValue(), 'BIELLA');
          assert.ok(await premuto(page.getByRole('group', { name: 'Tipologia' }).getByRole('button', { name: 'India' })), '5022 imposta India');
          assert.equal(await page.getByRole('radio', { name: 'GIALLO' }).nth(1).getAttribute('aria-checked'), 'true', 'copia da invio');
          await attendiTesto(page.locator('.calcolati'), '35 min');
          if (foto) await scattaSchermata(page, `${vp.nome}-inserimento`, { inCima: true });
          await scegli(page, 'Esito', 'Rifiuto Trasporto');
          assert.equal(await page.getByRole('group', { name: 'Ospedale' }).isVisible(), false, 'ospedale nascosto se non trasportato');
          await scegli(page, 'Esito', 'Trasportato');
          await scegli(page, 'Ospedale', 'Biella');
          await page.getByRole('button', { name: 'Salva intervento' }).click();
          await attendiTesto(page.locator('#toast'), 'E2E00001 salvato');
          assert.equal(await page.getByLabel(/^Missione/).inputValue(), '', 'il form si svuota per il prossimo');
          await vai(page, '#/elenco');
          assert.equal(await conteggioElenco(page), demo.length + 1);
          await attendiTesto(page.getByRole('link', { name: /E2E00001/ }), 'BIELLA');
        });

        test('missione duplicata: salvataggio bloccato con il link al duplicato', async () => {
          await vai(page, '#/nuovo');
          await page.getByLabel(/^Missione/).fill('E2E00001');
          await attendiTesto(page.locator('.messaggio.errore'), 'già registrata');
          assert.ok(await page.getByRole('link', { name: 'Apri il duplicato' }).isVisible());
          await page.getByRole('button', { name: 'Salva intervento' }).click();
          await vai(page, '#/elenco');
          assert.equal(await conteggioElenco(page), demo.length + 1, 'nessun doppione salvato');
          await vai(page, '#/nuovo');
          await page.getByRole('button', { name: 'Svuota' }).click();
          const conferma = page.getByRole('dialog').getByRole('button', { name: 'Svuota' });
          if (await conferma.count()) await conferma.click();
        });

        test('modifica ed eliminazione dal dettaglio', async () => {
          await vai(page, '#/elenco');
          await page.getByRole('link', { name: /E2E00001/ }).click();
          await attendiTesto(page.locator('#banda h1'), 'Intervento E2E00001');
          if (foto) await scattaSchermata(page, `${vp.nome}-dettaglio`);
          await page.getByLabel('Comune', { exact: true }).fill('candelo');
          await page.getByRole('button', { name: 'Salva modifiche' }).click();
          await attendiTesto(page.locator('#banda h1'), 'Elenco');
          await attendiTesto(page.getByRole('link', { name: /E2E00001/ }), 'CANDELO');

          await page.getByLabel('Cerca per missione o comune').fill('DEMO0005');
          await page.getByRole('link', { name: /DEMO0005/ }).click();
          await page.getByRole('button', { name: 'Elimina intervento' }).click();
          await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
          await attendiTesto(page.locator('#banda h1'), 'Elenco');
          await page.getByLabel('Cerca per missione o comune').fill('');
          assert.equal(await conteggioElenco(page), demo.length, '90 demo + 1 nuovo − 1 eliminato');
        });

        test('filtri combinabili e ricerca', async () => {
          await vai(page, '#/elenco');
          const attivi = demo.filter((r) => r.id !== 'demo-0005');
          await page.getByLabel('Cerca per missione o comune').fill('cossato');
          assert.equal(await conteggioElenco(page), attivi.filter((r) => r.comune === 'COSSATO').length);
          await page.getByLabel('Cerca per missione o comune').fill('');
          await apriFiltri(page);
          await page.getByLabel('Codice invio', { exact: true }).selectOption('ROSSO');
          assert.equal(await conteggioElenco(page), attivi.filter((r) => r.codiceInvio === 'ROSSO').length);
          await page.getByLabel('Esito', { exact: true }).selectOption('Trasportato');
          assert.equal(await conteggioElenco(page), attivi.filter((r) => r.codiceInvio === 'ROSSO' && r.esito === 'Trasportato').length);
          if (foto) await scattaSchermata(page, `${vp.nome}-filtri`);
          await page.getByRole('button', { name: 'Azzera filtri' }).first().click();
          await apriFiltri(page);
          await page.getByLabel('Solo righe con avvisi da controllare').check();
          assert.equal(await conteggioElenco(page), 3, 'DEMO12 (non 8 caratteri) e le due DEMO0007 (duplicata)');
          await page.getByRole('button', { name: 'Azzera filtri' }).first().click();
          await scorriInCima(page);
          if (foto) await scattaSchermata(page, `${vp.nome}-elenco`);
        });

        test('statistiche: periodo, KPI, 6 grafici e 12 tabelle', async () => {
          await vai(page, '#/statistiche');
          await page.getByRole('button', { name: 'Tutto', exact: true }).click();
          await attendiTesto(page.locator('#banda .sotto'), 'Tutto l\'archivio');
          await attendiTesto(page.locator('.kpi > div').first(), String(demo.length));
          await page.waitForFunction(() => document.querySelectorAll('.grafico canvas').length === 6
            && [...document.querySelectorAll('.grafico canvas')].every((c) => c.width > 0));
          assert.equal(await page.locator('.blocco-tabella').count(), 13, 'tabelle 1–12 più la 3b');
          if (foto) await scattaSchermata(page, `${vp.nome}-statistiche`);
          await page.getByRole('button', { name: 'Anno', exact: true }).click();
          await attendiTesto(page.locator('#banda .sotto'), 'Anno 2026');
        });

        test('statistiche: vista Volo con 4 KPI, 3 grafici e 5 tabelle', async () => {
          const voli = demo.filter((r) => ['V-ECHO', 'T-ECHO'].includes(r.mezzo) && r.id !== 'demo-0005');
          await vai(page, '#/statistiche');
          await page.getByRole('button', { name: 'Tutto', exact: true }).click();
          await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Volo', exact: true }).click();
          await attendiTesto(page.locator('.kpi > div').first(), String(voli.length));
          assert.equal(await page.locator('.kpi > div').count(), 4);
          await page.waitForFunction(() => document.querySelectorAll('.grafico canvas').length === 3
            && [...document.querySelectorAll('.grafico canvas')].every((c) => c.width > 0));
          assert.equal(await page.locator('.blocco-tabella').count(), 5, 'tabelle V1–V5');
          if (foto) await scattaSchermata(page, `${vp.nome}-statistiche-volo`, { inCima: true });
          await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Interventi', exact: true }).click();
          await page.waitForFunction(() => document.querySelectorAll('.grafico canvas').length === 6);
        });

        // in fondo al blocco: salva un intervento in più, che cambierebbe i conteggi delle prove precedenti
        test('volo: sezione solo per gli elicotteri, tipo, tempo e manovre salvati', async () => {
          const sezioneVolo = page.locator('section.sezione', { has: page.getByRole('heading', { name: 'Volo', exact: true }) });
          const manovre = page.getByRole('group', { name: 'Manovre', exact: true });
          const tipo = (voce) => page.getByRole('group', { name: 'Tipo missione', exact: true }).getByRole('button', { name: voce, exact: true });
          const tempo = () => page.getByLabel('Tempo di volo (min)');
          await vai(page, '#/nuovo');
          await page.getByLabel(/^Missione/).fill('99ZZ0777');
          assert.equal(await sezioneVolo.isVisible(), false, 'nascosta per le ambulanze');
          await scegli(page, 'Mezzo', 'V-ECHO');
          assert.ok(await sezioneVolo.isVisible(), 'visibile per V-ECHO');
          await scegli(page, 'Tipo missione', 'HSR');
          await tempo().fill('75');
          await manovre.getByRole('button', { name: 'VD · Verricello discesa' }).click();
          await manovre.getByRole('button', { name: 'VSP · Verricello salita pannolone' }).click();
          const controlli = await page.locator('.esiti-controlli').textContent();
          assert.ok(!/Tipo missione mancante|Tempo volo mancante/.test(controlli), controlli);
          if (foto) {
            await sezioneVolo.scrollIntoViewIfNeeded();
            await scattaSchermata(page, `${vp.nome}-volo`);
          }
          await page.getByRole('button', { name: 'Salva intervento' }).click();
          await attendiTesto(page.locator('#toast'), '99ZZ0777 salvato');

          await vai(page, '#/elenco');
          await page.getByLabel('Cerca per missione o comune').fill('99ZZ0777');
          await page.getByRole('link', { name: /99ZZ0777/ }).click();
          await attendiTesto(page.locator('#banda h1'), 'Intervento 99ZZ0777');
          assert.ok(await premuto(tipo('HSR')), 'tipo salvato');
          assert.equal(await tempo().inputValue(), '75');
          assert.deepEqual(await manovre.getByRole('button', { pressed: true }).allTextContents(),
            ['VD · Verricello discesa', 'VSP · Verricello salita pannolone']);

          await scegli(page, 'Mezzo', '3030');
          assert.equal(await sezioneVolo.isVisible(), false, 'sparisce con un\'ambulanza');
          await scegli(page, 'Mezzo', 'V-ECHO');
          assert.equal(await tempo().inputValue(), '', 'i dati di volo si sono svuotati');
          assert.equal(await manovre.getByRole('button', { pressed: true }).count(), 0);
          assert.equal(await premuto(tipo('HSR')), false);
        });
      });
    }

    test('export e reimport con merge tra due dispositivi: nessun record perso o duplicato', async () => {
      const vp = VIEWPORT[0];
      const fileA = join(cartellaFile, `${nomeBrowser}-a.json`);
      const fileB = join(cartellaFile, `${nomeBrowser}-b.json`);
      // dispositivo A: dati demo, un intervento nuovo, una eliminazione
      const ctxA = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
      const a = await ctxA.newPage();
      await a.goto(server.url);
      await importa(a, DEMO);
      await nuovoIntervento(a, { missione: 'E2EA0001', comune: 'BIELLA' });
      await a.getByRole('button', { name: 'Salva intervento' }).click();
      await attendiTesto(a.locator('#toast'), 'salvato');
      await vai(a, '#/elenco');
      await a.getByLabel('Cerca per missione o comune').fill('DEMO0005');
      await a.getByRole('link', { name: /DEMO0005/ }).click();
      await a.getByRole('button', { name: 'Elimina intervento' }).click();
      await a.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
      await attendiTesto(a.locator('#banda h1'), 'Elenco');
      const nomeFile = await esporta(a, 'Esporta backup', fileA);
      assert.match(nomeFile, /^interventi118_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);

      // dispositivo B: stessi dati demo, una modifica e un intervento suo, poi importa il file di A
      const ctxB = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
      const b = await ctxB.newPage();
      await b.goto(server.url);
      await importa(b, DEMO);
      await vai(b, '#/elenco');
      await b.getByLabel('Cerca per missione o comune').fill('DEMO0010');
      await b.getByRole('link', { name: /DEMO0010/ }).click();
      await attendiTesto(b.locator('#banda h1'), 'Intervento DEMO0010');
      await b.getByLabel('Comune', { exact: true }).fill('MONGRANDO');
      await b.getByRole('button', { name: 'Salva modifiche' }).click();
      await attendiTesto(b.locator('#banda h1'), 'Elenco');
      await nuovoIntervento(b, { missione: 'E2EB0001', comune: 'NOVARA' });
      await b.getByRole('button', { name: 'Salva intervento' }).click();
      await attendiTesto(b.locator('#toast'), 'salvato');
      const suB = await importa(b, fileA);
      assert.deepEqual(suB, { nuovi: 1, aggiornati: 1, invariati: demo.length - 1, conflitti: 0 });
      await attendiTesto(b.locator('.esito-import'), '1 intervento risulta eliminato sull\'altro dispositivo');
      if (foto) await scattaSchermata(b, `${vp.nome}-import-merge`);

      // ritorno: A importa il backup di B
      await esporta(b, 'Esporta backup', fileB);
      const suA = await importa(a, fileB);
      assert.deepEqual(suA, { nuovi: 1, aggiornati: 1, invariati: demo.length, conflitti: 0 });

      // i due dispositivi ora hanno gli stessi record, senza doppioni
      const finaleA = join(cartellaFile, `${nomeBrowser}-a2.json`);
      const finaleB = join(cartellaFile, `${nomeBrowser}-b2.json`);
      await esporta(a, 'Esporta backup', finaleA);
      await esporta(b, 'Esporta backup', finaleB);
      const ordina = (f) => JSON.parse(readFileSync(f, 'utf8')).record.sort((x, y) => x.id.localeCompare(y.id));
      const recA = ordina(finaleA);
      assert.deepEqual(recA, ordina(finaleB));
      assert.equal(new Set(recA.map((r) => r.id)).size, recA.length, 'id unici');
      assert.equal(recA.filter((r) => !r.deleted).length, demo.length + 1, '90 demo − 1 eliminato + 2 nuovi');
      assert.equal(recA.find((r) => r.id === 'demo-0010').comune, 'MONGRANDO');
      assert.equal(recA.find((r) => r.id === 'demo-0005').deleted, true);
      // i dati di volo fanno il giro dei due dispositivi
      const volo = demo.find((r) => r.mezzo === 'V-ECHO' && r.tempoVolo !== null);
      const arrivato = recA.find((r) => r.id === volo.id);
      assert.deepEqual([arrivato.tipoMissione, arrivato.tempoVolo, arrivato.manovre], [volo.tipoMissione, volo.tempoVolo, volo.manovre]);
      await vai(b, '#/elenco');
      await b.getByLabel('Cerca per missione o comune').fill(volo.missione);
      await b.getByRole('link', { name: new RegExp(volo.missione) }).click();
      await attendiTesto(b.locator('#banda h1'), `Intervento ${volo.missione}`);
      assert.equal(await b.getByLabel('Tempo di volo (min)').inputValue(), String(volo.tempoVolo));
      await ctxA.close();
      await ctxB.close();
    });

    test('export Excel con la struttura del foglio "Interventi"', async () => {
      const ctx = await nuovoContesto(browser, VIEWPORT[1], { serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.goto(server.url);
      await importa(page, DEMO);
      const file = join(cartellaFile, `${nomeBrowser}.xlsx`);
      const nome = await esporta(page, 'Esporta Excel', file);
      assert.match(nome, /^interventi118_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);
      const intestazione = readFileSync(file).subarray(0, 2).toString();
      assert.equal(intestazione, 'PK', 'file .xlsx (zip)');
      await ctx.close();
    });

    for (const vp of VIEWPORT) test(`funziona offline dopo il primo caricamento (service worker), ${vp.nome} px`, async () => {
      const ctx = await nuovoContesto(browser, vp);
      const page = await ctx.newPage();
      await page.goto(server.url);
      await importa(page, DEMO);
      // il service worker deve essere attivo e controllare la pagina (attese limitate: senza service worker la prova fallisce)
      await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()?.then((r) => r?.active)), null, { timeout: 10000 });
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
      await vai(page, '#/nuovo');
      await ctx.setOffline(true);
      await page.reload();
      await attendiTesto(page.locator('#banda h1'), 'Nuovo intervento');
      await vai(page, '#/statistiche');
      await page.waitForFunction(() => document.querySelectorAll('.grafico canvas').length === 6, null, { timeout: 8000 });
      await vai(page, '#/elenco');
      assert.equal(await conteggioElenco(page), demo.length, 'i dati sono sul dispositivo');
      const file = join(cartellaFile, `${nomeBrowser}-${vp.nome}-offline.xlsx`);
      await esporta(page, 'Esporta Excel', file);
      if (foto) await scattaSchermata(page, `${vp.nome}-offline-impostazioni`);
      await ctx.close();
    });
  });
}

async function apriFiltri(page) {
  if (!(await page.locator('.filtri').evaluate((d) => d.open))) await page.locator('.filtri summary').click();
}

async function scorriInCima(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
}
