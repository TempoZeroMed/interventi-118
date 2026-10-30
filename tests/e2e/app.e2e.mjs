// Prove end-to-end nel browser vero: WebKit (il motore di Safari) e Chromium, a 390 e 1440 px.
// Uso: npm run e2e   (oppure: node --test tests/e2e/)
// Solo dati inventati (tests/fixtures/demo.json). Gli screenshot della corsa WebKit vanno in docs/screenshots/.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import {
  RADICE, DEMO, caricaPlaywright, avviaServer, avviaBrowser, nuovoContesto, attendiTesto, conteggioElenco, scattaSchermata,
} from './aiuti-e2e.mjs';
import { isElicottero } from '../../js/core/campi.js';
import { CAMPI_TABLET } from '../../js/core/tablet.js';

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

/** Svuota il modulo del nuovo intervento, confermando se lo chiede. */
async function svuota(page) {
  await vai(page, '#/nuovo');
  await page.getByRole('button', { name: 'Svuota' }).click();
  const conferma = page.getByRole('dialog').getByRole('button', { name: 'Svuota' });
  if (await conferma.count()) await conferma.click();
}

// ------------------------------------------------------------------ foto del tablet: screenshot di pagine finte, dati inventati

const TABLET_FINTO = readFileSync(join(RADICE, 'tests/fixtures/tablet-finto.html'), 'utf8');
const LISTA_SPESA = '<body style="margin:0;padding:120px;background:#fff;font:56px Arial,sans-serif">LISTA DELLA SPESA</body>';
const RULLINO = 'Se l\'hai presa dalla Libreria foto, resta nel Rullino: cancellala da Foto quando hai finito.';

/** Quello che la foto dritta della pagina finta mette nel modulo (foto alle 06:15 del 31/10, allarme la sera prima). */
const DAL_TABLET = {
  data: '2026-10-30', oraAllert: '21:05', liberoOperativo: '22:10', missione: '99ZZ0042', comune: 'NOVARA', mezzo: '3050',
  tipologia: 'India', codiceInvio: 'ROSSO', codiceRientro: 'ROSSO', patologiaInvio: '04 - Neuro', patologiaRientro: '04 - Neuro',
  luogoInvio: 'S - Sierra', luogoRientro: 'S - Sierra', eta: '41', sesso: 'Femmina', esito: 'Trasportato', ospedale: 'Novara',
};
/** Il nome con cui un campo compare tra i "Non letti"; il rientro segue l'invio. Data, tipologia ed esito non ci sono. */
const NOMI_TABLET = Object.fromEntries(CAMPI_TABLET);
const NOME_NON_LETTO = {
  ...NOMI_TABLET, codiceRientro: NOMI_TABLET.codiceInvio, patologiaRientro: NOMI_TABLET.patologiaInvio,
  luogoRientro: NOMI_TABLET.luogoInvio,
};

/** Apre la pagina finta del tablet in una scheda nuova, grande come una foto, e ne restituisce lo screenshot PNG. */
async function fotoFinta(ctx, { storta = false, indirizzo = null, html = TABLET_FINTO } = {}) {
  const scheda = await ctx.newPage();
  await scheda.setViewportSize({ width: 1400, height: 920 });
  await scheda.setContent(html);
  await scheda.evaluate(({ storta: s, indirizzo: via }) => {
    document.querySelector('.tablet')?.classList.toggle('storta', s);
    if (via) document.querySelector('.indirizzo').textContent = via;
  }, { storta, indirizzo });
  const png = await scheda.screenshot({ type: 'png' });
  await scheda.close();
  return png;
}

/** Sceglie la foto con il pulsante "Foto tablet", senza aspettare la lettura. */
async function scegliFoto(page, buffer, nome = 'tablet.png', tipo = 'image/png') {
  const [scelta] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Foto tablet' }).click()]);
  await scelta.setFiles({ name: nome, mimeType: tipo, buffer });
}

/** Sceglie la foto e aspetta la fine della lettura: il riquadro con l'esito, oppure il messaggio di errore. */
async function daFoto(page, buffer, nome, tipo) {
  await scegliFoto(page, buffer, nome, tipo);
  await page.locator('.foto-tablet .riquadro-foto, .foto-tablet .esito-foto > .messaggio').first().waitFor({ timeout: 30000 });
}

/** La voce scelta in un gruppo di pulsanti, anche quando sta nel menu "Altro…"; '' se non c'è nessuna scelta. */
async function scelto(page, gruppo, n = 0) {
  const g = page.getByRole('group', { name: gruppo, exact: true }).nth(n);
  if (!(await g.count())) return '';
  const premuti = await g.getByRole('button', { pressed: true }).allTextContents();
  if (premuti.length) return premuti[0];
  const menu = g.locator('select');
  return (await menu.count()) ? menu.inputValue() : '';
}

/** I campi del modulo che una foto del tablet può riempire, letti dall'interfaccia. */
async function leggiModulo(page) {
  const valore = (etichetta) => page.getByLabel(etichetta, { exact: true }).inputValue();
  const codice = async (n) => (await page.getByRole('radiogroup', { name: 'Codice', exact: true }).nth(n)
    .getByRole('radio', { checked: true }).allTextContents())[0] ?? '';
  return {
    data: await valore('Data'), oraAllert: await valore('Ora allert.'), liberoOperativo: await valore('Libero operativo'),
    missione: await page.getByLabel(/^Missione/).inputValue(), comune: await valore('Comune'),
    mezzo: await scelto(page, 'Mezzo'), tipologia: await scelto(page, 'Tipologia'),
    codiceInvio: await codice(0), codiceRientro: await codice(1),
    patologiaInvio: await scelto(page, 'Patologia', 0), patologiaRientro: await scelto(page, 'Patologia', 1),
    luogoInvio: await scelto(page, 'Luogo', 0), luogoRientro: await scelto(page, 'Luogo', 1),
    eta: await valore('Età'), sesso: await scelto(page, 'Sesso'), esito: await scelto(page, 'Esito'), ospedale: await scelto(page, 'Ospedale'),
  };
}

/** I nomi dopo "Non letti:" nel riquadro della foto. */
async function nonLetti(page) {
  const riga = page.locator('.foto-tablet .non-letti');
  return (await riga.count()) ? (await riga.textContent()).replace(/^Non letti:\s*/, '').split(', ') : [];
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
          const voli = demo.filter((r) => isElicottero(r.mezzo) && r.id !== 'demo-0005');
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
          for (const elicottero of ['C-ECHO', 'A-ECHO']) {
            await scegli(page, 'Mezzo', elicottero);
            assert.ok(await sezioneVolo.isVisible(), `visibile per ${elicottero}`);
          }
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

        // un contesto suo: l'orologio fissato e gli interventi salvati qui non toccano le altre prove
        describe('foto tablet', () => {
          let ctx;
          let page;
          const errori = [];
          const riquadro = () => page.locator('.foto-tablet .riquadro-foto');
          const evidenziati = () => page.locator('.modulo .da-foto');
          before(async () => {
            ctx = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            page = await ctx.newPage();
            page.on('pageerror', (e) => errori.push(e.message));
            page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
            await page.goto(server.url);
            await importa(page, DEMO);
            // per tutte le prove del blocco, anche lanciate da sole: foto alle 06:15 del 31/10, allarme la sera prima
            await page.clock.setFixedTime(new Date('2026-10-31T06:15:00'));
          });
          after(async () => ctx?.close());

          test('foto tablet: modulo riempito, campi evidenziati, avviso sul Rullino', async () => {
            await vai(page, '#/nuovo');
            const tablet = await fotoFinta(ctx);
            await daFoto(page, tablet);
            assert.deepEqual(await leggiModulo(page), DAL_TABLET);
            await attendiTesto(riquadro(), 'Letti 16 campi');
            assert.ok(!(await riquadro().textContent()).includes('Non letti'));
            assert.ok(await page.getByText(RULLINO).isVisible(), 'avviso sul Rullino');
            assert.equal(await evidenziati().count(), 16);
            assert.equal(await page.locator('[data-campo="tipologia"]').count(), 1);
            assert.equal(await page.locator('[data-campo="tipologia"].da-foto').count(), 0, 'la tipologia viene dalla regola, non dalla foto');

            const intera = page.locator('dialog.foto-intera');
            await riquadro().locator('.miniatura').click();
            assert.ok(await intera.evaluate((d) => d.open), 'la foto intera si apre');
            assert.ok(await intera.locator('img').isVisible());
            await intera.click();
            assert.equal(await intera.evaluate((d) => d.open), false, 'un tocco la chiude');

            await page.getByLabel('Età').fill('42');
            assert.equal(await page.locator('[data-campo="eta"].da-foto').count(), 0, 'toccato a mano, non è più dalla foto');
            assert.equal(await evidenziati().count(), 15);

            await page.getByRole('button', { name: 'Togli foto' }).click();
            assert.equal(await riquadro().count(), 0);
            assert.equal(await page.getByLabel(/^Missione/).inputValue(), '99ZZ0042', 'i valori restano');
            assert.equal(await evidenziati().count(), 15, 'anche l\'evidenziazione');

            await daFoto(page, tablet);
            assert.equal(await evidenziati().count(), 16);
            await page.getByRole('button', { name: 'Salva intervento' }).click();
            await attendiTesto(page.locator('#toast'), '99ZZ0042 salvato');
            assert.equal(await riquadro().count(), 0, 'salvando il riquadro si chiude');
            assert.equal(await evidenziati().count(), 0);
          });

          test('foto tablet: la missione già salvata si segnala subito', async () => {
            await vai(page, '#/nuovo');
            await daFoto(page, await fotoFinta(ctx));
            await attendiTesto(riquadro(), 'La missione 99ZZ0042 è già registrata');
            await riquadro().getByRole('link', { name: 'Apri', exact: true }).click();
            await attendiTesto(page.locator('#banda h1'), 'Intervento 99ZZ0042');
            assert.equal(await page.getByLabel('Età').inputValue(), '41', 'l\'intervento salvato dalla prova precedente');
            await svuota(page);
          });

          test('foto tablet storta: nessun valore inventato', async () => {
            await svuota(page);
            await daFoto(page, await fotoFinta(ctx, { storta: true }));
            // almeno un campo letto (il riquadro compare solo così): con il solo errore la prova non direbbe nulla
            assert.equal(await riquadro().count(), 1, 'la foto storta si legge almeno in parte');
            const modulo = await leggiModulo(page);
            const mancanti = await nonLetti(page);
            for (const [chiave, atteso] of Object.entries(DAL_TABLET)) {
              const valore = modulo[chiave];
              const nome = NOME_NON_LETTO[chiave];
              // senza ora allert. la data è quella di oggi; data, tipologia, esito e ospedale non hanno un nome tra i non letti
              const nonLetto = chiave === 'data'
                ? valore === '2026-10-31' && mancanti.includes(NOMI_TABLET.oraAllert)
                : valore === '' && (!nome || mancanti.includes(nome));
              assert.ok(valore === atteso || nonLetto, `${chiave}: "${valore}" (non letti: ${mancanti.join(', ')})`);
            }
          });

          test('foto tablet: seconda foto, dopo valori della prima e valori scritti a mano', async () => {
            await svuota(page);
            const senzaComune = await fotoFinta(ctx, { indirizzo: 'STRADA DEL BOSCO' });
            await daFoto(page, await fotoFinta(ctx));
            await page.getByLabel('Età').fill('70');
            await daFoto(page, senzaComune);
            await attendiTesto(page.locator('.foto-tablet .non-letti'), 'Non letti: Comune');
            assert.equal(await page.getByLabel('Comune', { exact: true }).inputValue(), 'NOVARA', 'non letto: resta quello della prima foto');
            assert.equal(await page.locator('[data-campo="comune"].da-foto').count(), 1, 'e resta evidenziato');
            assert.equal(await page.getByLabel('Età').inputValue(), '41');
            assert.equal(await evidenziati().count(), 16);

            await page.getByLabel('Comune', { exact: true }).fill('TRECATE');
            await page.getByLabel('Età').fill('70');
            await page.getByRole('button', { name: 'Togli foto' }).click();
            await daFoto(page, senzaComune);
            await attendiTesto(page.locator('.foto-tablet .non-letti'), 'Non letti: Comune');
            assert.equal(await page.getByLabel('Comune', { exact: true }).inputValue(), 'TRECATE', 'non letto: resta quello scritto');
            assert.equal(await page.locator('[data-campo="comune"].da-foto').count(), 0);
            assert.equal(await page.getByLabel('Età').inputValue(), '41', 'letto: prende il valore della foto');
            assert.equal(await page.locator('[data-campo="eta"].da-foto').count(), 1);
            assert.equal(await evidenziati().count(), 15);
          });

          test('foto tablet: Operativo scritto piccolo, riletto dalla fila degli orari ingrandita', async () => {
            await svuota(page);
            // la lettura della foto intera non legge un orario così piccolo: lo trova la seconda lettura, sul ritaglio
            const piccolo = TABLET_FINTO.replace('</style>', '  .orari > div:last-child .ora { font-size: 16px; }\n</style>');
            await daFoto(page, await fotoFinta(ctx, { html: piccolo }));
            assert.equal(await page.getByLabel('Libero operativo', { exact: true }).inputValue(), '22:10');
            assert.equal(await page.getByLabel('Ora allert.', { exact: true }).inputValue(), '21:05');
            await attendiTesto(riquadro(), 'Letti 16 campi');
          });

          test('foto tablet: la fila degli orari si rilegge sempre, se c\'è l\'etichetta Allarme', async () => {
            // un contesto suo, che conta le letture chieste al lettore: la foto intera, poi i due ritagli della fila
            const altro = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            await altro.addInitScript(() => {
              const Originale = window.Worker;
              window.letture = 0;
              window.Worker = class extends Originale {
                postMessage(messaggio, ...resto) {
                  if (messaggio?.action === 'recognize') window.letture += 1;
                  return super.postMessage(messaggio, ...resto);
                }
              };
            });
            const qui = await altro.newPage();
            const letture = () => qui.evaluate(() => window.letture);
            await qui.goto(server.url);
            await vai(qui, '#/nuovo');
            await daFoto(qui, await fotoFinta(altro));
            // anche con tutti gli orari letti: i ritagli controllano la foto intera
            assert.equal(await letture(), 3, 'la foto intera e i due ritagli della fila degli orari');
            await attendiTesto(qui.locator('.foto-tablet .riquadro-foto'), 'Letti 16 campi');
            await svuota(qui);
            await daFoto(qui, await fotoFinta(altro, { html: TABLET_FINTO.replace('<p class="ora">21:52</p>', '<p class="ora"></p>') }));
            assert.equal(await letture(), 6);
            await attendiTesto(qui.locator('.foto-tablet .riquadro-foto'), 'Letti 14 campi');
            assert.equal(await scelto(qui, 'Esito'), '', 'nessun orario sotto Arrivo H: niente Trasportato');
            assert.equal(await qui.getByLabel('Libero operativo', { exact: true }).inputValue(), '22:10');
            await daFoto(qui, await fotoFinta(altro, { html: LISTA_SPESA }));
            assert.equal(await letture(), 7, 'senza l\'etichetta Allarme non c\'è una fila da ritagliare');
            await altro.close();
          });

          test('foto tablet: file che non si apre, foto sbagliata, lettore assente', async () => {
            await svuota(page);
            await page.getByLabel('Data', { exact: true }).fill('2026-10-15');
            await daFoto(page, Buffer.from('Una nota scritta, non una foto.'), 'nota.jpg', 'image/jpeg');
            await attendiTesto(page.locator('.foto-tablet'), 'Non riesco ad aprire questa foto: riprova con un\'altra.');
            await daFoto(page, await fotoFinta(ctx, { html: LISTA_SPESA }));
            await attendiTesto(page.locator('.foto-tablet'),
              'Non trovo i dati della schermata Missione: riprova con la foto dritta, intera e senza riflessi.');
            assert.equal(await page.getByLabel('Data', { exact: true }).inputValue(), '2026-10-15', 'il modulo non cambia');
            assert.equal(await evidenziati().count(), 0);

            const altro = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            const senzaLettore = await altro.newPage();
            await senzaLettore.route('**/vendor/tesseract-7.0.0/**', (r) => r.abort());
            await senzaLettore.goto(server.url);
            await vai(senzaLettore, '#/nuovo');
            await daFoto(senzaLettore, await fotoFinta(altro));
            await attendiTesto(senzaLettore.locator('.foto-tablet'),
              'Il lettore non è ancora disponibile: apri l\'app una volta con la rete e riprova.');
            await altro.close();
          });

          test('foto tablet: un errore a metà lettura, con il lettore caricato, non chiede di riaprire l\'app', async () => {
            // un contesto suo, dove il secondo getImageData della pagina fallisce: il primo è il ritocco della foto
            // intera, il secondo il ritaglio invertito della fila degli orari, dopo che il lettore ha già letto
            const altro = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            await altro.addInitScript(() => {
              const originale = CanvasRenderingContext2D.prototype.getImageData;
              let chiamate = 0;
              CanvasRenderingContext2D.prototype.getImageData = function getImageData(...argomenti) {
                chiamate += 1;
                if (chiamate === 2) throw new Error('Ritaglio non riuscito (prova)');
                return originale.apply(this, argomenti);
              };
            });
            const qui = await altro.newPage();
            const erroriQui = [];
            qui.on('console', (m) => { if (m.type() === 'error') erroriQui.push(m.text()); });
            await qui.goto(server.url);
            await vai(qui, '#/nuovo');
            await daFoto(qui, await fotoFinta(altro));
            await attendiTesto(qui.locator('.foto-tablet'), 'Non riesco ad aprire questa foto: riprova con un\'altra.');
            assert.equal(await qui.locator('.foto-tablet .riquadro-foto').count(), 0);
            assert.equal(await qui.getByLabel(/^Missione/).inputValue(), '', 'il modulo non cambia');
            assert.ok(erroriQui.some((t) => t.includes('Ritaglio non riuscito')), `la causa nella console: ${erroriQui.join(' | ')}`);
            await altro.close();
          });

          test('foto tablet: un Safari che non conosce imageOrientation apre la foto lo stesso', async () => {
            const altro = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            await altro.addInitScript(() => {
              const originale = window.createImageBitmap;
              window.createImageBitmap = (immagine, ...resto) => {
                if (resto.some((o) => o?.imageOrientation)) return Promise.reject(new TypeError('imageOrientation sconosciuta'));
                return originale(immagine, ...resto);
              };
            });
            const qui = await altro.newPage();
            await qui.goto(server.url);
            await vai(qui, '#/nuovo');
            await daFoto(qui, await fotoFinta(altro));
            await attendiTesto(qui.locator('.foto-tablet .riquadro-foto'), 'Letti 16 campi');
            await altro.close();
          });

          test('foto tablet: uscire durante la lettura', async () => {
            // un contesto suo, che conta i worker aperti e chiusi; il lettore resta fermo finché la prova non lo lascia
            // caricare, così si esce di sicuro a lettura in corso, anche su un computer lento
            const altro = await nuovoContesto(browser, vp, { serviceWorkers: 'block' });
            await altro.addInitScript(() => {
              const Originale = window.Worker;
              Object.assign(window, { workerAperti: 0, workerChiusi: 0 });
              window.Worker = class extends Originale {
                constructor(...argomenti) {
                  super(...argomenti);
                  window.workerAperti += 1;
                }

                terminate() {
                  window.workerChiusi += 1;
                  return super.terminate();
                }
              };
            });
            const qui = await altro.newPage();
            const erroriQui = [];
            qui.on('pageerror', (e) => erroriQui.push(e.message));
            qui.on('console', (m) => { if (m.type() === 'error') erroriQui.push(m.text()); });
            let lascia;
            const lasciato = new Promise((risolvi) => { lascia = risolvi; });
            await qui.route('**/vendor/tesseract-7.0.0/tesseract.min.js', async (r) => {
              await lasciato;
              await r.continue();
            });
            const contatori = () => qui.evaluate(() => [window.workerAperti, window.workerChiusi]);
            const missione = () => qui.getByLabel(/^Missione/).inputValue();
            const riquadroQui = () => qui.locator('.foto-tablet .riquadro-foto');
            await qui.goto(server.url);
            await vai(qui, '#/nuovo');
            await scegliFoto(qui, await fotoFinta(altro));
            await attendiTesto(qui.locator('.foto-tablet > .bottone'), 'Leggo la foto');
            assert.deepEqual(await contatori(), [0, 0], 'la lettura aspetta ancora il lettore');
            await vai(qui, '#/elenco');
            await vai(qui, '#/nuovo');
            lascia();
            // il lettore arriva dopo l'uscita: si apre e si chiude, senza leggere la foto per un modulo che non c'è più
            await qui.waitForFunction(() => window.workerAperti === 1 && window.workerChiusi === 1, null, { timeout: 30000 });
            assert.equal(await riquadroQui().count(), 0);
            assert.equal(await missione(), '');
            await vai(qui, '#/elenco');
            await vai(qui, '#/nuovo'); // il modulo riparte dalla bozza: nemmeno lì c'è un valore letto
            assert.equal(await missione(), '');
            assert.equal(await riquadroQui().count(), 0);
            assert.deepEqual(await contatori(), [1, 1], 'nessun worker lasciato aperto');
            assert.deepEqual(erroriQui, [], 'nessun errore nella pagina');
            await altro.close();
            assert.deepEqual(errori, [], 'nessun errore nemmeno nelle altre prove della foto');
          });
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
      assert.equal(nomeFile, 'interventi118_Mac.json', 'nome fisso per dispositivo');

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
      assert.equal(nome, 'interventi118_Mac.xlsx', 'nome fisso per dispositivo');
      const intestazione = readFileSync(file).subarray(0, 2).toString();
      assert.equal(intestazione, 'PK', 'file .xlsx (zip)');
      await ctx.close();
    });

    test('copia con data accanto al backup con nome fisso; istruzioni per Safari', async () => {
      const ctx = await nuovoContesto(browser, VIEWPORT[0], { serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.goto(server.url);
      await importa(page, DEMO);
      await attendiTesto(page.locator('.blocco').first(), 'Chiedi per ogni download');
      const nome = await esporta(page, 'Esporta copia con data', join(cartellaFile, `${nomeBrowser}-datata.json`));
      assert.match(nome, /^interventi118_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
      await attendiTesto(page.locator('#toast'), 'Backup scaricato');
      await ctx.close();
    });

    if (nomeBrowser === 'chromium') test('Chrome: la finestra di salvataggio si apre la prima volta, poi il file ricordato si riscrive da solo', async () => {
      const ctx = await nuovoContesto(browser, VIEWPORT[1], { serviceWorkers: 'block', finestraSalvataggio: true });
      // finestra finta che restituisce un file vero dell'archivio privato del browser (si salva in IndexedDB come quello scelto dall'utente)
      await ctx.addInitScript(() => {
        window.showSaveFilePicker = async ({ suggestedName }) => {
          localStorage.setItem('finestre', String(Number(localStorage.getItem('finestre') ?? 0) + 1));
          const cartella = await navigator.storage.getDirectory();
          return cartella.getFileHandle(suggestedName, { create: true });
        };
      });
      const page = await ctx.newPage();
      await page.goto(server.url);
      await importa(page, DEMO);
      await attendiTesto(page.locator('.blocco').first(), 'le volte dopo l\'app lo riscrive lì da sola');
      const finestre = () => page.evaluate(() => Number(localStorage.getItem('finestre') ?? 0));
      const contenuto = () => page.evaluate(async () => {
        const file = await (await navigator.storage.getDirectory()).getFileHandle('interventi118_Mac.json');
        return JSON.parse(await (await file.getFile()).text());
      });
      await page.getByRole('button', { name: 'Esporta backup' }).click();
      await attendiTesto(page.locator('#toast'), 'Backup salvato');
      assert.equal(await finestre(), 1);
      assert.equal((await contenuto()).record.length, demo.length);
      await nuovoIntervento(page, { missione: 'E2EC0001', comune: 'BIELLA' });
      await page.getByRole('button', { name: 'Salva intervento' }).click();
      await attendiTesto(page.locator('#toast'), 'E2EC0001 salvato');
      await page.reload();
      await vai(page, '#/impostazioni');
      await page.getByRole('button', { name: 'Esporta backup' }).click();
      await attendiTesto(page.locator('#toast'), 'Backup salvato');
      assert.equal(await finestre(), 1, 'la seconda volta niente finestra');
      assert.equal((await contenuto()).record.length, demo.length + 1, 'il file ricordato è stato riscritto');
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

    for (const vp of VIEWPORT) test(`foto tablet offline, ${vp.nome} px`, async () => {
      const ctx = await nuovoContesto(browser, vp);
      const page = await ctx.newPage();
      await page.goto(server.url);
      await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()?.then((r) => r?.active)), null, { timeout: 10000 });
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
      // il lettore è nella sua cache: i tre file fissi e la variante del core per questo browser
      await page.waitForFunction(async () => (await (await caches.open('lettore-testo-7.0.0')).keys()).length === 4, null, { timeout: 30000 });
      await ctx.setOffline(true);
      await page.reload();
      await attendiTesto(page.locator('#banda h1'), 'Nuovo intervento');
      await daFoto(page, await fotoFinta(ctx));
      assert.equal(await page.getByLabel(/^Missione/).inputValue(), '99ZZ0042');
      if (foto) await scattaSchermata(page, `${vp.nome}-foto-tablet`, { inCima: true });
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
