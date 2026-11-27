#!/usr/bin/env python3
"""server.py: kleine webserver voor Digital Twin Melick (alleen standaardbibliotheek, geen pip).

Start met:   python server.py        (Windows: soms `py server.py`)
Open daarna: http://localhost:8080

Instellingen via omgevingsvariabelen (allemaal optioneel behalve het wachtwoord):
  ARANGO_PASS   wachtwoord van ArangoDB
  ARANGO_USER   gebruikersnaam (standaard: root)
  ARANGO_URL    adres van ArangoDB (standaard: http://localhost:8529)
  ARANGO_DB     databasenaam (standaard: digital_twin_melick)
  HOST          waarop de server luistert (standaard: 127.0.0.1 = alleen deze computer)
  PORT          poort (standaard: 8080)
"""

import base64
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

# --- Instellingen ---
MAP    = os.path.dirname(os.path.abspath(__file__))
HOST   = os.environ.get("HOST", "127.0.0.1")
POORT  = int(os.environ.get("PORT", "8080"))
ARANGO = os.environ.get("ARANGO_URL", "http://localhost:8529")
DB     = os.environ.get("ARANGO_DB", "digital_twin_melick")
USER   = os.environ.get("ARANGO_USER", "root")
PASS   = os.environ.get("ARANGO_PASS", "")

# Alleen deze collecties mogen opgevraagd worden (whitelist)
TOEGESTAAN = ["locaties", "routes", "voorzieningen", "meldingen"]

# Alleen deze bestanden worden aan de browser uitgedeeld (server.py zelf dus niet)
PUBLIEK = {"/", "/index.html", "/style.css", "/app.js"}


def bouw_query(q):
    """Bouw de AQL-query. Alleen de FILTERs die nodig zijn (houdt indexen bruikbaar)."""
    laag = q.get("laag", [""])[0]
    if laag not in TOEGESTAAN:
        return None

    aql = "FOR d IN @@col "
    bind = {"@col": laag}

    wijk = q.get("wijk", [""])[0]
    status = q.get("status", [""])[0]
    if wijk:
        aql += "FILTER d.wijk == @wijk "
        bind["wijk"] = wijk
    if status:
        aql += "FILTER d.status == @status "
        bind["status"] = status

    bbox = q.get("bbox", [""])[0]
    if bbox:  # west,zuid,oost,noord
        try:
            w, s, e, n = [float(x) for x in bbox.split(",")]
        except ValueError:
            w = None
        if w is not None:
            bind["bbox"] = {"type": "Polygon",
                            "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}
            aql += ("FILTER GEO_INTERSECTS(@bbox, d.geometry) " if laag == "routes"
                    else "FILTER GEO_CONTAINS(@bbox, d.geometry) ")

    aql += "LIMIT 1000 RETURN d"
    return {"query": aql, "bindVars": bind, "batchSize": 1000}


def vraag_arango(body):
    """Stuur de query naar ArangoDB en geef de lijst met documenten terug."""
    login = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    req = Request(
        f"{ARANGO}/_db/{DB}/_api/cursor",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Basic {login}"},
        method="POST",
    )
    with urlopen(req, timeout=15) as r:
        return json.loads(r.read())["result"]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=MAP, **kwargs)

    def stuur_json(self, code, data):
        inhoud = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(inhoud)))
        self.end_headers()
        self.wfile.write(inhoud)

    def do_GET(self):
        url = urlparse(self.path)

        if url.path == "/api":
            body = bouw_query(parse_qs(url.query))
            if body is None:
                return self.stuur_json(400, {"fout": "Onbekende laag"})
            try:
                return self.stuur_json(200, vraag_arango(body))
            except HTTPError as e:      # ArangoDB antwoordde met een fout (bv. wachtwoord)
                try:
                    detail = json.loads(e.read()).get("errorMessage", f"HTTP {e.code}")
                except Exception:
                    detail = f"HTTP {e.code}"
            except (URLError, OSError, ValueError, KeyError) as e:
                detail = str(e)
            return self.stuur_json(502, {"fout": "ArangoDB niet bereikbaar of query mislukt",
                                         "detail": detail})

        # Bestanden: alleen de pagina zelf en de map lib/ (Leaflet)
        if url.path in PUBLIEK or url.path.startswith("/lib/"):
            return super().do_GET()
        self.send_error(404, "Niet gevonden")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, POORT), Handler)
    print(f"Draait op http://localhost:{POORT}   (Ctrl + C om te stoppen)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGestopt.")
