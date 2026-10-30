#!/usr/bin/env python3
"""Valori attesi delle statistiche di volo, letti dall'Excel HEMS, per il test di confronto.

Uso:
    python3 tools/attese_volo.py ["Report Voli HEMS 2026.xlsx"] [data/volo_attese.json]

Scrive {record, attese}:
- record: le righe del foglio "Voli" nel formato dell'app;
- attese: i valori che il foglio "Statistiche" mostra per le tabelle di volo, nella stessa forma
  di calcolaStatisticheVolo (js/core/volo.js). Le ore, frazioni di giorno in Excel, diventano minuti.
Contiene dati reali: resta in data/, escluso da git. Il file .xlsx non viene mai modificato.
"""
import json
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from xlsx_lettore import Cartella, col
from hems_to_json import converti_tempo, leggi_manovre
from xlsx_to_json import converti_data, converti_ora, converti_testo

RADICE = Path(__file__).resolve().parent.parent
XLSX_PREDEFINITO = RADICE / "Report Voli HEMS 2026.xlsx"
JSON_PREDEFINITO = RADICE / "data" / "volo_attese.json"

PRIMA_RIGA, ULTIMA_RIGA = 3, 1002
MANOVRE = [
    ("HD", "Hovering discesa"), ("VD", "Verricello discesa"), ("HS", "Hovering salita"),
    ("VS", "Verricello salita"), ("VSP", "Verricello salita pannolone"), ("VSB", "Verricello salita barella"),
]
NOMI_MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]


def arrotonda_excel(x, cifre):
    """ROUND di Excel: metà lontano da zero, sul valore a 15 cifre significative."""
    return float(Decimal(f"{x:.15g}").quantize(Decimal(1).scaleb(-cifre), rounding=ROUND_HALF_UP))


def leggi_voli(cartella):
    celle = cartella.foglio("Voli")
    cella = lambda riga, lettera: celle.get((riga, col(lettera)))
    record = []
    for riga in range(PRIMA_RIGA, ULTIMA_RIGA + 1):
        data = converti_data(cella(riga, "B"))
        missione = converti_testo(cella(riga, "D"))
        if data == "" and missione == "":
            continue
        record.append({
            "id": f"hems-{riga}",
            "data": data,
            "oraAllert": converti_ora(cella(riga, "C")),
            "missione": missione,
            "comune": converti_testo(cella(riga, "E")),
            "mezzo": converti_testo(cella(riga, "F")),
            "tipoMissione": converti_testo(cella(riga, "G")),
            "tipologia": converti_testo(cella(riga, "H")),
            "esito": converti_testo(cella(riga, "N")),
            "liberoOperativo": converti_ora(cella(riga, "S")),
            "tempoVolo": converti_tempo(cella(riga, "T")),
            "manovre": leggi_manovre(celle, riga),
        })
    return record


def leggi_attese(cartella, anno):
    celle = cartella.foglio("Statistiche")

    def valore(rif):
        m = re.match(r"([A-Z]+)(\d+)", rif)
        c = celle.get((int(m.group(2)), col(m.group(1))))
        return None if c is None or c.valore in (None, "") else c.valore

    n = lambda rif: int(valore(rif))
    minuti = lambda rif: round(valore(rif) * 1440)
    quota = lambda riga: {"n": n(f"C{riga}"), "pct": valore(f"D{riga}")}
    voli_medio = valore("D5")
    con_manovre_pct = re.match(r"(\d+)%", valore("E6"))
    return {
        "basi": {"missioni": n("C13"), "conTempo": n("C15")},
        "kpi": {
            "missioni": n("B5"),
            "perMezzo": [{"voce": valore(f"B{r}"), "n": n(f"C{r}")} for r in (34, 35)],
            "minutiVolo": minuti("C5"),
            "conTempo": n("C15"),
            "voloMedio": None if voli_medio is None else arrotonda_excel(voli_medio, 1),
            "voloMediana": valore("C25"),
            "conManovre": n("E5"),
            "conManovrePct": int(con_manovre_pct.group(1)) if con_manovre_pct else 0,
        },
        "tempo": {
            "totaleMinuti": minuti("C23"), "media": valore("C24"), "mediana": valore("C25"),
            "minimo": valore("C26"), "massimo": valore("C27"),
        },
        "mezzi": [{
            "voce": valore(f"B{r}"), "n": n(f"C{r}"), "pct": valore(f"D{r}"), "minutiVolo": minuti(f"E{r}"),
            "voloMedio": valore(f"F{r}"), "conTempo": n(f"G{r}"),
        } for r in (34, 35)],
        "tipi": {
            "voci": [{
                "voce": valore(f"B{r}"), "n": n(f"C{r}"), "pct": valore(f"D{r}") or 0, "minutiVolo": minuti(f"E{r}"),
            } for r in (40, 41, 42)],
            "nonCompilato": n("C43"),
        },
        "manovre": {
            "voci": [{"codice": codice, "nome": nome, **quota(55 + i)} for i, (codice, nome) in enumerate(MANOVRE)],
            "almenoUna": quota(61), "piuDiUna": quota(62), "nessuna": quota(63),
        },
        "mesi": [{
            "chiave": f"{anno}-{mese:02d}", "voce": NOMI_MESI[mese - 1],
            "missioni": n(f"C{183 + mese}"), "minutiVolo": minuti(f"D{183 + mese}"),
            "voloMedio": valore(f"E{183 + mese}"), "conManovre": n(f"F{183 + mese}"),
            "oreGrafico": valore(f"J{183 + mese}"),
        } for mese in range(1, 13)],
    }


def main(argv):
    sorgente = Path(argv[1]) if len(argv) > 1 else XLSX_PREDEFINITO
    destinazione = Path(argv[2]) if len(argv) > 2 else JSON_PREDEFINITO
    cartella = Cartella(sorgente)
    record = leggi_voli(cartella)
    anni = sorted({r["data"][:4] for r in record if re.match(r"\d{4}-", r["data"])})
    if len(anni) != 1:
        sys.exit(f"Il foglio Statistiche riassume un anno solo: trovati gli anni {anni}.")
    documento = {"record": record, "attese": leggi_attese(cartella, anni[0])}
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    destinazione.write_text(json.dumps(documento, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(record)} voli e i valori attesi delle statistiche di volo → {destinazione}")


if __name__ == "__main__":
    main(sys.argv)
