#!/usr/bin/env python3
"""Server locale per provare l'app: come `python3 -m http.server`, ma senza cache HTTP,
così ogni ricarica prende i file appena modificati. Solo su 127.0.0.1.

Uso: python3 tools/server_sviluppo.py [porta]   (predefinita 8118)
"""
import functools
import http.server
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent


class SenzaCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json", ".js": "text/javascript", ".mjs": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8118
    gestore = functools.partial(SenzaCache, directory=str(RADICE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", porta), gestore) as server:
        print(f"Interventi 118 su http://localhost:{porta}/")
        server.serve_forever()


if __name__ == "__main__":
    main()
