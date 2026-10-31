# Intervento con più pazienti – design

Data: 2026-10-31. Stato: 14 decisioni prese a domande singole, poi messe sotto processo (`/court`, assolto 7 a 5)
e corrette con le tre condizioni del giudice, accettate dall'utente. Nella rilettura del piano aggiunte tre regole di dettaglio:
`createdAt` al salvataggio, numero obbligatorio con la spunta accesa, "Refuso" valido solo sul dispositivo. Nessun codice scritto.

## Obiettivo

Un intervento può avere più pazienti: stesso numero di MISSIONE, stessi allarmi (data, ora), stessa uscita; cambiano
codice colore, patologia, esito, età e sesso. Oggi l'archivio ha una riga per scheda e segna il caso come
"Missione duplicata", blocca il salvataggio della seconda scheda e conta due interventi. L'utente ha già un caso reale
in archivio, registrato come due righe con la stessa MISSIONE.

Criteri di riuscita:

- registrare il secondo paziente costa pochi tocchi e non richiede di ribattere i dati condivisi;
- il controllo sui refusi della MISSIONE resta identico a oggi finché nessuno attiva "Paziente multiplo";
- un'uscita vale sempre 1 intervento nelle statistiche, i pazienti si contano per scheda;
- nessuna conversione automatica dell'archivio: ogni collegamento è una scelta dell'utente, sempre reversibile;
- i backup vecchi si importano come prima e due dispositivi che si scambiano i file arrivano allo stesso risultato.

## Decisioni confermate

Le 14 decisioni del 31/10, con le correzioni del processo segnate **(corretta)**.

1. **Modello.** Resta una riga per scheda. MISSIONE intatta, 8 caratteri, nessun suffisso. Un campo nuovo
   `pazienti`: vuoto (`null`) per l'intervento singolo, il numero di pazienti (intero ≥ 2) quando l'intervento è
   multiplo. La spunta "Paziente multiplo" del modulo è `pazienti !== null`.
2. **Controllo.** Basta la spunta sulla *prima scheda* salvata. Una scheda nuova (o con MISSIONE cambiata) con la
   stessa MISSIONE di una prima scheda con la spunta si collega; se la prima scheda non ha la spunta resta l'errore
   "La MISSIONE X è già registrata", con in più la frase "Se è un altro paziente dello stesso intervento, apri la prima
   scheda e attiva Paziente multiplo."
3. **Numero.** Le schede collegate ereditano `pazienti` dalla prima scheda, nel modulo appena la MISSIONE coincide:
   spunta attiva e bloccata, numero bloccato. Se cambi il numero sulla prima scheda, al salvataggio l'app lo aggiorna
   sulle altre schede del gruppo. Con la spunta accesa il numero è obbligatorio: se lo cancelli la spunta resta accesa
   e il salvataggio si blocca ("Scrivi il numero di pazienti, oppure togli Paziente multiplo."); un numero non valido
   (1, 2,5, un testo) si salva con l'avviso del punto 8.
4. **Statistiche.** Un'uscita vale 1: interventi totali, tabelle per mese, mezzo e ora, India/Mike e durate contano
   una volta per missione, dalla prima scheda. Pazienti valutati, codici, patologie, luoghi, esiti, ospedali, età e
   sesso contano per scheda. Due righe nuove nel riepilogo: "Interventi con più pazienti" e "Pazienti negli interventi
   multipli". Le percentuali con numeratore per scheda hanno per base le schede, non gli interventi (identiche a oggi
   quando non ci sono interventi multipli).
5. **Avviso di collegamento.** Riquadro verde nel modulo sotto la MISSIONE, appena il numero coincide:
   "Collegata all'intervento del 12/10, BIELLA: paziente multiplo (3 pazienti)" con il link "Apri la prima scheda".
   Cambiando la MISSIONE il riquadro sparisce e la scheda torna libera (spunta spenta). Niente finestre.
6. **Volo.** Tempo di volo una volta per missione, dalla prima scheda; avviso non bloccante "Tempo volo diverso tra le
   schede" su una scheda collegata con un tempo diverso. Manovre sommate scheda per scheda; "missioni con manovre",
   "più di una", "nessuna" per missione (sull'insieme delle manovre delle sue schede).
7. **Inserimento.** Pulsante "Aggiungi paziente" nel dettaglio di una scheda salvata con la spunta: apre una scheda
   nuova con data, ora allert., missione, comune, mezzo, tipologia, invio CO (codice, patologia, luogo), libero
   operativo, tipo missione e tempo di volo già compilati, copiati dalla prima scheda del gruppo; vuoti età, sesso, esito, ospedale, rientro e manovre. Tutto
   resta modificabile, anche il codice di invio: l'app non obbliga i campi condivisi a essere uguali. Resta la via
   manuale (Nuovo intervento + stessa MISSIONE).
8. **Coerenza.** Avvisi non bloccanti nella colonna CONTROLLI: "Schede in più rispetto ai pazienti", "Mancano schede
   paziente", "Numero pazienti non valido" (non intero o < 2), "Numero pazienti diverso tra le schede" (può nascere da
   un'unione di backup).
9. **Excel.** Colonna PAZIENTI subito dopo MISSIONE, vuota se singolo, con il numero su tutte le schede del gruppo.
   Le colonne dopo scalano di una; `tools/xlsx_to_json.py` riconosce il tracciato dall'intestazione (con o senza
   PAZIENTI). Il backup JSON passa alla versione 3 (si leggono 1, 2 e 3); i record vecchi hanno `pazienti: null`.
10. **Prima scheda.** Finché esistono altre schede collegate, sulla prima scheda spunta e MISSIONE sono bloccate
    (nel modulo e al salvataggio), con la nota "Collegata a 2 altre schede". Eliminare una scheda è sempre permesso, senza
    cancellazione a catena: se ne resta una sola, la spunta torna libera; se ne restano meno del numero dichiarato
    scatta "Mancano schede paziente". **(corretta)** La MISSIONE di una scheda collegata (non prima) resta
    modificabile: cambiarla scioglie il legame e svuota `pazienti`.
11. **Archivio esistente. (corretta)** Nessuna conversione automatica. In Impostazioni una sezione "Stessa missione
    registrata più volte" elenca ogni gruppo di schede con la stessa MISSIONE la cui prima scheda non ha la spunta,
    con due scelte: **Stesso intervento** (mette `pazienti` = numero di schede su tutte le schede del gruppo) e
    **Refuso** (il gruppo esce dall'elenco, l'avviso "Missione duplicata" resta e si corregge a mano). Sotto, i gruppi
    già collegati con il pulsante **Scollega** (rimette `pazienti: null` su tutte le schede: si torna a "Missione
    duplicata"). Ogni scelta finisce in un riepilogo salvato in `meta` e mostrato nella stessa sezione.
    "Refuso" e il riepilogo restano sul dispositivo (non entrano nel backup); "Stesso intervento" e "Scollega" cambiano
    i record e viaggiano con loro.
12. **Promemoria. (corretta)** Al posto della conversione una tantum: finché esistono gruppi da decidere, la striscia
    dei promemoria (quella del backup) dice "N missioni registrate più volte: decidi se sono pazienti multipli" con il
    link alle Impostazioni. I duplicati che nascono da un'importazione entrano nello stesso elenco: non si converte
    niente da solo.
13. **Foto tablet.** Se la MISSIONE letta coincide con una prima scheda con la spunta, il pannello della foto mostra il
    riquadro verde del punto 5 invece dell'errore rosso, e i campi letti riempiono la scheda del nuovo paziente. Senza
    spunta, errore rosso come oggi.
14. **Elenco.** Ogni scheda di un gruppo collegato mostra l'etichetta "Paziente 1 di 3", "2 di 3"… Righe separate,
    nessun raggruppamento. Il riepilogo in testa conta gli interventi per missione e, se diverso, aggiunge le schede.

### Regola della prima scheda (condizione del giudice)

Il *gruppo* di una MISSIONE sono le schede non eliminate con la stessa chiave (`trim().toUpperCase()`). Le schede del
gruppo si ordinano per `createdAt` crescente e, a parità, per `id` crescente: la *prima scheda* è la prima di
quest'ordine. Una scheda nuova si salva con `createdAt` uguale all'istante del salvataggio (oggi resta quello
d'apertura del modulo): la prima scheda è così la prima salvata, e una scheda non ancora salvata conta come ultima.
L'ordine è deterministico e regge all'unione tra dispositivi (entrambi i campi viaggiano nel backup).
È la fonte unica per il conteggio per missione, per mese, mezzo, ora, tipologia, durata e tempo di volo, per il blocco
del punto 10 e per le etichette "Paziente n di N".

Un gruppo è **collegato** se la sua prima scheda ha `pazienti !== null`. Un gruppo di due o più schede non collegato è
un duplicato: avviso "Missione duplicata" su tutte, come oggi, e conta per riga come oggi.

## 1. Modello dati

| Chiave | Tipo | Vuoto |
|---|---|---|
| `pazienti` | numero intero ≥ 2 (un testo non numerico resta testo, per l'avviso) | `null` |

- `CAMPI` prende la voce `{ chiave: 'pazienti', intestazione: 'PAZIENTI', sezione: 'Identificazione' }` subito dopo
  `missione`: così normalizzazione, modulo ed export seguono da soli.
- `normalizzaRecord` tratta `pazienti` come `eta` e `tempoVolo` (`normalizzaNumero`).
- I record in IndexedDB passano da `normalizzaRecord` al caricamento: nessuna migrazione dell'archivio.
- Backup: `VERSIONE = 3`, leggibili 1, 2, 3. Un record v2 e lo stesso record v3 con `pazienti: null` hanno lo stesso
  `contenuto`: invariato, nessun conflitto.

## 2. Logica pura (`js/core/`)

Modulo nuovo `js/core/pazienti.js`:

- `chiaveMissione(m)`; `ordinaSchede(schede)`; `gruppiMissione(records)` → `Map<chiave, schede ordinate>` delle non
  eliminate con chiave non vuota; `schedeDi(records, missione, { escludi })`; `primaScheda(records, missione, { escludi })`;
- `isMultiplo(r)` = `r.pazienti !== null && r.pazienti !== undefined`;
  `pazientiValidi(r)` = intero ≥ 2;
- `unaPerMissione(records)`: dei gruppi collegati tiene la prima scheda (tra quelle passate), tutto il resto resta;
- `collegaGruppo(schede, adesso)` / `scollegaGruppo(schede, adesso)`: copie con `pazienti` impostato (= numero di
  schede) o azzerato e `updatedAt` aggiornato;
- `propagaPazienti(prima, records, adesso)`: le altre schede del gruppo con `pazienti` allineato alla prima, solo
  quelle che cambiano.

`controlli.js`: `indiceMissioni(records)` restituisce `gruppiMissione`; `avvisi(r, indice)` aggiunge i quattro avvisi
del punto 8 (`TIPI_AVVISO_PAZIENTI`, tolti dal confronto con l'Excel 118 come quelli di volo) e "Tempo volo diverso tra le schede"; `verificaSalvataggio` restituisce anche `collegataA` (id della prima
scheda) e blocca MISSIONE e spunta della prima scheda collegata (punto 10). `TIPI_AVVISO` nell'ordine:
…, 'Missione duplicata', 'Numero pazienti non valido', 'Schede in più rispetto ai pazienti', 'Mancano schede paziente',
'Numero pazienti diverso tra le schede', 'Mezzo solo India', …, 'Tempo volo non valido', 'Tempo volo diverso tra le schede'.

`modulo.js`: `impostaCampo(r, 'pazienti', v)` normalizza come l'età; `collegaScheda(r, records, eraCollegata)` applica
l'eredità del punto 3 e lo scioglimento del punto 10; `nuovaSchedaPaziente(prima, id, adesso)` per il punto 7.

`statistiche.js`, `volo.js`, `domande.js`: il punto 4 e il punto 6. `elenco.js`: `etichettaPaziente(r, indice)`.
`merge.js`: `duplicatiMissione` del riepilogo esclude i gruppi collegati. `excel.js`: colonna PAZIENTI.

## 3. Interfaccia

- Modulo, sezione Identificazione: sotto la riga MISSIONE / Ora allert., l'interruttore "Paziente multiplo" e, se
  attivo, il campo "Numero pazienti" (tastiera numerica). Scheda collegata: interruttore e numero bloccati, riquadro
  verde (`.messaggio.collegata`). Prima scheda con altre collegate: interruttore e MISSIONE bloccati, nota
  "Collegata a N altre schede". Dettaglio di una scheda con la spunta: pulsante "Aggiungi paziente" → `#/nuovo/<id>`.
- Foto tablet: riquadro verde al posto dell'errore quando la prima scheda ha la spunta.
- Elenco: etichetta "Paziente n di N" nei dettagli della riga; riepilogo "N interventi · M schede".
- Statistiche: tabella 1 con le due righe nuove; KPI "Interventi" con sottotitolo "… valutati · N con più pazienti"
  quando N > 0. Vista Volo: nota in V4 "le manovre di tutte le schede di una missione si sommano".
- Impostazioni: sezione "Stessa missione registrata più volte" (punto 11). Promemoria in `app.js` (punto 12).
- Versione 1.5.0 (`js/app.js`, `sw.js`, Impostazioni → Informazioni, README).

## Fuori dal progetto

Base giuridica e conservazione dei dati sanitari sui dispositivi personali (sollevate da un giurato): non cambiano
con questo lavoro e restano un tema a parte.
