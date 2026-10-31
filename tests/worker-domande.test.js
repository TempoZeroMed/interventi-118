import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaGestore, MODELLI, PROMPT_SISTEMA } from '../worker/domande.js';

const QUERY = {
  tipo: 'query', interpretazione: 'Interventi per ora del giorno', misura: 'interventi', gruppi: ['ora'], filtri: [],
  periodo: null, confronto: null, ordine: 'max', primi: 1,
};
const PAROLA = 'cavallo batteria graffetta';
const ENV = { PAROLA_ORDINE: PAROLA, CHIAVE_ANTHROPIC: 'k', ASSETS: { fetch: async () => new Response('asset') } };
const CORPO = {
  parolaOrdine: PAROLA, domanda: 'Qual è l\'ora in cui esco di più?', oggi: '2026-10-30',
  liste: { ospedale: ['Biella', 'Ospedale Inventato'], mezzo: ['3030'] }, comuni: ['Cirié Inventato', 'Biella'],
};

/** Claude finto: risponde con i testi indicati, uno per chiamata, e registra le richieste. */
function claudeFinto(...risposte) {
  const chiamate = [];
  const fetchAnthropic = async (url, opzioni) => {
    chiamate.push({ url, opzioni, corpo: JSON.parse(opzioni.body) });
    const r = risposte[Math.min(chiamate.length - 1, risposte.length - 1)];
    if (r instanceof Error) throw r;
    if (typeof r === 'number') return new Response(JSON.stringify({ type: 'error' }), { status: r });
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: r }] }), { status: 200 });
  };
  return { fetchAnthropic, chiamate };
}

const richiesta = (corpo, { metodo = 'POST', percorso = '/api/domanda' } = {}) => new Request(`https://liberoeoperativo.example${percorso}`, {
  method: metodo, headers: { 'content-type': 'application/json' }, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
});
const leggi = async (risposta) => ({ stato: risposta.status, corpo: await risposta.json() });

test('le altre richieste vanno ai file statici, senza chiamare Claude', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const gestisci = creaGestore({ fetchAnthropic });
  const risposta = await gestisci(new Request('https://liberoeoperativo.example/index.html'), ENV);
  assert.equal(await risposta.text(), 'asset');
  const get = await gestisci(new Request('https://liberoeoperativo.example/api/domanda'), ENV);
  assert.equal(await get.text(), 'asset');
  assert.equal(chiamate.length, 0);
});

test('parola d\'ordine assente o sbagliata: 401 senza chiamare Claude', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const gestisci = creaGestore({ fetchAnthropic, attesa: async () => {} });
  const senza = await leggi(await gestisci(richiesta({ ...CORPO, parolaOrdine: undefined }), ENV));
  assert.equal(senza.stato, 401);
  assert.match(senza.corpo.errore, /Parola d'ordine errata/);
  assert.equal((await gestisci(richiesta({ ...CORPO, parolaOrdine: 'sbagliata' }), ENV)).status, 401);
  assert.equal((await gestisci(richiesta({}), ENV)).status, 401);
  assert.equal(chiamate.length, 0);
});

test('parola sbagliata: la risposta arriva dopo un secondo, quella giusta subito', async () => {
  const { fetchAnthropic } = claudeFinto(JSON.stringify(QUERY));
  const attese = [];
  const gestisci = creaGestore({ fetchAnthropic, attesa: async (ms) => { attese.push(ms); } });
  assert.equal((await gestisci(richiesta({ ...CORPO, parolaOrdine: 'tentativo' }), ENV)).status, 401);
  assert.deepEqual(attese, [1000]);
  assert.equal((await gestisci(richiesta(CORPO), ENV)).status, 200);
  assert.deepEqual(attese, [1000], 'nessuna attesa con la parola giusta');
});

test('parola d\'ordine su Cloudflare troppo corta: 503 senza chiamare Claude', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const corta = { ...ENV, PAROLA_ORDINE: 'undici cara' };
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta({ ...CORPO, parolaOrdine: 'undici cara' }), corta));
  assert.equal(stato, 503);
  assert.match(corpo.errore, /almeno 12 caratteri/);
  assert.equal(chiamate.length, 0);
});

test('parola d\'ordine su Cloudflare di 12 caratteri: accettata', async () => {
  const { fetchAnthropic } = claudeFinto(JSON.stringify(QUERY));
  const giusta = { ...ENV, PAROLA_ORDINE: 'mela sole re' };
  const { stato } = await leggi(await creaGestore({ fetchAnthropic })(richiesta({ ...CORPO, parolaOrdine: 'mela sole re' }), giusta));
  assert.equal(stato, 200);
});

test('richiesta troppo grande: 400 senza chiamare Claude', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const enorme = { ...CORPO, liste: { ospedale: Array(1000).fill('x'.repeat(100)) } };
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(enorme), ENV));
  assert.equal(stato, 400);
  assert.match(corpo.errore, /troppo grande/);
  assert.equal(chiamate.length, 0);
});

test('voci e comuni lunghi arrivano a Claude accorciati a 200 caratteri', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const lunghi = { ...CORPO, liste: { ospedale: ['A'.repeat(500)] }, comuni: ['B'.repeat(500)] };
  assert.equal((await creaGestore({ fetchAnthropic })(richiesta(lunghi), ENV)).status, 200);
  const { system } = chiamate[0].corpo;
  assert.ok(system.includes('A'.repeat(200)) && !system.includes('A'.repeat(201)));
  assert.ok(system.includes('B'.repeat(200)) && !system.includes('B'.repeat(201)));
});

test('servizio senza segreti: 503 con un messaggio chiaro', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), { ASSETS: ENV.ASSETS }));
  assert.equal(stato, 503);
  assert.match(corpo.errore, /non è ancora configurato/);
  assert.equal(chiamate.length, 0);
});

test('corpo non valido: 400 senza chiamare Claude', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(JSON.stringify(QUERY));
  const gestisci = creaGestore({ fetchAnthropic });
  assert.equal((await gestisci(richiesta('non json'), ENV)).status, 400);
  assert.equal((await gestisci(richiesta({ ...CORPO, domanda: 'x'.repeat(501) }), ENV)).status, 400);
  assert.equal((await gestisci(richiesta({ ...CORPO, domanda: '   ' }), ENV)).status, 400);
  assert.equal((await gestisci(richiesta({ ...CORPO, oggi: '30/10/2026' }), ENV)).status, 400);
  assert.equal((await gestisci(richiesta({ ...CORPO, comuni: Array(2001).fill('X') }), ENV)).status, 400);
  assert.equal((await gestisci(richiesta({ ...CORPO, liste: { ospedale: Array(2001).fill('X') } }), ENV)).status, 400);
  assert.equal(chiamate.length, 0);
});

test('domanda valida: Haiku traduce, il Worker estrae e valida la query', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto(`Ecco la query: ${JSON.stringify(QUERY)}`);
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV));
  assert.equal(stato, 200);
  assert.deepEqual(corpo, { ...QUERY, modello: 'claude-haiku-5-5' });
  assert.equal(chiamate.length, 1);
  const [{ url, opzioni, corpo: inviato }] = chiamate;
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(opzioni.headers['x-api-key'], 'k');
  assert.equal(opzioni.headers['anthropic-version'], '2023-06-01');
  assert.equal(inviato.model, MODELLI[0]);
  assert.ok(inviato.system.startsWith(PROMPT_SISTEMA));
  for (const atteso of ['2026-10-30', 'Ospedale Inventato', 'Cirié Inventato']) assert.ok(inviato.system.includes(atteso), atteso);
  assert.deepEqual(inviato.messages, [{ role: 'user', content: CORPO.domanda }]);
  assert.equal('temperature' in inviato, false);
});

test('risposta non conforme: secondo tentativo con Sonnet', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto('{"tipo":"query","misura":"velocita"}', JSON.stringify(QUERY));
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV));
  assert.equal(stato, 200);
  assert.equal(corpo.modello, 'claude-sonnet-5-5');
  assert.deepEqual(chiamate.map((c) => c.corpo.model), MODELLI);
});

test('due risposte non conformi: 502', async () => {
  const { fetchAnthropic, chiamate } = claudeFinto('niente JSON', '{"tipo":"query"}');
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV));
  assert.equal(stato, 502);
  assert.equal(corpo.errore, 'Non sono riuscito a tradurre la domanda.');
  assert.equal(chiamate.length, 2);
});

test('Claude occupato o irraggiungibile: 502 con un messaggio in italiano', async () => {
  for (const guasto of [429, 529, new TypeError('rete')]) {
    const { fetchAnthropic } = claudeFinto(guasto);
    const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV));
    assert.equal(stato, 502, String(guasto));
    assert.match(corpo.errore, /Riprova/);
  }
});

test('Claude troppo lento: 504', async () => {
  const lento = Object.assign(new Error('scaduto'), { name: 'TimeoutError' });
  const { fetchAnthropic } = claudeFinto(lento);
  assert.equal((await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV)).status, 504);
});

test('controdomanda: il secondo giro porta domanda, controdomanda e risposta, e non ne ammette un\'altra', async () => {
  const controdomanda = { testo: 'Intendi l\'ora di allertamento o quella di libero operativo?', risposta: 'allertamento' };
  const altra = JSON.stringify({ tipo: 'controdomanda', testo: 'Sei sicuro?' });
  const { fetchAnthropic, chiamate } = claudeFinto(altra, JSON.stringify(QUERY));
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta({ ...CORPO, controdomanda }), ENV));
  assert.equal(stato, 200);
  assert.equal(corpo.tipo, 'query');
  assert.equal(chiamate.length, 2, 'la seconda controdomanda non vale: si riprova');
  const messaggio = chiamate[0].corpo.messages[0].content;
  for (const atteso of [CORPO.domanda, controdomanda.testo, controdomanda.risposta]) assert.ok(messaggio.includes(atteso), atteso);
});

test('primo giro: la controdomanda di Claude arriva all\'app', async () => {
  const altra = { tipo: 'controdomanda', testo: 'Intendi l\'ora di allertamento?' };
  const { fetchAnthropic } = claudeFinto(JSON.stringify(altra));
  const { stato, corpo } = await leggi(await creaGestore({ fetchAnthropic })(richiesta(CORPO), ENV));
  assert.equal(stato, 200);
  assert.deepEqual(corpo, { ...altra, modello: 'claude-haiku-5-5' });
});
