# Interventi 118

Registro personale delle uscite 118 in ambulanza ed elisoccorso. Sostituisce il file
`Report Interventi 118 2026 v3.xlsx` e, per le missioni in elicottero, la parte di volo di `Report Voli HEMS 2026.xlsx`:

- inserimento rapido da iPhone, con una mano, anche da una foto della schermata "Missione" del tablet;
- elenco con ricerca e filtri;
- statistiche identiche a quelle dei fogli Excel, compresi tempo di volo e manovre.

È una app web installabile (PWA): dopo il primo caricamento funziona anche senza rete.
**I dati restano solo sul dispositivo.** Nessun account, nessun server, nessuna statistica d'uso. I dati escono solo quando esporti un file.

| Inserimento | Elenco | Statistiche |
|---|---|---|
| ![Inserimento](docs/screenshots/390-inserimento.png) | ![Elenco](docs/screenshots/390-elenco.png) | ![Statistiche](docs/screenshots/390-statistiche.png) |

Gli screenshot usano dati inventati.

---

## Indice

1. [Avvio in locale](#avvio-in-locale)
2. [Primo import dei dati dall'Excel](#primo-import-dei-dati-dallexcel)
3. [Volo ed elisoccorso](#volo-ed-elisoccorso)
4. [Foto del tablet](#foto-del-tablet)
5. [Tipologia India/Mike](#tipologia-indiamike)
6. [Pubblicazione su Cloudflare Pages](#pubblicazione-su-cloudflare-pages)
7. [Installazione su iPhone](#installazione-su-iphone)
8. [Backup e passaggio dei dati tra Mac e iPhone](#backup-e-passaggio-dei-dati-tra-mac-e-iphone)
9. [Test](#test)
10. [Come sono calcolate le statistiche](#come-sono-calcolate-le-statistiche)
11. [Struttura del progetto](#struttura-del-progetto)
12. [Limiti noti](#limiti-noti)

---

## Avvio in locale

Serve solo **Python 3**, già presente su macOS. Per i test serve anche **Node.js 24** o superiore.

```bash
python3 tools/server_sviluppo.py
```

Apri <http://localhost:8118/> in Safari.

Il server di sviluppo non usa cache, quindi ogni ricarica prende i file appena modificati.
L'app però registra un *service worker*, che conserva i file per l'uso offline. Se dopo una modifica vedi ancora la versione vecchia, ricarica due volte. In alternativa, da Safari apri Sviluppo → Svuota cache.

Per provare l'app con dati inventati, crea il file demo (90 interventi finti):

```bash
node tools/genera_demo.mjs
```

Poi caricalo da **Impostazioni → Importa backup** scegliendo `tests/fixtures/demo.json`.

---

## Primo import dei dati dall'Excel

I 212 interventi del 2026 si portano nell'app con uno script. Usa solo Python, senza librerie da installare, e non modifica mai il file Excel:

```bash
python3 tools/xlsx_to_json.py
```

Lo script crea `data/interventi_import.json`, nel formato di backup dell'app. Poi verifica che le statistiche ricalcolate coincidano con il foglio "Statistiche":

```bash
python3 tools/attese_statistiche.py
```

Deve rispondere `✓ 475 valori coincidono con il foglio Statistiche`.

Infine importa `data/interventi_import.json` in ogni dispositivo, da **Impostazioni → Importa backup**.

- Gli identificativi degli interventi sono fissi: importare lo stesso file su Mac e iPhone, o importarlo due volte, **non crea doppioni**.
- Su iPhone l'import va fatto dall'app installata nella schermata Home (vedi [Installazione su iPhone](#installazione-su-iphone)).

> ⚠️ `data/` e il file `.xlsx` contengono dati sanitari reali. Sono esclusi da git (`.gitignore`) e non devono finire nel repository né in posti condivisi. Spostali solo nel tuo iCloud Drive personale.

---

## Volo ed elisoccorso

Per le missioni in elicottero (mezzo **V-ECHO**, **T-ECHO**, **C-ECHO** o **A-ECHO**) il form mostra la sezione **Volo**, dopo "Tempi":

- **Tipo missione:** HEMS, HSR o IFT. È una lista come le altre: si modifica da Impostazioni.
- **Tempo di volo (min):** i minuti totali di volo della missione. Comprende il rientro in base, quindi può superare la durata.
- **Manovre:** HD Hovering discesa, VD Verricello discesa, HS Hovering salita, VS Verricello salita, VSP Verricello salita pannolone, VSB Verricello salita barella. Un tocco accende la manovra, il secondo la spegne; se ne possono scegliere più di una.

Se passi da un elicottero all'altro i dati di volo restano; se scegli un'ambulanza si svuotano. Per le missioni in elicottero ci sono tre avvisi in più: **Tipo missione mancante**, **Tempo volo mancante** e **Tempo volo non valido** (deve essere un numero intero da 0 a 600, come nell'Excel HEMS).

### Statistiche di volo

In **Statistiche**, sotto il periodo, c'è l'interruttore **Interventi | Volo**. La vista Volo conta solo le missioni in elicottero del periodo e rifà le tabelle di volo del foglio "Statistiche" dell'Excel HEMS, con le stesse formule:

- **Basi:** le missioni sono gli interventi in elicottero del periodo; le statistiche del tempo contano solo le missioni con il tempo di volo compilato.
- **KPI:** missioni (per ognuno dei quattro elicotteri), ore di volo, volo medio con la mediana, missioni con almeno una manovra.
- **Tabelle:**
  - V1 Tempo di volo: totale, media, mediana, minimo, massimo;
  - V2 Per mezzo;
  - V3 Tipo di missione, in % sulle missioni con il tipo compilato;
  - V4 Manovre, in % sulle missioni;
  - V5 Per mese.
- **Grafici:** ore di volo per mese, manovre, missioni per mezzo.

Le ore sono in ore:minuti, come il formato `[h]:mm` dell'Excel. Codici colore, patologie, luoghi, esito e orari delle missioni in elicottero restano nella vista Interventi, insieme a quelli delle ambulanze.

### Import dei voli dall'Excel HEMS

Le missioni in elicottero sono già nell'app, perché vengono dall'Excel del 118: lo script aggiunge solo tempo di volo, tipo di missione e manovre. Non modifica mai i file di partenza.

1. **iPhone:** **Impostazioni → Esporta backup** e salvalo in iCloud Drive. Lo script lavorerà sui dati di oggi.
2. **Mac:** lancia lo script con l'Excel HEMS e quel backup:

   ```bash
   python3 tools/hems_to_json.py "Report Voli HEMS 2026.xlsx" --base "percorso/del/backup.json"
   ```

   Per ogni riga del foglio "Voli" scrive l'esito:
   - `completata`;
   - `già completa`;
   - `senza codice missione`;
   - `non trovata`;
   - `trovata più volte`.

   Se data, mezzo o comune non coincidono con l'intervento trovato, lo segnala.
3. Lo script crea `data/voli_import.json` con i soli interventi completati. Importalo **sull'iPhone da cui hai esportato il backup** (Impostazioni → Importa backup), poi fai il solito giro di backup verso il Mac.
4. Le righe non completate le completi a mano dal form, aprendo l'intervento o inserendolo se manca.

Se modifichi uno di quegli interventi sul telefono tra l'export del punto 1 e l'import del punto 3, vince la versione dello script e il riepilogo dell'import la elenca tra i conflitti.

---

## Foto del tablet

In cima a **Nuovo intervento** c'è il pulsante **Foto tablet**: fotografi la schermata "Missione" del tablet SaveOnBoard e il modulo si riempie con quello che l'app riesce a leggere. Controlli, correggi quello che serve e salvi come sempre. Il pulsante non compare quando modifichi un intervento già salvato.

![Nuovo intervento dopo la lettura di una foto](docs/screenshots/390-foto-tablet.png)

Lo screenshot usa una schermata inventata.

### Come si usa

1. Tocca **Foto tablet**: il menu di iOS offre **Scatta foto** e **Libreria foto**.
2. Fotografa lo schermo dritto, intero e senza riflessi. Il pulsante mostra l'avanzamento ("Leggo la foto… 40%"); la lettura richiede qualche secondo.
3. Compare il riquadro con la miniatura, quanti campi sono stati letti e l'elenco dei **Non letti**. Toccando la miniatura rivedi la foto intera; **Togli foto** chiude il riquadro, e i valori restano nel modulo.
4. I campi letti prendono il posto di quelli già nel modulo e sono evidenziati con **dalla foto**, finché non li tocchi o non salvi. Ricontrolli quelli evidenziati e completi quelli non letti.

Se la missione è già in archivio, sotto la foto compare subito un avviso con **Apri**. Se la foto non si apre o non contiene la schermata "Missione", un messaggio lo dice e il modulo non cambia.

### Cosa legge

Gli esempi usano valori inventati.

| Campo | Da dove | Esempio |
|---|---|---|
| Missione | la parte prima della `/` in "Missione in corso", se è di 2 cifre, 2 lettere e 4 cifre | `99ZZ0042/1` → `99ZZ0042` |
| Mezzo | le cifre dopo `N0`, se sono una voce della lista Mezzo | `N03050` → `3050` |
| Data | non dal tablet: oggi, o ieri se l'ora di allarme è più avanti dell'ora attuale | foto alle 06:15, allarme 22:50 → ieri |
| Ora allert. | il riquadro **Allarme** | `21:05` |
| Libero operativo | il riquadro **Operativo** | `22:10` |
| Comune | il testo dopo il numero civico dell'indirizzo | `VIA DELLE PROVE, 12 NOVARA` → `NOVARA` |
| Codice, Patologia, Luogo | il codice del riquadro Valutazione, messo sia nell'invio sia nel rientro | `V 09 L` → VERDE, `09 - …`, `L - …` |
| Età | la riga "Data di nascita", con "N anni": il tablet conta un anno indietro, quindi N + 1 | `40 anni` → `41` |
| Sesso | la riga "Sesso" | `M` → Maschio |
| Esito | **Trasportato** se sotto **Arrivo H** c'è un orario | `21:52` → Trasportato |
| Ospedale | solo con esito Trasportato, e solo se il testo corrisponde a una voce della lista Ospedale | `OSP. MAGGIORE NOVARA` → Novara |
| Tipologia | non dal tablet: la imposta la [regola India/Mike](#tipologia-indiamike) dopo mezzo e ora allert. | |

- **Niente viene indovinato.** Un valore illeggibile o fuori formato lascia il campo com'era e finisce tra i **Non letti** (l'elenco riguarda Missione, Mezzo, Ora allert., Libero operativo, Comune, Codice, Patologia, Luogo, Età e Sesso).
- **Orari.** Ogni orario è quello scritto sotto la sua etichetta. Se c'è l'etichetta **Allarme**, la fila degli orari si legge tre volte: sulla foto intera e su due ritagli ingranditi, uno normale e uno invertito (per le scritte chiare sui riquadri scuri). Se due letture danno orari diversi, l'orario resta vuoto.
- **Comune.** Se l'indirizzo finisce con parole di due lettere ("… DA PO") il comune vale solo se è già nell'archivio, con o senza quelle parole: un nome troncato non si inventa. Un nome nuovo vale solo se è fatto di lettere (anche accentate, con apostrofo o trattino): con una cifra o un segno rimasti resta non letto ("N0VARA"), salvo che, tolti i segni, sia un comune già nell'archivio ("NOVARA." diventa NOVARA, scritto come nell'archivio).
- **Non letti per scelta.** Partenza, Arrivo e Partenza H non servono, perché l'app non ha quei campi. Tipo missione, tempo di volo e manovre degli elicotteri non sono sullo schermo e si compilano a mano.

### La foto non esce dal telefono

- La lettura avviene sul dispositivo. La foto e il testo letto non vengono inviati da nessuna parte.
- L'app non salva la foto: non finisce nell'intervento, nella bozza, nei backup né nell'export. La miniatura sta solo in memoria e sparisce con il riquadro.
- La foto mostra dati di un paziente. Se la scegli da **Libreria foto**, era già nel Rullino e ci resta: l'app non può cancellarla. Un avviso fisso sotto la miniatura lo ricorda: cancellala da Foto quando hai finito.

### Primo uso e offline

Il lettore è Tesseract.js 7.0.0 (licenza Apache 2.0), copiato in `vendor/tesseract-7.0.0/` come le altre librerie. Ogni dispositivo ne scarica circa **6 MB**, una volta sola, insieme all'app: motore di lettura e lingua italiana. La cartella è più grande perché contiene le tre varianti del motore; il dispositivo ne scarica una sola, quella che userà.

- Questi file stanno in una cache a parte (`lettore-testo-7.0.0`) che un aggiornamento dell'app non cancella né riscarica.
- Dopo il primo caricamento la lettura funziona anche senza rete.
- Se tocchi **Foto tablet** prima che il lettore sia stato scaricato, il messaggio chiede di aprire l'app una volta con la rete e di riprovare.
- Il lettore si avvia al primo tocco di **Foto tablet** e si chiude uscendo dal modulo.

### Prova su una foto vera

Le prove automatiche usano una schermata finta con dati inventati. Per vedere come legge una foto vera, solo sul Mac e solo in WebKit, c'è una prova a parte:

```bash
FOTO_TABLET=/percorso/fuori/dal/repository/foto.jpg node --test tests/e2e/foto-vera.e2e.mjs
```

Stampa nel terminale i valori del modulo, i **Non letti** e i secondi impiegati, da confrontare a occhio con la foto. Non scrive nessun file e non fa screenshot; senza `FOTO_TABLET` viene saltata, e non fa parte di `npm run e2e`.

La foto ha dati veri di un paziente: tienila fuori dal repository, in una cartella temporanea, e cancellala alla fine. Se è in formato HEIC, convertila prima:

```bash
T=$(mktemp -d) && sips -s format jpeg foto.HEIC --out "$T/tablet.jpg"
```

---

## Tipologia India/Mike

La tipologia si imposta da sola quando scegli il mezzo o l'ora di allertamento, a mano o dalla foto:

| Mezzo | Tipologia |
|---|---|
| 3040, 5022, 5024 | India sempre |
| 3050 | Mike con ora allert. dalle 08:00 alle 19:59, India dalle 20:00 alle 07:59 |
| 6021 | Mike con ora allert. dalle 20:00 alle 07:59, India dalle 08:00 alle 19:59 |
| tutti gli altri, elicotteri compresi | Mike sempre |

- **Cambiando il mezzo** la tipologia diventa quella della regola. Per 3050 e 6021 serve un'ora allert. valida: senza, la tipologia si svuota fino a quando la inserisci.
- **Cambiando l'ora allert.** la tipologia si ricalcola solo per 3050 e 6021: per gli altri mezzi una scelta fatta a mano resta com'è.
- La tipologia si può sempre cambiare a mano, e non c'è nessun avviso nuovo.
- Gli interventi già salvati non cambiano: la regola agisce solo quando cambi mezzo o ora nel modulo.
- 3050 e 6021 sono voci di sistema della lista Mezzo, come 3040, 5022 e 5024: la regola si basa sul nome, quindi non si possono rinominare né disattivare.

---

## Pubblicazione su Cloudflare Pages

L'app è un insieme di file statici: Cloudflare la ospita gratis, a un indirizzo tutto suo:
<https://liberoeoperativo.wolftux.workers.dev>. L'indirizzo è `<nome app>.<nome account>.workers.dev`:
il nome dell'app è in `tools/pubblica.sh`, quello dell'account (`wolftux`, uguale per tutte le app dell'account) si cambia
su Cloudflare in **Workers & Pages → Your subdomain → Change**.
Un indirizzo che non condivide con altre app conta: il browser separa dati e cache per indirizzo.

Si pubblica dal Mac, con un comando:

```bash
npm run pubblica
```

Il comando ([tools/pubblica.sh](tools/pubblica.sh)):

1. si ferma se non sei su `main` o se ci sono modifiche senza commit;
2. esegue i test;
3. copia dall'ultimo commit **solo i file dell'app** in una cartella temporanea fuori dal progetto: `index.html`, `manifest.webmanifest`, `sw.js` e le cartelle `css/`, `js/`, `vendor/`, `icons/`;
4. li carica su Cloudflare con Wrangler, lanciato da quella cartella e senza configurazione automatica;
5. controlla che dati, Excel e file di progetto rispondano 404; se uno risponde, toglie subito la pubblicazione.

**Non lanciare mai Wrangler nella cartella del progetto.** Con la configurazione automatica pubblicherebbe tutta la cartella, dati reali compresi.

Test, strumenti, documenti e appunti di progetto restano nel repository ma non finiscono sul sito.

**Privacy.** I dati reali sono esclusi da `.gitignore` e il comando pubblica solo file presenti nei commit, quindi non possono finire online. Il sito pubblicato non riceve né contiene dati: ogni dispositivo tiene i suoi in locale. Il push su GitHub non pubblica niente: serve solo a tenere una copia del codice.

### Prima pubblicazione

1. Collega il Mac al tuo account Cloudflare, da una cartella fuori dal progetto (si apre il browser per il consenso):

   ```bash
   cd ~ && npx wrangler@4.156.0 login
   ```

2. Pubblica con `npm run pubblica`: la prima volta crea anche il progetto. L'indirizzo dell'app compare alla fine.

### Aggiornare l'app

1. Modifica i file.
2. In `sw.js` cambia `VERSIONE`, per esempio `interventi118-v1.0.1`: è il segnale che fa scaricare la nuova copia ai dispositivi.
3. Fai il commit su `main` e lancia `npm run pubblica`.
4. Sui dispositivi la nuova versione arriva alla seconda apertura dell'app: la prima scarica i file, la seconda li usa.

Se aggiungi un file all'app, inseriscilo nell'elenco `FILE` di `sw.js`; se aggiungi una cartella, anche nella riga `git archive` di `tools/pubblica.sh`. Un test (`tests/pwa.test.js`) segnala se te ne dimentichi.

I file del lettore della [foto del tablet](#primo-uso-e-offline) hanno una cache a parte, che non cambia con `VERSIONE`: così un aggiornamento non riscarica i 6 MB. Se cambi versione di Tesseract, cambiano insieme la cartella in `vendor/` e il nome `LETTORE` in `sw.js`.

---

## Installazione su iPhone

1. Apri l'indirizzo dell'app in **Safari**: l'installazione funziona solo da Safari.
2. Tocca **Condividi** (il quadrato con la freccia), poi **Aggiungi alla schermata Home**, poi **Aggiungi**.
3. Apri l'app dall'icona del cartellino 118. Da qui funziona anche senza rete.
4. **Importa i dati dall'app installata.** L'app nella schermata Home ha un archivio suo, separato da quello di Safari: i dati importati in una scheda di Safari non si vedono nell'app installata, e viceversa.

In **Impostazioni → Archiviazione sul dispositivo** vedi se iOS ha concesso l'archiviazione persistente. Con l'app installata di solito è "Concessa": il sistema non cancellerà i dati per liberare spazio. Il backup resta comunque l'unica copia fuori dal telefono.

**Sul Mac** puoi usare l'app in una scheda di Safari, oppure aggiungerla al Dock da Safari con **File → Aggiungi al Dock**. Anche qui l'app nel Dock ha un archivio separato da quello delle schede: scegli un modo e importa i dati lì. Attenzione: cancellare i "dati dei siti web" di Safari cancella anche i dati dell'app.

---

## Backup e passaggio dei dati tra Mac e iPhone

Non c'è sincronizzazione automatica: i dati passano da un dispositivo all'altro con un **file di backup JSON** salvato su iCloud Drive. Il nome del file contiene data e ora: `interventi118_AAAA-MM-GG_HHMM.json`.

### Dall'iPhone al Mac

1. iPhone: **Impostazioni → Esporta backup**. Si apre la condivisione: scegli **Salva su File**, poi **iCloud Drive** (ad esempio una cartella "Interventi 118"), poi **Salva**.
2. Mac: apri l'app, **Impostazioni → Importa backup** e scegli il file da iCloud Drive.

### Dal Mac all'iPhone

1. Mac: **Impostazioni → Esporta backup**. Il file finisce in Download: spostalo in iCloud Drive.
2. iPhone, dall'app installata: **Impostazioni → Importa backup → Sfoglia → iCloud Drive** e scegli il file.

### Cosa succede all'import

L'import **unisce** i dati, non sostituisce mai l'archivio:

- **Interventi nuovi:** vengono aggiunti.
- **Interventi presenti su entrambi i dispositivi:** vince la versione modificata più di recente.
- **Interventi eliminati sull'altro dispositivo:** vengono eliminati anche qui.
- **Interventi presenti solo sul dispositivo di arrivo:** restano.
- **Liste dei menu:** le voci aggiunte o rinominate viaggiano insieme ai dati.

A fine import compare il riepilogo:

- **Nuovi**, **Aggiornati**, **Invariati**;
- **Conflitti:** lo stesso intervento modificato su tutti e due i dispositivi dall'ultimo scambio. Viene tenuta la versione più recente e l'elenco dice quali erano;
- **Stessa missione registrata più volte:** succede se hai inserito lo stesso intervento su Mac e iPhone. Restano entrambi, con l'avviso "Missione duplicata", e decidi tu quale eliminare.

**Consiglio:** se hai lavorato su un solo dispositivo, esporta da lì e importa nell'altro. Se hai lavorato su entrambi, fai il giro completo: esporta da A e importa in B, poi esporta da B e importa in A. Alla fine i due archivi sono identici.

### Promemoria e archivio

- Nell'app compare un promemoria quando l'ultimo backup ha più di **7 giorni** o ci sono più di **10 modifiche** non esportate.
- **Esporta Excel** crea un file `.xlsx` con le stesse colonne del foglio "Interventi", comprese quelle calcolate. Serve per l'archivio, **non** è un backup da reimportare: per quello usa il JSON.
- Se perdi o cambi il telefono, i dati sono nell'ultimo backup su iCloud Drive: installa l'app sul nuovo iPhone e importalo.

---

## Test

```bash
npm test
```

Esegue i test unitari (oltre 180) con `node --test`. Coprono:

- campi calcolati, compresa la durata a cavallo della mezzanotte;
- controlli di qualità, compresi quelli di volo;
- statistiche, comprese quelle di volo;
- merge con conflitti ed eliminazioni, anche tra backup vecchi e nuovi;
- regola India/Mike per mezzo e orario;
- lettura della schermata del tablet, su testi inventati;
- liste, export Excel, file della PWA, comportamento del service worker e script di import dei voli.

Se `data/` contiene i file creati dagli script del [primo import](#primo-import-dei-dati-dallexcel), i test confrontano anche le statistiche sui 212 interventi reali con i valori del foglio Excel. Senza quei file, quei test vengono saltati con il motivo.

Allo stesso modo, le statistiche di volo si confrontano con l'Excel HEMS:

```bash
python3 tools/attese_volo.py "Report Voli HEMS 2026.xlsx"
```

Lo script crea `data/volo_attese.json`. Da quel momento `npm test` controlla tutti i 157 valori delle tabelle di volo.

```bash
npm run e2e
```

Esegue 72 prove end-to-end in **WebKit** (il motore di Safari) e **Chromium**, a 390 e 1440 px:

- inserimento e duplicato bloccante;
- modifica, eliminazione, filtri e statistiche;
- sezione Volo del form e vista Volo delle statistiche;
- foto del tablet, con una schermata finta e dati inventati: campi evidenziati, missione già salvata, foto storta o sbagliata, lettore assente;
- export e reimport con merge tra due dispositivi simulati;
- export Excel e funzionamento offline.

Le prove avviano da sole un server locale, usano solo dati inventati e salvano gli screenshot in `docs/screenshots/`.

Playwright non è una dipendenza del progetto: le prove usano quello installato sul computer, cioè il pacchetto `playwright` oppure `@playwright/cli`. In alternativa puoi indicare il percorso con `PLAYWRIGHT_CORE=/percorso/playwright-core/index.mjs`. WebKit si installa con:

```bash
npx playwright install webkit
```

Con `E2E_BROWSER=webkit npm run e2e` provi un solo motore.

---

## Come sono calcolate le statistiche

Le definizioni sono quelle del foglio "Istruzioni" e delle formule del foglio "Statistiche":

- **Interventi totali:** righe con DATA o MISSIONE.
- **Pazienti valutati:** totali − "Annullato da CO" − "Non Raggiungibile".
- **Percentuali degli ospedali:** sui soli trasportati.
- **Codici VERDE < GIALLO < ROSSO:** il NERO, presente solo al rientro, è escluso dal confronto invio/rientro.
- **Durata:** libero operativo − ora di allertamento. Se il libero operativo è dopo la mezzanotte, si conta il giorno dopo.

Scelte fatte dove le formule dell'Excel erano ambigue, confermate prima di scrivere il codice:

1. **Sesso, età e fasce d'età** riproducono l'Excel così com'è: si contano su tutte le righe, ma la percentuale è sui valutati. Per questo maschi + femmine può superare di poco il 100%.
2. **Missione duplicata:** il salvataggio si blocca solo se inserisci o cambi una MISSIONE mettendo un numero già usato; un duplicato già presente resta modificabile. Il controllo guarda tutto l'archivio, non solo il periodo filtrato.
3. **Righe senza DATA:** contano solo nella vista "Tutto", non nei filtri per anno, mese o intervallo.
4. **Tabella per mese:** mostra i mesi del periodo scelto, con l'anno quando il periodo ne copre più di uno.
5. **Voci di sistema bloccate:** non si rinominano né si disattivano i 4 codici, India/Mike, Maschio/Femmina, Trasportato, Deceduto, Annullato da CO, Non Raggiungibile e i mezzi 3040, 3050, 5022, 5024, 6021, V-ECHO, T-ECHO, C-ECHO e A-ECHO. Sono le voci da cui dipendono statistiche, controlli e regola [India/Mike](#tipologia-indiamike). C-ECHO e A-ECHO non sono nel foglio "Liste" dell'Excel: l'app li aggiunge da sola in fondo alla lista Mezzo, anche su un dispositivo che aveva già le sue liste.

Le statistiche di volo seguono il foglio "Statistiche" dell'Excel HEMS: vedi [Statistiche di volo](#statistiche-di-volo).

---

## Struttura del progetto

```
index.html, manifest.webmanifest, sw.js   app, installazione, cache offline
css/app.css                               stile (sistema visivo descritto in DESIGN.md)
js/core/       logica pura, senza interfaccia, coperta dai test:
               campi, calcolati, controlli, statistiche, volo, merge, liste, elenco, modulo, excel, tablet
js/ui/         schermate: inserimento, elenco, statistiche (con la vista volo), impostazioni;
               fototablet (foto, ritocco e lettore della schermata del tablet)
js/db.js       archivio IndexedDB          js/stato.js  stato in memoria
js/app.js      avvio e navigazione
vendor/        Chart.js 4.5.1 (MIT), SheetJS CE 0.20.3 (Apache 2.0) e Tesseract.js 7.0.0 (Apache 2.0, in tesseract-7.0.0/),
               copie locali con licenza
icons/         icona (SVG originale e PNG)
tools/         import dagli Excel 118 e HEMS, verifica statistiche, dati demo, server di sviluppo
tests/         test unitari, prove end-to-end (tests/e2e, con la prova a mano su una foto vera), dati demo e schermata finta del tablet (tests/fixtures)
docs/screenshots/   schermate delle prove end-to-end
```

---

## Limiti noti

- **Nessuna sincronizzazione automatica:** il passaggio tra Mac e iPhone avviene solo con il file di backup. Il conflitto si risolve automaticamente tenendo la modifica più recente; non c'è un'unione campo per campo.
- **Condivisione "Salva su File" su iPhone:** le prove automatiche la sostituiscono con il download. Va verificata a mano sul telefono, la prima volta che esporti.
- **Prove in WebKit, non su iPhone:** le prove automatiche girano nel motore di Safari su Mac, non su un iPhone vero. Data e ora usano i selettori nativi di iOS, che le prove non possono vedere.
- **Archivi separati:** Safari, l'app nella schermata Home e l'app nel Dock del Mac hanno archivi separati, anche sullo stesso dispositivo.
- **Pulizia di Safari:** cancellare i dati di navigazione di Safari cancella i dati dell'app aperta nel browser. Il backup regolare resta la protezione principale.
- **Backup della versione 1.1:** contengono i dati di volo e un'app non ancora aggiornata li rifiuta, chiedendo di aggiornarla. Aggiorna l'app su entrambi i dispositivi prima di scambiare i backup: basta aprirla due volte con la rete.
- **Export Excel e dati di volo:** l'export contiene le colonne VOLO, ma `tools/xlsx_to_json.py` legge solo le colonne del 118. Per i passaggi tra dispositivi usa sempre il backup JSON.
- **Lettura della foto non provata su iPhone:** sia le prove automatiche sia la prova su una foto vera girano in WebKit su Mac. Tempi, menu **Scatta foto** / **Libreria foto** e primo scaricamento del lettore vanno verificati a mano sul telefono.
- **Lettura della foto: un aiuto, non una garanzia.** Il lettore può sbagliare, soprattutto con foto storte, mosse o con riflessi: i campi evidenziati vanno sempre ricontrollati. Quello che non legge o non riconosce resta vuoto.
- **Lettura degli Excel:** l'app importa solo backup JSON. Per leggere un file Excel si usa `tools/xlsx_to_json.py`, che legge il foglio "Interventi" con la struttura attuale.
- **Promemoria del backup sul telefono:** a 390 px, quando è visibile, spinge la striscia dei codici di invio poco sotto la prima schermata.
