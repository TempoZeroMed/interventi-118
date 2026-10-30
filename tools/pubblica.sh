#!/bin/sh
# Pubblica l'app su Cloudflare dal Mac: prima i test, poi SOLO i file dell'app presi dall'ultimo commit di main.
# git archive prende solo file tracciati: i dati reali (esclusi da .gitignore) non possono finire nella cartella da pubblicare.
# Wrangler parte da una cartella temporanea fuori dal progetto e senza configurazione automatica: lanciato nella
# cartella del progetto, con la configurazione automatica pubblicherebbe tutto, dati reali compresi.
set -e
cd "$(dirname "$0")/.."
NOME=liberoeoperativo
WRANGLER="npx --yes wrangler@4.156.0"

[ "$(git branch --show-current)" = main ] || { echo "Si pubblica solo da main."; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Ci sono modifiche senza commit: fai prima il commit."; exit 1; }
node --test

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/site"
git archive HEAD index.html manifest.webmanifest sw.js css js vendor icons | tar -x -C "$tmp/site"
cd "$tmp"
$WRANGLER deploy --no-autoconfig --assets site --name "$NOME" --compatibility-date 2026-10-23 > uscita.txt 2>&1 || { cat uscita.txt; exit 1; }
cat uscita.txt
# L'indirizzo lo dà Cloudflare: <nome app>.<nome account>.workers.dev
INDIRIZZO=$(grep -oE "https://$NOME\.[a-z0-9-]+\.workers\.dev" uscita.txt | head -1)
[ -n "$INDIRIZZO" ] || { echo "Non trovo l'indirizzo dell'app nella risposta di Cloudflare."; exit 1; }

# Controllo finale: i file privati non devono rispondere. Se uno risponde, la pubblicazione viene tolta subito
# (< /dev/null fa confermare da sola la domanda di wrangler delete).
for percorso in data/interventi_import.json data/voli_import.json 'Report%20Interventi%20118%202026%20v3.xlsx' README.md package.json tests/pwa.test.js; do
  stato=$(curl -s -o /dev/null -w '%{http_code}' "$INDIRIZZO/$percorso" || true)
  case "$stato" in
    404) ;;
    2*|3*)
      echo "ATTENZIONE: $percorso risponde $stato. Tolgo la pubblicazione."
      $WRANGLER delete --name "$NOME" < /dev/null
      exit 1 ;;
    *) echo "Non riesco a controllare $INDIRIZZO/$percorso (risposta $stato): ricontrolla tra un minuto."; exit 1 ;;
  esac
done
[ "$(curl -s -o /dev/null -w '%{http_code}' "$INDIRIZZO/")" = 200 ] || { echo "L'app non risponde ancora: riprova tra un minuto."; exit 1; }
echo "Pubblicata: $INDIRIZZO"
