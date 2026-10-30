# Foto del tablet – decisioni e contesto (per un altro agente)

Data: 2026-10-30. Scritto alla fine della sessione di domande con l'utente, per chi deve rivedere o realizzare la
funzione senza aver letto la conversazione.

**Stato**: decisioni confermate dall'utente; specifica scritta in
[2026-10-30-foto-tablet-design.md](2026-10-30-foto-tablet-design.md), rivista con un processo simulato (capitolo 6) e
corretta su un punto e **approvata per iscritto** dall'utente; piano in `docs/superpowers/plans/2026-10-30-foto-tablet.md`. Nessun codice scritto, nessun commit. I due documenti non
sono ancora nel repository (file non tracciati).

Questo documento raccoglie il **perché** di ogni scelta: la richiesta, i fatti verificati, le alternative scartate, le
cose dedotte senza chiedere e i rischi. Il **cosa** dettagliato (regole campo per campo, file toccati, test) è nella
specifica. Dove i due documenti sembrano dire cose diverse, vale la specifica.

## 1. La richiesta

L'utente lavora sui mezzi di soccorso del 118 (Piemonte, zona Novara). Durante la missione usa un tablet con l'app
**SaveOnBoard**; dopo, registra l'intervento nella PWA di questo repository ("Libero Operativo").

Vuole un pulsante **"Foto tablet"**: scatta una foto della schermata del tablet, l'app legge le informazioni e
precompila parte della scheda, poi l'utente conferma a mano.

Regole date dall'utente, da rispettare alla lettera:

1. **Tipologia India/Mike**: tutti i mezzi sono Mike, tranne 5022, 5024 e 3040 (India). La 3050 è Mike dalle 08:00
   alle 20:00 e India negli altri orari; la 6021 è Mike dalle 20:00 alle 08:00 e India negli altri orari.
2. **Missione**: sul tablet c'è sempre un suffisso "/1", "/2", "/3", "/4"…: si salva solo la parte prima della barra.
3. **Mezzo**: sul tablet compare come "N0" + 4 cifre: si tengono solo le 4 cifre, che corrispondono alle voci già
   nella lista dei mezzi.
4. **Età**: la riga "Data di nascita" in realtà mostra l'età ("N anni"), sempre con **un anno in meno** (il tablet
   considera il compleanno non ancora passato): si salva N + 1.
5. **Codice**: il codice in alto (es. "V 09 L") di solito è quello di rientro, ma non sempre viene aggiornato. Va
   messo **sia nell'invio sia nel rientro**; l'utente lo corregge a mano se serve.
6. **Orari**: quelli che contano sono **Allarme** e **Operativo**.

## 2. Il progetto (fatti verificati nel codice)

- PWA statica in JavaScript (moduli ES, nessuna compilazione, nessun backend, nessuna dipendenza npm). Funzioni pure
  in `js/core/`, DOM in `js/ui/`. Nomi, commenti e testi in italiano.
- Dati in IndexedDB (`js/db.js`), stato in `js/stato.js`. Backup JSON tra iPhone e Mac con merge (`js/core/merge.js`).
- Offline: `sw.js` cache-first con la costante `VERSIONE` (ora `interventi118-v1.2.0`) e l'elenco `FILE`; a ogni
  modifica dei file dell'app si aggiorna `VERSIONE`. `tests/pwa.test.js` controlla che ogni file di `js/`, `css/`,
  `vendor/*.js` e `icons/` sia nell'elenco: con la cache separata del lettore il test va adattato.
- Librerie esterne copiate in `vendor/` (Chart.js 4.5.1, SheetJS 0.20.3) e caricate al primo uso con
  `caricaScript()` di `js/ui/file.js`.
- Modulo di inserimento: `js/ui/inserimento.js`, un solo form per nuovo intervento e modifica. Ogni modifica passa da
  `cambia()` → `impostaCampo()` di `js/core/modulo.js`. Il nuovo intervento salva una **bozza** in automatico
  (`impostaMeta({ bozza })`) dopo 400 ms.
- Campi del record (`js/core/campi.js`, `CAMPI`): data, oraAllert, missione, comune, mezzo, tipologia, codiceInvio,
  patologiaInvio, luogoInvio, eta, sesso, esito, ospedale, codiceRientro, patologiaRientro, luogoRientro,
  liberoOperativo, tipoMissione, tempoVolo (+ manovre). Liste predefinite in `VOCI`; voci bloccate in `SISTEMA`.
- Regole già presenti:
  - `MEZZI_SOLO_INDIA = ['3040', '5022', '5024']` in `js/core/controlli.js`; `impostaCampo` mette India quando si
    sceglie uno di questi mezzi; l'avviso "Mezzo solo India" compare se sono Mike. Oggi nessun altro mezzo riceve una
    tipologia automatica.
  - "Missione non di 8 caratteri" è un avviso: la missione è sempre di 8 caratteri.
  - Missione duplicata: `verificaSalvataggio` blocca il salvataggio e il form mostra "La missione … è già registrata"
    con il link al duplicato.
  - Scegliendo un esito diverso da "Trasportato" l'ospedale si svuota.
  - `durataMinuti(oraAllert, liberoOperativo)` conta oltre la mezzanotte.
- Lista mezzi: 3030, 3040, 3050, 3080, 5021, 5022, 5023, 5024, 5035, 5085, 6001, 6021, 6022, 6023, 7045, 7046, 7047,
  7049, 7050, V-ECHO, T-ECHO, C-ECHO, A-ECHO. Codici: VERDE, GIALLO, ROSSO (+ NERO nel rientro). Patologie "01 - Trauma",
  "02 - Cardio"… Luoghi "K - Casa", "S - Sierra", "L - Lavoro", "P - Pubblico", "Q - Scuola", "Y - Sportivo",
  "Z - Altro". Sesso Maschio/Femmina.
- Dati reali locali (esclusi da git, `data/interventi_import.json`, 212 interventi): nessuna 3050 o 6021; India solo su
  3040, 5022, 5024; i 13 voli in elicottero sono tutti Mike. La regola dell'utente è coerente con i dati.
- Test: `npm test` (`node --test`, unitari), `npm run e2e` (Playwright installato fuori dal progetto, Chromium e
  WebKit, server `tools/server_sviluppo.py`).
- Pubblicazione: `npm run pubblica` (`tools/pubblica.sh`) dal Mac, da `main` pulito; pubblica con `git archive` solo
  `index.html manifest.webmanifest sw.js css js vendor icons` su Cloudflare (Worker `liberoeoperativo`) e controlla che
  i file privati rispondano 404.

## 3. La schermata del tablet

Descritta dalla foto di esempio dell'utente; i valori qui sotto sono **inventati**.

- **Barra di stato** (in alto): ora e data **del tablet**, cioè del momento della foto, non dell'intervento.
- **Testata**: "SaveOnBoard | Missione in corso: 04ZZ1234/2". A destra tre riquadri: "In Uscita: 0", il mezzo
  "N03030", lo stato "Operativo" (è lo stato del mezzo, non l'orario).
- **TARGET**: indirizzo in rosso "VIA DELLE PROVE, 12 NOVARA", sotto "SCALA --, PIANO 2" e "Chiamante: …".
- **VALUTAZIONE**: un riquadro colorato con il codice "V 09 L" (lettera del colore, numero della patologia, lettera del
  luogo), poi le righe Coscienza, Respiro, Motilità, Emorragia, Dolore, Durata, **Sesso** (M/F), **Data di nascita**
  (in realtà "N anni").
- **OSPEDALE**: un riquadro di testo. L'ospedale sul tablet può restare vuoto anche quando la missione ha un trasporto:
  spesso non è compilato.
- **Fila degli orari** (in basso): Allarme, Partenza, Arrivo, Partenza H, Arrivo H, Operativo, ognuno con etichetta e
  orario `hh:mm`. Nella foto Arrivo, Partenza H e Arrivo H avevano lo sfondo blu con il testo bianco; gli altri sfondo
  chiaro con il testo scuro. A destra i pulsanti "Effettuata" e "Parcheggia".
- La foto di esempio è presa di traverso, con riflessi, il tablet nella custodia e un cavo attaccato: le foto vere
  saranno così.

## 4. Prova di lettura (fatti)

Tesseract.js 5.1.1 e 7.0.0 in Node, lingue ita + eng, foto ridotta a 2000 px di lato lungo, **nessun ritocco**:

- circa 3 secondi sul Mac (3,5 con la 5.1.1, 3,1 con la 7.0.0); stesso testo letto dalle due versioni;
- letti giusti: il codice missione con la barra, il mezzo, il codice (con lo spazio mancante tra numero e lettera),
  l'indirizzo con il comune, il sesso, l'età, gli orari Allarme e Partenza;
- letti male: gli orari bianchi su blu (Arrivo, Partenza H, Arrivo H, solo in parte) e **l'Operativo** (illeggibile);
- il resto della foto (custodia, tavolo, cavo) produce righe di caratteri a caso, da ignorare;
- l'avviso "failed to load ./ita.special-words" è innocuo.

Pesi: `worker.min.js` 124 KB, `tesseract.min.js` 67 KB, un core LSTM `.wasm.js` circa 3,9 MB, `ita.traineddata`
3,1 MB non compresso (il `.gz` pesa meno). Totale per dispositivo circa 6 MB. La 7.0.0 ha in più le varianti
"relaxedsimd" del core.

La foto di esempio è nella cartella Download dell'utente (`IMG_0387.HEIC`, HEIC: va convertita in JPEG, per esempio con
`sips`, in una cartella temporanea fuori dal progetto). **Contiene dati reali** (codice missione, indirizzo, età e
sesso del paziente).

## 5. Decisioni confermate dall'utente

Le domande sono state fatte una alla volta, con un'opzione consigliata.

| # | Decisione | Alternativa scartata | Perché |
|---|---|---|---|
| 1 | Regola India/Mike **anche nell'inserimento a mano**, non solo dalla foto | solo dalla foto | una sola regola, ovunque |
| 2 | **Lettura sul dispositivo** con Tesseract.js | foto a Claude tramite un Worker Cloudflare con chiave API | privacy dei dati sanitari (indirizzo, età, sesso), funziona offline, nessun costo; la precisione minore è coperta dalla conferma a mano |
| 3 | **Nessun avviso** se 3050 o 6021 hanno la tipologia fuori orario | un avviso nuovo come "Mezzo solo India" | scelta dell'utente (era stato consigliato l'avviso) |
| 4 | **Data**: oggi, oppure ieri se l'ora di allarme è più avanti dell'ora attuale | sempre oggi | la foto si scatta spesso dopo la mezzanotte, per missioni iniziate la sera prima |
| 5 | **Esito "Trasportato"** se c'è un orario in Arrivo H; **ospedale** solo se il testo corrisponde a una voce della lista | lasciarli sempre vuoti | meno tocchi; l'ospedale del tablet spesso manca |
| 6 | **Conferma nel modulo normale**, con i campi letti evidenziati e la foto in alto | una schermata di riepilogo prima del modulo | un passaggio in meno |
| 7 | Pulsante **solo nel "Nuovo intervento"**; i valori letti sostituiscono quelli presenti | anche in modifica, riempiendo solo i campi vuoti | semplicità |
| 8 | Sull'iPhone il **menu "Scatta foto" / "Libreria foto"**, con un **avviso fisso** nel riquadro: una foto presa dalla libreria resta nel Rullino e va cancellata a mano (avviso aggiunto dopo la revisione) | aprire subito la fotocamera (`capture`), accettando solo foto scattate dal pulsante | si può usare anche una foto fatta prima, per esempio in ambulanza; l'app non può cancellare una foto del Rullino, quindi lo dice |
| 9 | **L'app non salva la foto** (né intervento, né bozza, né backup) | allegarla all'intervento | privacy e peso dei backup |
| 10 | Tesseract **scaricato con l'app** e tenuto offline | scaricarlo al primo uso | deve funzionare anche senza rete dalla prima foto |
| 11 | **Missione già in archivio**: avviso subito, con "Apri" | accorgersene solo al salvataggio | si evita di compilare un doppione |
| 12 | Il riepilogo complessivo delle decisioni | – | confermato dall'utente prima di scrivere la specifica |

## 6. Revisione con un processo simulato

Il 2026-10-30 questo documento e la specifica sono stati messi "a processo" con la skill `/court`: un'accusa, una
difesa e 12 giurati (agenti separati che hanno letto solo i due documenti), poi un giudice.

- **Verdetto**: non colpevole, 8 a 4: il piano va avanti, con correzioni.
- **Accuse che hanno retto**: nessuna prova sull'iPhone; Operativo illeggibile, ritocco non provato e nessun punto in
  cui fermarsi; un orario letto storto ma valido passa i controlli.
- **Condizioni del giudice e scelta dell'utente**:
  1. una prova vincolante del ritocco su iPhone, con una soglia scritta su Allarme e Operativo, prima di aggiungere
     Tesseract e toccare il service worker: **l'utente ha scelto di non aggiungerla**;
  2. una prova su altre foto vere, separate da quella usata per tarare il ritocco: **l'utente ha scelto di non aggiungerla**;
  3. dire chiaramente che una foto presa dalla "Libreria foto" resta nel Rullino: **accolta**, con l'avviso fisso nel
     riquadro della foto (decisione 8).
- Non riproporre le condizioni 1 e 2 senza un motivo nuovo: l'utente ha scelto di non aggiungerle. I rischi che descrivono restano nel capitolo 9.
- Punto su cui il fascicolo taceva: se il servizio 118 permette di fotografare lo schermo di SaveOnBoard. È una
  questione dell'utente, non del codice.

## 7. Dedotto senza chiedere (da controllare)

Scelte fatte da chi ha scritto la specifica, sulla base del codice o dei dati, non chieste all'utente:

- **Missione di 8 caratteri**: lo impone già l'avviso dell'app; con un formato diverso il campo non si riempie.
- **Elicotteri Mike**: rientrano in "tutti gli altri"; i dati esistenti lo confermano.
- **Confini degli orari**: 3050 Mike dalle 08:00 alle 19:59, India dalle 20:00; 6021 il contrario. Conta l'ora allert.
- **Ricalcolo della tipologia**: sempre quando si cambia mezzo; quando si cambia l'ora allert., solo per 3050 e 6021,
  così una scelta fatta a mano su un altro mezzo non viene toccata. Con il mezzo svuotato la tipologia resta com'era;
  per 3050 e 6021 senza ora allert. resta vuota.
- **3050 e 6021 diventano voci di sistema** (non rinominabili), come 3040, 5022, 5024: la regola si basa sul nome.
- **Gli interventi già salvati non cambiano**: nessuna correzione automatica dell'archivio.
- **Comune**: il testo dopo il numero civico; senza civico, un comune già usato nell'archivio con cui finisce
  l'indirizzo; altrimenti vuoto.
- **Codice**: V/G/R → VERDE/GIALLO/ROSSO; altre lettere lasciano il codice vuoto. Patologia e luogo cercati per
  numero e lettera iniziale tra le voci della lista.
- **Età**: solo la forma "N anni"; date o mesi non vengono letti.
- **Mezzo e ospedale**: accettati solo se sono voci della lista (anche disattivate).
- **Valori non validi**: restano vuoti e finiscono tra i "non letti", mai un valore indovinato.
- **Ordine di inserimento** nel modulo: data, ora allert., libero operativo, missione, comune, mezzo, codici,
  patologie, luoghi, età, sesso, esito, ospedale (la tipologia deve trovare l'ora già inserita).
- **Tesseract 7.0.0**, solo motore LSTM, solo lingua italiana, `cacheMethod: 'none'`.
- **Cache separata** `lettore-testo-7.0.0`, che sopravvive agli aggiornamenti dell'app; il service worker mette in
  cache una sola variante del core, scelta con la stessa verifica di WebAssembly che usa Tesseract.
- **Versione dell'app** 1.3.0.
- **Test** con una pagina finta della schermata del tablet (dati inventati) fotografata da Playwright; la prova sulla
  foto vera solo sul Mac, con la variabile `FOTO_TABLET`, senza scrivere nulla.
- **Fuori da questo lavoro**: altre schermate del tablet, orari di partenza e arrivo come campi nuovi, il pulsante in
  modifica, servizi di lettura esterni.

## 8. Vincoli da rispettare

- **Privacy**: il repository GitHub (`TempoZeroMed/interventi-118`) è **pubblico**. Nessun dato reale nei file
  tracciati: niente foto vera, niente valori letti dalla foto vera, niente schermate con dati veri. Prima di ogni push si
  cercano codici missione reali nei file tracciati. Il branch locale `archivio-storia-locale` non va mai pubblicato.
- **Pubblicazione**: solo con `npm run pubblica`, mai `wrangler` lanciato dalla cartella del progetto (una volta ha
  pubblicato per un minuto i dati reali). Prima di pubblicare si mostra all'utente l'indirizzo esatto
  (`https://liberoeoperativo.wolftux.workers.dev`) e si chiede.
- **Commit e push** solo con l'ok dell'utente.
- **Domande all'utente**: una alla volta, con l'opzione consigliata per prima.
- **Stile**: come il codice intorno (italiano, funzioni pure in `core/`, nessuna dipendenza npm nel progetto, Python
  solo con la libreria standard). Aggiornare `VERSIONE` in `sw.js`.

## 9. Rischi e punti aperti

- **Operativo letto male** nella prova senza ritocco: è uno dei due orari che contano. Il piano deve provare il ritocco
  (contrasto, ritaglio della fila degli orari, ingrandimento, riquadri scuri invertiti) sulla foto vera prima di tutto
  il resto. Se resta inaffidabile, il campo rimane vuoto e si scrive a mano.
- **Safari su iPhone**: memoria con foto da 12 MP (ridurle prima della lettura), supporto di WebAssembly SIMD
  (iOS 16.4+), il worker di Tesseract servito dal service worker anche offline, e la variante del core scelta dal
  service worker che deve coincidere con quella che chiede Tesseract. Da verificare con gli e2e in WebKit e poi
  sull'iPhone vero.
- **Peso**: circa 6 MB in più al primo aggiornamento di ogni dispositivo.
- **SaveOnBoard può cambiare schermata** con un aggiornamento: la lettura si basa sulle etichette ("Missione in corso",
  "Allarme", "Operativo", "Sesso", "anni"…), quindi un cambio di etichette la rompe. I test con letture inventate lo
  rendono evidente.
- **Lettere non previste nel codice** (per esempio un eventuale bianco): il codice resta vuoto.
- **Bozza**: i valori letti finiscono nella bozza salvata in automatico (come quelli scritti a mano); l'evidenziazione
  no, quindi si perde riaprendo l'app.

## 10. Prossimi passi

1. L'utente approva (o corregge) la specifica.
2. Piano di lavoro dettagliato (skill `superpowers:writing-plans`), poi la scelta di come eseguirlo.
3. Realizzazione con i test prima del codice, revisione, documenti e schermate con dati inventati, versione 1.3.0.
4. Commit, push e pubblicazione solo con l'ok dell'utente.
