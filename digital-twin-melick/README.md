# Digital Twin Melick

HTML + CSS + vanilla JavaScript (Leaflet) met een kleine Node.js-server en ArangoDB. Geen PHP, geen frameworks, geen npm-pakketten.

## Mapindeling

```
digital-twin-melick/
 ├─ index.html        de pagina
 ├─ style.css         de opmaak
 ├─ app.js            kaart en logica in de browser
 ├─ server.js         Node-server: serveert de pagina en praat met ArangoDB
 ├─ aql-queries.md    AQL-queries en indexen
 └─ lib/leaflet/      hier zet JIJ Leaflet in (zie stap 1)
```

## Stap 1: Leaflet erbij zetten

1. Download Leaflet 1.9 van https://leafletjs.com (knop Download) en pak het uit.
2. Kopieer `leaflet.css`, `leaflet.js` en de map `images` naar `lib/leaflet/`.

## Stap 2: Node.js installeren

Download de LTS-versie van https://nodejs.org (versie 18 of hoger). Controleer met `node -v`.

## Stap 3: ArangoDB voorbereiden

- Maak de indexen aan zoals beschreven in `aql-queries.md` (sectie 3).
- Voeg een testdocument toe aan `locaties`:

```json
{
  "naam": "Dorpskern Melick",
  "wijk": "Melick-Centrum",
  "status": "actief",
  "omschrijving": "Test",
  "geometry": { "type": "Point", "coordinates": [5.9833, 51.1717] }
}
```

Let op: eerst lengtegraad (5.98), dan breedtegraad (51.17).

## Stap 4: Starten

Open PowerShell in deze map en typ:

```powershell
$env:ARANGO_PASS = "jouw-arangodb-wachtwoord"
node server.js
```

Open daarna http://localhost:8080. Stoppen kan met Ctrl + C.

## Problemen

| Melding | Oplossing |
|---|---|
| "0 objecten geladen" | Controleer of `geometry` goed is ingevuld |
| "Fout: ... HTTP 502" | Draait Docker/ArangoDB? Klopt het wachtwoord? |
| Kaart zonder tegels | Controleer `lib/leaflet/` en je internetverbinding (PDOK) |
| Pagina laadt niet | Draait `node server.js` nog? |
