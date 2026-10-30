#!/usr/bin/env python3
"""Converte il foglio "Interventi" (e le "Liste") dell'Excel nel file JSON dell'app.

Uso:
    python3 tools/xlsx_to_json.py ["Report Interventi 118 2026 v3.xlsx"] [data/interventi_import.json]

Il file prodotto si importa nell'app da Impostazioni → Dati → Importa JSON.
Gli id sono stabili (derivati da data, ora e missione) e createdAt/updatedAt sono la data
di salvataggio dell'Excel: rilanciare lo script sullo stesso file produce lo stesso JSON,
quindi importarlo su più dispositivi non crea doppioni.
Il file .xlsx non viene mai modificato.
"""
import datetime
import json
import re
import sys
import unicodedata
import uuid
from pathlib import Path

from xlsx_lettore import Cartella, col

RADICE = Path(__file__).resolve().parent.parent
XLSX_PREDEFINITO = RADICE / "Report Interventi 118 2026 v3.xlsx"
JSON_PREDEFINITO = RADICE / "data" / "interventi_import.json"

PRIMA_RIGA, ULTIMA_RIGA = 3, 1002
BASE_DATE = datetime.date(1899, 12, 30)  # sistema data 1900 di Excel
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "interventi118")

# colonna Excel -> campo del record
COLONNE = {
    "B": "data", "C": "oraAllert", "D": "missione", "E": "comune", "F": "mezzo", "G": "tipologia",
    "H": "codiceInvio", "I": "patologiaInvio", "J": "luogoInvio", "K": "eta", "L": "sesso",
    "M": "esito", "N": "ospedale", "O": "codiceRientro", "P": "patologiaRientro", "Q": "luogoRientro",
    "R": "liberoOperativo",
}

# colonna del foglio Liste -> nome della lista nell'app
LISTE = {
    "A": "codiceInvio", "B": "codiceRientro", "C": "patologia", "D": "luogo", "E": "tipologia",
    "F": "sesso", "G": "esito", "H": "ospedale", "I": "mezzo",
}

# voci che reggono formule e controlli: non si rinominano né disattivano
VOCI_SISTEMA = {
    "codiceInvio": {"VERDE", "GIALLO", "ROSSO"},
    "codiceRientro": {"VERDE", "GIALLO", "ROSSO", "NERO"},
    "tipologia": {"India", "Mike"},
    "sesso": {"Maschio", "Femmina"},
    "esito": {"Trasportato", "Deceduto", "Annullato da CO", "Non Raggiungibile"},
    "mezzo": {"3040", "3050", "5022", "5024", "6021", "V-ECHO", "T-ECHO", "C-ECHO", "A-ECHO"},
}


def iso_utc(testo):
    """'2026-10-25T13:12:29Z' -> '2026-10-25T13:12:29.000Z'."""
    d = datetime.datetime.fromisoformat(testo.replace("Z", "+00:00")).astimezone(datetime.timezone.utc)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{d.microsecond // 1000:03d}Z"


def testo_numero(v):
    """3030.0 -> '3030'; 12.5 -> '12.5'."""
    return str(int(v)) if float(v).is_integer() else repr(v)


def converti_data(cella):
    if cella is None or cella.valore is None:
        return ""
    if cella.tipo == "n":
        return (BASE_DATE + datetime.timedelta(days=int(cella.valore))).isoformat()
    return str(cella.valore)  # testo: data non valida, la conserva per l'avviso


def converti_ora(cella):
    if cella is None or cella.valore is None:
        return ""
    if cella.tipo == "n":
        # come HOUR() e MINUTE(): conta solo la parte oraria, i secondi si scartano
        secondi = round((cella.valore % 1) * 86400) % 86400
        return f"{secondi // 3600:02d}:{secondi % 3600 // 60:02d}"
    return str(cella.valore)  # testo: ora non valida, la conserva per l'avviso


def converti_testo(cella):
    if cella is None or cella.valore is None:
        return ""
    return testo_numero(cella.valore) if cella.tipo == "n" else str(cella.valore)


def converti_eta(cella):
    if cella is None or cella.valore is None:
        return None
    if cella.tipo == "n":
        return int(cella.valore) if float(cella.valore).is_integer() else cella.valore
    return str(cella.valore)  # testo: età non valida, la conserva per l'avviso


def slug(testo):
    t = unicodedata.normalize("NFKD", testo).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def leggi_record(cartella, istante):
    celle = cartella.foglio("Interventi")
    record, chiavi_viste = [], {}
    for riga in range(PRIMA_RIGA, ULTIMA_RIGA + 1):
        valori = {campo: celle.get((riga, col(lettera))) for lettera, campo in COLONNE.items()}
        r = {}
        for campo, cella in valori.items():
            if campo == "data":
                r[campo] = converti_data(cella)
            elif campo in ("oraAllert", "liberoOperativo"):
                r[campo] = converti_ora(cella)
            elif campo == "eta":
                r[campo] = converti_eta(cella)
            else:
                r[campo] = converti_testo(cella)
        if r["data"] == "" and r["missione"] == "":
            continue  # come la colonna "#": la riga conta solo con DATA o MISSIONE
        chiave = f'{r["data"]}|{r["oraAllert"]}|{r["missione"]}'
        chiavi_viste[chiave] = chiavi_viste.get(chiave, 0) + 1
        if chiavi_viste[chiave] > 1:
            chiave += f"#{chiavi_viste[chiave]}"
        record.append({
            "id": str(uuid.uuid5(NAMESPACE, chiave)),
            "createdAt": istante,
            "updatedAt": istante,
            "deleted": False,
            **r,
        })
    return record


def leggi_liste(cartella, istante):
    if "Liste" not in cartella.nomi_fogli():
        return None  # es. un export dell'app: contiene solo "Interventi", l'app tiene le sue liste
    celle = cartella.foglio("Liste")
    liste = {}
    for lettera, nome in LISTE.items():
        voci, riga = [], 2
        while (cella := celle.get((riga, col(lettera)))) is not None and cella.valore is not None:
            voce = converti_testo(cella)
            voci.append({
                "id": f"{nome}-{slug(voce)}",
                "voce": voce,
                "attiva": True,
                "sistema": voce in VOCI_SISTEMA.get(nome, set()),
                "updatedAt": istante,
            })
            riga += 1
        liste[nome] = voci
    return liste


def main(argv):
    sorgente = Path(argv[1]) if len(argv) > 1 else XLSX_PREDEFINITO
    destinazione = Path(argv[2]) if len(argv) > 2 else JSON_PREDEFINITO
    cartella = Cartella(sorgente)
    istante = iso_utc(cartella.modificato) if cartella.modificato else "2026-01-01T00:00:00.000Z"
    record = leggi_record(cartella, istante)
    liste = leggi_liste(cartella, istante)
    documento = {
        "formato": "interventi118",
        "versione": 1,
        "esportatoIl": istante,
        "dispositivo": "import-xlsx",
        "record": record,
        "liste": liste,
    }
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    destinazione.write_text(json.dumps(documento, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    voci = sum(len(v) for v in liste.values()) if liste else 0
    print(f"{len(record)} interventi e {voci} voci di lista → {destinazione}")


if __name__ == "__main__":
    main(sys.argv)
