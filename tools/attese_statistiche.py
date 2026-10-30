#!/usr/bin/env python3
"""Calcola le statistiche attese direttamente dalle celle dell'Excel, con le stesse regole
delle formule del foglio "Statistiche", e le confronta con i valori che quel foglio mostra.

Uso:
    python3 tools/attese_statistiche.py ["Report Interventi 118 2026 v3.xlsx"] [data/statistiche_attese.json]

Esce con codice 1 se anche un solo valore differisce dal foglio Statistiche.
Il JSON prodotto è il riferimento del test node `tests/statistiche-excel.test.js`.
Questa implementazione è volutamente indipendente da quella JavaScript dell'app.
"""
import json
import re
import statistics
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from xlsx_lettore import Cartella, col

RADICE = Path(__file__).resolve().parent.parent
XLSX_PREDEFINITO = RADICE / "Report Interventi 118 2026 v3.xlsx"
JSON_PREDEFINITO = RADICE / "data" / "statistiche_attese.json"
RIGHE = range(3, 1003)
MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
SCALA = ["VERDE", "GIALLO", "ROSSO"]
FASCE = [("0–17", 0, 17), ("18–40", 18, 40), ("41–65", 41, 65), ("66–80", 66, 80), ("oltre 80", 81, 200)]
TIPI_AVVISO = [
    "Ora allert. non valida", "Libero operativo non valido", "Data non valida",
    "Missione non di 8 caratteri", "Missione duplicata", "Mezzo solo India",
    "Ospedale senza trasporto", "Età non valida",
]


def round_excel(x, cifre=0):
    """ROUND di Excel: metà lontano da zero, sul valore a 15 cifre significative."""
    return float(Decimal(f"{x:.15g}").quantize(Decimal(1).scaleb(-cifre), rounding=ROUND_HALF_UP))


def div(a, b):
    """IFERROR(a/b, 0)."""
    return a / b if b else 0


class Foglio:
    """Le colonne di "Interventi" come liste di valori grezzi (None = cella vuota)."""

    def __init__(self, celle):
        self.celle = celle

    def v(self, riga, lettera):
        c = self.celle.get((riga, col(lettera)))
        return None if c is None else c.valore

    def colonna(self, lettera):
        return [self.v(r, lettera) for r in RIGHE]


def eq(valore, criterio):
    """Uguaglianza alla COUNTIF: testo senza distinzione di maiuscole, numero = numero."""
    if valore is None:
        return False
    if isinstance(criterio, str):
        return isinstance(valore, str) and valore.lower() == criterio.lower()
    return isinstance(valore, float) and valore == criterio


def numeri(valori):
    return [v for v in valori if isinstance(v, float)]


def calcolati(f):
    """Colonne calcolate S (durata), T (mese), U (ora), V (Δ codice), W (controlli)."""
    out = []
    missioni = [f.v(r, "D") for r in RIGHE]
    conteggio = {}
    for m in missioni:
        if m not in (None, ""):
            k = str(m).lower() if isinstance(m, str) else m
            conteggio[k] = conteggio.get(k, 0) + 1
    for r in RIGHE:
        b, c, d, ff, g, h, k, m, n, o, rr = (f.v(r, x) for x in "BCDFGHKMNOR")
        if b is None and d is None:
            out.append(None)
            continue
        hm = lambda t: (round((t % 1) * 86400) % 86400) // 60  # noqa: E731  HOUR*60+MINUTE
        durata = (hm(rr) - hm(c)) % 1440 if isinstance(c, float) and isinstance(rr, float) else None
        mese = None
        if isinstance(b, float):
            import datetime
            mese = (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(b))).month
        ora = hm(c) // 60 if isinstance(c, float) else None
        delta = None
        if h not in (None, "") and o not in (None, "") and o != "NERO" and h in SCALA and o in SCALA:
            delta = SCALA.index(o) - SCALA.index(h)
        avvisi = []
        if c is not None and not isinstance(c, float):
            avvisi.append("Ora allert. non valida")
        if rr is not None and not isinstance(rr, float):
            avvisi.append("Libero operativo non valido")
        if b is not None and not isinstance(b, float):
            avvisi.append("Data non valida")
        dt = None if d is None else (str(int(d)) if isinstance(d, float) else d)
        if dt is not None and len(dt) != 8:
            avvisi.append("Missione non di 8 caratteri")
        if d is not None and conteggio[str(d).lower() if isinstance(d, str) else d] > 1:
            avvisi.append("Missione duplicata")
        if ff in (3040.0, 5022.0, 5024.0) and g == "Mike":
            avvisi.append("Mezzo solo India")
        if n not in (None, "") and m != "Trasportato":
            avvisi.append("Ospedale senza trasporto")
        if k is not None and (not isinstance(k, float) or not k.is_integer() or k < 0):
            avvisi.append("Età non valida")  # aggiunto dall'app; nell'Excel lo impedisce la convalida
        out.append({"durata": durata, "mese": mese, "ora": ora, "delta": delta, "avvisi": avvisi})
    return out


def calcola(cartella):
    f = Foglio(cartella.foglio("Interventi"))
    liste = cartella.foglio("Liste")

    def lista(lettera):
        voci, riga = [], 2
        while (c := liste.get((riga, col(lettera)))) is not None and c.valore is not None:
            voci.append(c.valore)
            riga += 1
        return voci

    calc = calcolati(f)
    righe = [i for i, x in enumerate(calc) if x is not None]
    B, F, G, H, I, J, K, L, M, N, O, P, Q = (f.colonna(x) for x in "BFGHIJKLMNOPQ")
    S = [x["durata"] if x else None for x in calc]
    T = [x["mese"] if x else None for x in calc]
    U = [x["ora"] if x else None for x in calc]
    V = [x["delta"] if x else None for x in calc]
    W = [x["avvisi"] if x else None for x in calc]
    conta = lambda colonna, crit: sum(1 for v in colonna if eq(v, crit))  # noqa: E731
    conta2 = lambda c1, k1, c2, k2: sum(1 for a, b in zip(c1, c2) if eq(a, k1) and eq(b, k2))  # noqa: E731
    media = lambda vals: statistics.fmean(vals) if vals else None  # noqa: E731

    tot = len(righe)
    annullati = conta(M, "Annullato da CO") + conta(M, "Non Raggiungibile")
    val = tot - annullati
    trasp = conta(M, "Trasportato")
    dec = conta(M, "Deceduto")
    maschi, femmine = conta(L, "Maschio"), conta(L, "Femmina")
    india, mike = conta(G, "India"), conta(G, "Mike")
    eta = numeri(K)
    dur = [s for s in S if s is not None]
    righe_avvisi = sum(1 for w in W if w)

    riepilogo = {
        "totali": tot, "annullati": annullati, "annullatiPct": div(annullati, tot), "valutati": val,
        "trasportati": trasp, "trasportatiPct": div(trasp, val), "deceduti": dec, "decedutiPct": div(dec, val),
        "maschi": maschi, "maschiPct": div(maschi, val), "femmine": femmine, "femminePct": div(femmine, val),
        "india": india, "indiaPct": div(india, tot), "mike": mike, "mikePct": div(mike, tot),
        "etaMedia": round_excel(media(eta), 1) if eta else None,
        "etaMediana": statistics.median(eta) if eta else None,
        "etaMin": min(eta) if eta else None, "etaMax": max(eta) if eta else None,
        "durataMedia": round_excel(media(dur), 0) if dur else None,
        "durataMediana": statistics.median(dur) if dur else None,
        "durataMax": max(dur) if dur else None,
    }
    codici_rientro = lista("B")
    codici = []
    for voce in codici_rientro:
        n_inv = conta(H, voce) if voce in lista("A") else None
        codici.append({
            "voce": voce, "invio": n_inv, "invioPct": None if n_inv is None else div(n_inv, tot),
            "rientro": conta(O, voce), "rientroPct": div(conta(O, voce), val),
        })
    matrice = []
    for inv in lista("A"):
        celle = {rie: conta2(H, inv, O, rie) for rie in codici_rientro}
        matrice.append({"invio": inv, "celle": celle, "totale": sum(celle.values())})
    piu = sum(1 for d in V if d is not None and d > 0)
    inv0 = sum(1 for d in V if d == 0)
    meno = sum(1 for d in V if d is not None and d < 0)
    somma = piu + inv0 + meno
    cambio = {
        "piuGrave": piu, "piuGravePct": div(piu, somma), "invariato": inv0, "invariatoPct": div(inv0, somma),
        "menoGrave": meno, "menoGravePct": div(meno, somma),
    }

    def doppia(voci, c_inv, c_rie):
        return [{"voce": v, "invio": conta(c_inv, v), "invioPct": div(conta(c_inv, v), tot),
                 "rientro": conta(c_rie, v), "rientroPct": div(conta(c_rie, v), val)} for v in voci]

    mesi = []
    for m in range(1, 13):
        sel = [i for i, t in enumerate(T) if t == m]
        dm = [S[i] for i in sel if S[i] is not None]
        mesi.append({
            "chiave": f"2026-{m:02d}", "voce": MESI[m - 1], "interventi": len(sel),
            "rossiInvio": sum(1 for i in sel if eq(H[i], "ROSSO")),
            "trasportati": sum(1 for i in sel if eq(M[i], "Trasportato")),
            "durataMedia": round_excel(media(dm), 0) if dm else None,
        })
    mezzi = []
    for v in lista("I"):
        crit = v if isinstance(v, str) else v  # numeri restano numeri, come nella formula
        sel = [i for i, x in enumerate(F) if eq(x, crit)]
        dm = [S[i] for i in sel if S[i] is not None]
        mezzi.append({
            "voce": v if isinstance(v, str) else str(int(v)), "n": len(sel), "pct": div(len(sel), tot),
            "india": sum(1 for i in sel if eq(G[i], "India")), "mike": sum(1 for i in sel if eq(G[i], "Mike")),
            "durataMedia": round_excel(media(dm), 0) if dm else None,
        })
    return {
        "kpi": {
            "interventi": tot, "valutati": val, "annullati": annullati,
            "annullatiPct": round_excel(div(annullati, tot) * 100, 1),
            "trasportati": trasp, "trasportatiPct": round_excel(div(trasp, val) * 100, 0),
            "deceduti": dec, "decedutiPct": round_excel(div(dec, val) * 100, 1),
            "rossiRientro": conta(O, "ROSSO"), "rossiRientroPct": round_excel(div(conta(O, "ROSSO"), val) * 100, 0),
            "rossiInvio": conta(H, "ROSSO"), "rossiInvioPct": round_excel(div(conta(H, "ROSSO"), tot) * 100, 0),
            "neri": conta(O, "NERO"),
            "durataMediana": riepilogo["durataMediana"], "durataMedia": riepilogo["durataMedia"],
            "durataMax": riepilogo["durataMax"], "etaMediana": riepilogo["etaMediana"],
            "maschiPct": round_excel(div(maschi, val) * 100, 0), "femminePct": round_excel(div(femmine, val) * 100, 0),
            "avvisi": righe_avvisi, "avvisiPct": round_excel(div(righe_avvisi, tot) * 100, 1),
        },
        "riepilogo": riepilogo,
        "codici": codici,
        "matrice": matrice,
        "cambioCodice": cambio,
        "patologia": doppia(lista("C"), I, P),
        "luogo": doppia(lista("D"), J, Q),
        "esito": [{"voce": v, "n": conta(M, v), "pct": div(conta(M, v), tot)} for v in lista("G")],
        "fasceEta": [{"voce": nome, "n": sum(1 for e in eta if lo <= e <= hi),
                      "pct": div(sum(1 for e in eta if lo <= e <= hi), val)} for nome, lo, hi in FASCE],
        "mesi": mesi,
        "ore": [{"voce": f"{h:02d}", "n": sum(1 for u in U if u == h), "pct": div(sum(1 for u in U if u == h), tot)}
                for h in range(24)],
        "mezzi": mezzi,
        "ospedali": [{"voce": v, "n": conta(N, v), "pct": div(conta(N, v), trasp)} for v in lista("H")],
        "controlli": {
            "righeConAvvisi": righe_avvisi,
            "perTipo": [{"voce": t, "n": sum(1 for w in W if w and t in w)} for t in TIPI_AVVISO],
        },
    }


# ---------------------------------------------------------------- confronto con il foglio Statistiche

def confronta(att, cartella):
    s = cartella.foglio("Statistiche")
    errori, controllati = [], 0

    def cella(ref):
        m = re.match(r"([A-Z]+)(\d+)", ref)
        c = s.get((int(m.group(2)), col(m.group(1))))
        return None if c is None or c.valore in (None, "", "—") else c.valore

    def verifica(ref, atteso, nome):
        nonlocal controllati
        controllati += 1
        excel = cella(ref)
        ok = (excel is None and atteso is None) or (
            excel is not None and atteso is not None and abs(float(excel) - float(atteso)) < 1e-9)
        if not ok:
            errori.append(f"{ref} {nome}: Excel={excel!r} Python={atteso!r}")

    def etichetta(ref, attesa):
        if str(cella(ref)) != str(attesa):
            errori.append(f"{ref}: etichetta Excel={cella(ref)!r}, attesa {attesa!r}")

    r = att["riepilogo"]
    for riga, chiave, pct in [(68, "totali", None), (69, "annullati", "annullatiPct"), (70, "valutati", None),
                              (71, "trasportati", "trasportatiPct"), (72, "deceduti", "decedutiPct"),
                              (73, "maschi", "maschiPct"), (74, "femmine", "femminePct"),
                              (75, "india", "indiaPct"), (76, "mike", "mikePct"), (77, "etaMedia", None),
                              (78, "etaMediana", None), (80, "durataMedia", None),
                              (81, "durataMediana", None), (82, "durataMax", None)]:
        verifica(f"B{riga}", r[chiave], chiave)
        if pct:
            verifica(f"C{riga}", r[pct], pct)
    if cella("B79") != f'{r["etaMin"]:g} – {r["etaMax"]:g}':
        errori.append(f"B79 età min–max: Excel={cella('B79')!r}")
    controllati += 1
    for i, c in enumerate(att["codici"]):
        riga = 68 + i
        etichetta(f"H{riga}", c["voce"])
        verifica(f"I{riga}", c["invio"], "invio " + c["voce"])
        verifica(f"J{riga}", c["invioPct"], "% invio " + c["voce"])
        verifica(f"K{riga}", c["rientro"], "rientro " + c["voce"])
        verifica(f"L{riga}", c["rientroPct"], "% rientro " + c["voce"])
    for i, m in enumerate(att["matrice"]):
        riga = 76 + i
        etichetta(f"H{riga}", "Invio " + m["invio"])
        for lettera, rie in zip("IJKL", ["VERDE", "GIALLO", "ROSSO", "NERO"]):
            verifica(f"{lettera}{riga}", m["celle"][rie], f"matrice {m['invio']}→{rie}")
        verifica(f"M{riga}", m["totale"], "matrice totale " + m["invio"])
    cc = att["cambioCodice"]
    for riga, k in [(82, "piuGrave"), (83, "invariato"), (84, "menoGrave")]:
        verifica(f"I{riga}", cc[k], k)
        verifica(f"J{riga}", cc[k + "Pct"], k + "Pct")

    def tabella(righe, prima, cv, colonne):
        for i, x in enumerate(righe):
            riga = prima + i
            etichetta(f"{cv}{riga}", x["voce"])
            for lettera, k in colonne:
                verifica(f"{lettera}{riga}", x[k], f"{x['voce']} {k}")

    tabella(att["patologia"], 87, "A", [("B", "invio"), ("C", "invioPct"), ("D", "rientro"), ("E", "rientroPct")])
    tabella(att["luogo"], 89, "H", [("I", "invio"), ("J", "invioPct"), ("K", "rientro"), ("L", "rientroPct")])
    tabella(att["esito"], 100, "H", [("I", "n"), ("J", "pct")])
    tabella(att["fasceEta"], 108, "A", [("B", "n"), ("C", "pct")])
    tabella(att["mesi"], 113, "H", [("I", "interventi"), ("J", "rossiInvio"), ("K", "trasportati"),
                                   ("L", "durataMedia")])
    tabella(att["ore"], 117, "A", [("B", "n"), ("C", "pct")])
    tabella(att["mezzi"], 128, "H", [("I", "n"), ("J", "pct"), ("K", "india"), ("L", "mike"), ("M", "durataMedia")])
    tabella(att["ospedali"], 145, "A", [("B", "n"), ("C", "pct")])
    verifica("I153", att["controlli"]["righeConAvvisi"], "righe con avvisi")
    for i, t in enumerate(att["controlli"]["perTipo"][:7]):  # l'Excel non ha "Età non valida"
        etichetta(f"H{154 + i}", t["voce"])
        verifica(f"I{154 + i}", t["n"], t["voce"])

    k = att["kpi"]
    for ref, chiave in [("A5", "interventi"), ("B5", "trasportati"), ("D5", "rossiRientro"),
                        ("H5", "durataMediana"), ("I5", "etaMediana"), ("K5", "avvisi")]:
        verifica(ref, k[chiave], "KPI " + chiave)
    testi = {
        "A6": f'{k["valutati"]} valutati',
        "A7": f'annullati: {k["annullati"]} ({k["annullatiPct"]:g}%)',
        "B6": f'{k["trasportatiPct"]:g}% dei valutati',
        "B7": f'deceduti: {k["deceduti"]} ({k["decedutiPct"]:g}%)',
        "D6": f'{k["rossiRientroPct"]:g}% dei valutati',
        "D7": f'all\'invio: {k["rossiInvio"]} ({k["rossiInvioPct"]:g}%) · neri: {k["neri"]}',
        "H7": f'media {k["durataMedia"]:g} · max {k["durataMax"]:g}',
        "I7": f'{k["maschiPct"]:g}% maschi · {k["femminePct"]:g}% femmine',
        "K7": f'{k["avvisiPct"]:g}% degli interventi · tabella 12',
    }
    for ref, atteso in testi.items():
        controllati += 1
        if cella(ref) != atteso:
            errori.append(f"{ref} KPI: Excel={cella(ref)!r}, Python={atteso!r}")
    return controllati, errori


def main(argv):
    sorgente = Path(argv[1]) if len(argv) > 1 else XLSX_PREDEFINITO
    destinazione = Path(argv[2]) if len(argv) > 2 else JSON_PREDEFINITO
    cartella = Cartella(sorgente)
    attese = calcola(cartella)
    controllati, errori = confronta(attese, cartella)
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    destinazione.write_text(json.dumps(attese, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if errori:
        print(f"✗ {len(errori)} valori su {controllati} non coincidono con il foglio Statistiche:")
        for e in errori:
            print("  " + e)
        return 1
    print(f"✓ {controllati} valori coincidono con il foglio Statistiche → {destinazione}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
