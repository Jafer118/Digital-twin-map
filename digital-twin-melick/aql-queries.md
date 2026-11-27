# AQL-queries en indexen: Digital Twin Melick

Aanname datamodel (pas aan als jouw velden anders heten):

```json
// locaties / voorzieningen / meldingen
{ "naam": "Dorpskern Melick", "wijk": "Melick-Centrum", "status": "actief",
  "categorie": "historisch",
  "geometry": { "type": "Point", "coordinates": [6.0373, 51.1604] } }   // GeoJSON = [lng, lat]!

// routes
{ "naam": "Busroute 73", "wijk": "Melick-Zuid", "status": "actief",
  "geometry": { "type": "LineString", "coordinates": [[5.98,51.17],[5.99,51.18]] } }
```

## 1. Documenten ophalen

```aql
FOR d IN locaties      LIMIT 500 RETURN d
FOR d IN routes        LIMIT 500 RETURN d
FOR d IN voorzieningen LIMIT 500 RETURN d
FOR d IN meldingen     SORT d.datum DESC LIMIT 500 RETURN d
```

Eén document: `RETURN DOCUMENT("locaties/12345")`

## 2. Filteren

**Op wijk**
```aql
FOR d IN locaties
  FILTER d.wijk == @wijk          // bv. "Melick-Centrum", "Melick-Zuid", "Melick-Oost", "Waterschei"
  RETURN d
```

**Op status**
```aql
FOR d IN meldingen
  FILTER d.status == @status      // bv. "open", "in_behandeling", "afgehandeld"
  SORT d.datum DESC
  RETURN d
```

**Op kaartgebied (bounding box)**, wat Leaflet via `map.getBounds()` levert:
```aql
// @bbox is een GeoJSON-polygon; GeoJSON-volgorde is [lng, lat]
FOR d IN locaties
  FILTER GEO_CONTAINS(@bbox, d.geometry)
  RETURN d
```
Bind-variabele (west, zuid, oost, noord):
```json
{ "bbox": { "type": "Polygon",
  "coordinates": [[[6.00,51.14],[6.08,51.14],[6.08,51.18],[6.00,51.18],[6.00,51.14]]] } }
```

**Voor routes (lijnen) gebruik je `GEO_INTERSECTS`** i.p.v. `GEO_CONTAINS`:
```aql
FOR d IN routes FILTER GEO_INTERSECTS(@bbox, d.geometry) RETURN d
```

**Combineren**
```aql
FOR d IN meldingen
  FILTER d.wijk == @wijk
  FILTER d.status == @status
  FILTER GEO_CONTAINS(@bbox, d.geometry)
  SORT d.datum DESC
  LIMIT 1000
  RETURN d
```

**Wijk dichtbij een punt** (bv. alles binnen 500 m van het kerkplein):
```aql
FOR d IN voorzieningen
  LET afstand = GEO_DISTANCE(d.geometry, GEO_POINT(6.0373, 51.1604))
  FILTER afstand <= 500
  SORT afstand
  RETURN MERGE(d, { afstand })
```

## 3. Indexen (ArangoDB-webinterface)

Ga naar http://localhost:8529 → database `digital_twin_melick` → **Collections** → kies collectie → tabblad **Indexes** → **+** (Add index).

Doe dit voor `locaties`, `voorzieningen`, `meldingen` en `routes`:

| Type | Fields | Opties | Waarvoor |
|---|---|---|---|
| **Geo Index** | `geometry` | **GeoJSON = true** | `GEO_CONTAINS`, `GEO_INTERSECTS`, `GEO_DISTANCE` en bounding box |
| **Persistent Index** | `wijk` | (Unique = nee, Sparse = nee) | filter op wijk |
| **Persistent Index** | `status` | idem | filter op status |
| **Persistent Index** | `wijk, status` | idem | gecombineerd filter |

Alleen voor `meldingen` ook:

| Type | Fields | Waarvoor |
|---|---|---|
| **Persistent Index** | `datum` | `SORT d.datum DESC` |

Tips:
- "GeoJSON" aanvinken is essentieel, anders verwacht ArangoDB `[lat, lng]` en staan je punten verkeerd.
- Controleer met **Explain** (tabblad *Queries*) dat de query `IndexNode` gebruikt en geen `EnumerateCollectionNode`.
- Een `FILTER x == @a OR ...` kan een index uitschakelen. Daarom bouwt `server.py` alleen de FILTER-regels op die echt nodig zijn.
