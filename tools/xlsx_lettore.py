"""Lettura minima di un file .xlsx con la sola libreria standard (zipfile + XML).

Legge valori e formule delle celle, senza calcolare nulla: per le celle con formula
restituisce il valore memorizzato dall'ultimo salvataggio di Excel/LibreOffice.
Il file non viene mai modificato.
"""
import re
import zipfile
import xml.etree.ElementTree as ET

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": NS_MAIN}


class Cella:
    __slots__ = ("valore", "tipo", "formula")

    def __init__(self, valore, tipo, formula):
        self.valore = valore    # str | float | None
        self.tipo = tipo        # "n" numero, "s" testo, "b" booleano, "e" errore
        self.formula = formula  # testo della formula o None


def _col_indice(lettere):
    n = 0
    for ch in lettere:
        n = n * 26 + (ord(ch) - 64)
    return n


class Cartella:
    def __init__(self, percorso):
        self._zip = zipfile.ZipFile(percorso)
        self._condivise = self._leggi_stringhe_condivise()
        self._fogli = self._leggi_elenco_fogli()
        self.modificato = self._leggi_data_modifica()

    def _leggi_stringhe_condivise(self):
        if "xl/sharedStrings.xml" not in self._zip.namelist():
            return []
        radice = ET.fromstring(self._zip.read("xl/sharedStrings.xml"))
        return ["".join(t.text or "" for t in si.iter(f"{{{NS_MAIN}}}t")) for si in radice.findall("m:si", NS)]

    def _leggi_elenco_fogli(self):
        wb = ET.fromstring(self._zip.read("xl/workbook.xml"))
        rels = ET.fromstring(self._zip.read("xl/_rels/workbook.xml.rels"))
        destinazioni = {r.get("Id"): r.get("Target") for r in rels}
        fogli = {}
        for s in wb.find("m:sheets", NS):
            dest = destinazioni[s.get(f"{{{NS_REL}}}id")]
            fogli[s.get("name")] = dest if dest.startswith("xl/") else "xl/" + dest.lstrip("/")
        return fogli

    def _leggi_data_modifica(self):
        if "docProps/core.xml" not in self._zip.namelist():
            return None
        testo = self._zip.read("docProps/core.xml").decode("utf-8")
        m = re.search(r"<dcterms:modified[^>]*>([^<]+)</dcterms:modified>", testo)
        return m.group(1) if m else None

    def nomi_fogli(self):
        return list(self._fogli)

    def foglio(self, nome):
        """Restituisce {(riga, colonna): Cella} con riga e colonna a base 1."""
        radice = ET.fromstring(self._zip.read(self._fogli[nome]))
        celle = {}
        for c in radice.iter(f"{{{NS_MAIN}}}c"):
            m = re.match(r"([A-Z]+)(\d+)", c.get("r"))
            pos = (int(m.group(2)), _col_indice(m.group(1)))
            tipo = c.get("t") or "n"
            f = c.find("m:f", NS)
            v = c.find("m:v", NS)
            inline = c.find("m:is", NS)
            valore = None
            if v is not None and v.text is not None:
                if tipo == "s":
                    valore, tipo = self._condivise[int(v.text)], "s"
                elif tipo in ("str", "inlineStr"):
                    valore, tipo = v.text, "s"
                elif tipo == "n":
                    valore = float(v.text)
                else:
                    valore = v.text
            elif inline is not None:
                valore, tipo = "".join(t.text or "" for t in inline.iter(f"{{{NS_MAIN}}}t")), "s"
            formula = f.text if f is not None else None
            if valore is None and formula is None:
                continue
            celle[pos] = Cella(valore, tipo, formula)
        return celle


def col(lettere):
    """'A' -> 1, 'W' -> 23."""
    return _col_indice(lettere)
