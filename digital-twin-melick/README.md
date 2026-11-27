# Digital Twin Melick

HTML + CSS + JavaScript (Leaflet) in de browser, een kleine Python-server en ArangoDB.
Geen frameworks en geen pip-pakketten: `server.py` gebruikt alleen wat in Python zit (Python 3.8 of hoger).

## Mapindeling

```
digital-twin-melick/
 ├─ index.html        de pagina
 ├─ style.css         de opmaak
 ├─ app.js            kaart en logica in de browser
 ├─ server.py         Python-server: deelt de pagina uit en praat met ArangoDB
 ├─ aql-queries.md    naslag: AQL-queries en indexen
 └─ lib/leaflet/      Leaflet 1.9.4 (leaflet.css, leaflet.js, map images)
```

## Lokaal draaien (je eigen computer)

Controleer Python met `python --version` (op Windows soms `py --version`). Open PowerShell in deze map:

```powershell
$env:ARANGO_PASS = "jouw-arangodb-wachtwoord"
python server.py
```

Open http://localhost:8080. Stoppen met Ctrl + C.

## Op een server (via PuTTY)

1. **Inloggen:** PuTTY → Host Name = het IP-adres, Port 22 → Open → gebruikersnaam en wachtwoord.
2. **Python controleren:** `python3 --version` (op Ubuntu staat Python 3 er meestal al op).
3. **ArangoDB:** staat het er al, sla dit over. Anders, met Docker (alleen bereikbaar op de server zelf):
   ```bash
   sudo apt update && sudo apt install -y docker.io
   sudo docker run -d --name arangodb --restart unless-stopped \
     -p 127.0.0.1:8529:8529 -e ARANGO_ROOT_PASSWORD=kies-een-wachtwoord \
     -v arangodb_data:/var/lib/arangodb3 arangodb/arangodb
   ```
   Maak daarna in de database `digital_twin_melick` de vier collecties aan (zie de webinterface, of via een SSH-tunnel naar poort 8529).
4. **Bestanden uploaden:** met WinSCP (of `pscp` uit PuTTY) de hele map `digital-twin-melick` naar de server kopiëren, inclusief `lib/leaflet/`.
5. **Starten:**
   ```bash
   cd digital-twin-melick
   HOST=0.0.0.0 ARANGO_PASS="jouw-wachtwoord" nohup python3 server.py > server.log 2>&1 &
   ```
   `nohup` en `&` zorgen dat de server blijft draaien als je PuTTY sluit. Stoppen: `pkill -f server.py`.
6. **Openen:** http://IP-ADRES:8080 in de browser. Lukt dat niet, dan staat poort 8080 dicht in de firewall (vraag de beheerder).

## Instellingen (omgevingsvariabelen)

| Variabele | Standaard | Betekenis |
|---|---|---|
| `ARANGO_PASS` | (leeg) | wachtwoord van ArangoDB |
| `ARANGO_USER` | root | gebruikersnaam |
| `ARANGO_URL` | http://localhost:8529 | adres van ArangoDB |
| `ARANGO_DB` | digital_twin_melick | databasenaam |
| `HOST` | 127.0.0.1 | `0.0.0.0` = ook van buiten de computer bereikbaar |
| `PORT` | 8080 | poort van de site |

## Problemen

| Melding | Oplossing |
|---|---|
| "Fout: ... HTTP 502" | Open `/api?laag=locaties` en lees `detail` |
| `User not authenticated` | `ARANGO_PASS` niet (goed) ingesteld in dit venster |
| `Connection refused` | ArangoDB draait niet of staat op een ander adres (`ARANGO_URL`) |
| Grijs vlak, geen kaart | `lib/leaflet/` ontbreekt of is leeg |
| Site niet bereikbaar op het IP | `HOST=0.0.0.0` vergeten, of poort 8080 dicht in de firewall |
