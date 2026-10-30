#!/usr/bin/env python3
"""Completa con i dati di volo dell'Excel HEMS le missioni già presenti in un backup dell'app.

Uso:
    python3 tools/hems_to_json.py ["Report Voli HEMS 2026.xlsx"] [--base BACKUP.json] [--uscita USCITA.json]

Per ogni riga del foglio "Voli" cerca nel backup l'intervento con la stessa MISSIONE e ne copia
TIPO MISSIONE, TEMPO VOLO e le manovre (HD…VSB). Scrive un backup con i soli interventi completati,
da importare nell'app da Impostazioni → Importa backup: il merge li aggiorna perché sono più recenti.
Le righe che non trova le elenca, da completare a mano dal form.

Conviene usare come --base un backup appena esportato dal telefono: così lo script lavora sui dati
di oggi e l'import non sovrascrive modifiche più recenti. Nessun file in ingresso viene modificato.
"""
import argparse
import datetime
import json
import sys
from pathlib import Path

from xlsx_lettore import Cartella, col
from xlsx_to_json import converti_data, converti_testo

RADICE = Path(__file__).resolve().parent.parent
XLSX_PREDEFINITO = RADICE / "Report Voli HEMS 2026.xlsx"
BASE_PREDEFINITA = RADICE / "data" / "interventi_import.json"
USCITA_PREDEFINITA = RADICE / "data" / "voli_import.json"

PRIMA_RIGA, ULTIMA_RIGA = 3, 1002
CODICI_MANOVRE = ["HD", "VD", "HS", "VS", "VSP", "VSB"]
COLONNE_MANOVRE = ["U", "V", "W", "X", "Y", "Z"]
ESITI = ["completata", "già completa", "senza codice missione", "non trovata", "trovata più volte"]


def converti_tempo(cella):
    """TEMPO VOLO: intero se intero, numero, testo conservato (l'app lo segnala), None se vuota."""
    if cella is None or cella.valore is None:
        return None
    if cella.tipo == "n":
        return int(cella.valore) if float(cella.valore).is_integer() else cella.valore
    return str(cella.valore)


def leggi_manovre(celle, riga):
    """Codici delle colonne HD…VSB con una X (maiuscola o minuscola), nell'ordine delle colonne."""
    return [codice for codice, lettera in zip(CODICI_MANOVRE, COLONNE_MANOVRE)
            if converti_testo(celle.get((riga, col(lettera)))).strip().upper() == "X"]


def adesso_iso():
    d = datetime.datetime.now(datetime.timezone.utc)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{d.microsecond // 1000:03d}Z"


def volo_di(r):
    """I campi di volo di un record, come li normalizza l'app."""
    manovre = r.get("manovre") if isinstance(r.get("manovre"), list) else []
    return {
        "tipoMissione": str(r.get("tipoMissione") or "").strip(),
        "tempoVolo": r.get("tempoVolo"),
        "manovre": [c for c in CODICI_MANOVRE if c in manovre],
    }


def differenze(riga_excel, r):
    out = []
    for campo, nome in (("data", "data"), ("mezzo", "mezzo"), ("comune", "comune")):
        a = str(riga_excel[campo]).strip().upper()
        b = str(r.get(campo) or "").strip().upper()
        if a and a != b:
            out.append(f"{nome} {riga_excel[campo]} nel file HEMS, {r.get(campo) or 'vuoto'} nel backup")
    return out


def main(argv):
    parser = argparse.ArgumentParser(description="Completa i voli delle missioni già nell'app.")
    parser.add_argument("excel", nargs="?", default=XLSX_PREDEFINITO, type=Path)
    parser.add_argument("--base", default=BASE_PREDEFINITA, type=Path, help="backup JSON dell'app da completare")
    parser.add_argument("--uscita", default=USCITA_PREDEFINITA, type=Path)
    args = parser.parse_args(argv[1:])

    base = json.loads(args.base.read_text(encoding="utf-8"))
    if not isinstance(base.get("record"), list):
        sys.exit(f"{args.base} non è un backup dell'app.")
    per_missione = {}
    for r in base["record"]:
        chiave = str(r.get("missione") or "").replace(" ", "").upper()
        if chiave and not r.get("deleted"):
            per_missione.setdefault(chiave, []).append(r)

    celle = Cartella(args.excel).foglio("Voli")
    istante = adesso_iso()
    completati, conteggi = [], dict.fromkeys(ESITI, 0)
    for riga in range(PRIMA_RIGA, ULTIMA_RIGA + 1):
        excel = {
            "data": converti_data(celle.get((riga, col("B")))),
            "missione": converti_testo(celle.get((riga, col("D")))).replace(" ", "").upper(),
            "comune": converti_testo(celle.get((riga, col("E")))),
            "mezzo": converti_testo(celle.get((riga, col("F")))),
        }
        if excel["data"] == "" and excel["missione"] == "":
            continue
        volo = {
            "tipoMissione": converti_testo(celle.get((riga, col("G")))).strip(),
            "tempoVolo": converti_tempo(celle.get((riga, col("T")))),
            "manovre": leggi_manovre(celle, riga),
        }
        trovati = per_missione.get(excel["missione"], []) if excel["missione"] else []
        note = []
        if not excel["missione"]:
            esito = "senza codice missione"
        elif not trovati:
            esito = "non trovata"
        elif len(trovati) > 1:
            esito = "trovata più volte"
        elif volo_di(trovati[0]) == volo:
            esito = "già completa"
        else:
            esito = "completata"
            note = differenze(excel, trovati[0])
            completati.append({**trovati[0], **volo, "updatedAt": istante})
        conteggi[esito] += 1
        print(f"riga {riga}: {excel['missione'] or '—'} ({excel['data'] or 'senza data'}) {esito}")
        for nota in note:
            print(f"    differenze: {nota}")

    documento = {
        "formato": "interventi118", "versione": 2, "esportatoIl": istante, "dispositivo": "import-hems",
        "record": completati, "liste": None,
    }
    args.uscita.parent.mkdir(parents=True, exist_ok=True)
    args.uscita.write_text(json.dumps(documento, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Totale: " + ", ".join(f"{n} {e}" for e, n in conteggi.items() if n))
    print(f"{len(completati)} interventi completati → {args.uscita}")
    print("Importalo nell'app da Impostazioni → Importa backup; le righe non completate vanno inserite a mano.")


if __name__ == "__main__":
    main(sys.argv)
