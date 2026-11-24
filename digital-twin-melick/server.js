// server.js: kleine webserver zonder frameworks (alleen ingebouwde Node-modules, Node 18+)
// Start met:  node server.js   en open  http://localhost:8080

const http = require('http');
const fs   = require('fs');
const path = require('path');

// --- Instellingen ---
const POORT  = 8080;
const ARANGO = 'http://localhost:8529';
const DB     = 'digital_twin_melick';
const USER   = process.env.ARANGO_USER || 'root';
const PASS   = process.env.ARANGO_PASS || '';

// Alleen deze collecties mogen opgevraagd worden (whitelist)
const TOEGESTAAN = ['locaties', 'routes', 'voorzieningen', 'meldingen'];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
};

// --- AQL opbouwen: alleen de FILTERs die nodig zijn (houdt indexen bruikbaar) ---
function bouwQuery(q) {
  const laag = q.get('laag');
  if (!TOEGESTAAN.includes(laag)) return null;

  let aql = 'FOR d IN @@col ';
  const bindVars = { '@col': laag };

  if (q.get('wijk'))   { aql += 'FILTER d.wijk == @wijk ';     bindVars.wijk   = q.get('wijk'); }
  if (q.get('status')) { aql += 'FILTER d.status == @status '; bindVars.status = q.get('status'); }

  if (q.get('bbox')) {                         // west,zuid,oost,noord
    const [w, s, e, n] = q.get('bbox').split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) {
      bindVars.bbox = { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
      aql += laag === 'routes'
        ? 'FILTER GEO_INTERSECTS(@bbox, d.geometry) '
        : 'FILTER GEO_CONTAINS(@bbox, d.geometry) ';
    }
  }
  aql += 'LIMIT 1000 RETURN d';
  return { query: aql, bindVars, batchSize: 1000 };
}

// --- /api: vraag ArangoDB ---
async function api(url, res) {
  const body = bouwQuery(url.searchParams);
  if (!body) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ fout: 'Onbekende laag' }));
  }
  try {
    const r = await fetch(`${ARANGO}/_db/${DB}/_api/cursor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.errorMessage || 'HTTP ' + r.status);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data.result));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ fout: 'ArangoDB niet bereikbaar of query mislukt', detail: e.message }));
  }
}

// --- Statische bestanden (index.html, app.js, ...) ---
function bestand(url, res) {
  const naam = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const pad  = path.join(__dirname, path.normalize(naam));
  if (!pad.startsWith(__dirname)) { res.writeHead(403); return res.end(); }   // geen ../ trucs
  fs.readFile(pad, (err, inhoud) => {
    if (err) { res.writeHead(404); return res.end('Niet gevonden'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(pad)] || 'application/octet-stream' });
    res.end(inhoud);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api') return api(url, res);
  bestand(url, res);
}).listen(POORT, () => console.log(`Draait op http://localhost:${POORT}`));
