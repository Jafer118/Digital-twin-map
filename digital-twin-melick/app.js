// app.js: Digital Twin Melick (vanilla JS + Leaflet)

// 1. Kaart met PDOK-achtergrond (Nederlandse overheid, geen Amerikaanse tiles)
const kaart = L.map('kaart').setView([51.1717, 5.9833], 14);
L.tileLayer('https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: 'Kaartgegevens &copy; <a href="https://www.pdok.nl">PDOK</a> / Kadaster'
}).addTo(kaart);

// 2. Per laag een eigen LayerGroup, zodat aan/uit zetten simpel is
const lagen = {
  locaties:      L.layerGroup().addTo(kaart),
  voorzieningen: L.layerGroup().addTo(kaart),
  routes:        L.layerGroup().addTo(kaart),
  meldingen:     L.layerGroup().addTo(kaart),
};

const statusTekst = document.getElementById('status');

// 3. Data ophalen via api.php
async function laadLaag(naam) {
  const p = new URLSearchParams({ laag: naam });
  const wijk = document.getElementById('filterWijk').value;
  const status = document.getElementById('filterStatus').value;
  if (wijk) p.set('wijk', wijk);
  if (status) p.set('status', status);

  if (document.getElementById('alleenZichtbaar').checked) {
    const b = kaart.getBounds();
    p.set('bbox', [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','));
  }

  const res = await fetch('/api?' + p);
  if (!res.ok) throw new Error('Laag ' + naam + ': HTTP ' + res.status);
  return res.json();
}

// 4. Tekenen
function teken(naam, documenten) {
  lagen[naam].clearLayers();
  for (const doc of documenten) {
    if (!doc.geometry) continue;
    let laag;
    if (doc.geometry.type === 'Point') {
      const [lng, lat] = doc.geometry.coordinates;
      laag = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: `<div class="punt ${naam}"></div>`, iconSize: [14, 14] })
      });
    } else {
      laag = L.geoJSON(doc.geometry, { style: { color: '#2e9e4f', weight: 4 } });
    }
    laag.on('click', () => toonDetail(naam, doc));
    laag.addTo(lagen[naam]);
  }
}

// 5. Detailpaneel rechts (textContent i.p.v. innerHTML: voorkomt XSS)
function toonDetail(laagNaam, doc) {
  document.getElementById('dTitel').textContent = doc.naam || doc.titel || '(zonder naam)';
  const dl = document.getElementById('dVelden');
  dl.replaceChildren();
  const velden = { Laag: laagNaam, Wijk: doc.wijk, Status: doc.status, Omschrijving: doc.omschrijving };
  for (const [k, v] of Object.entries(velden)) {
    if (!v) continue;
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  document.getElementById('detail').hidden = false;
}
document.getElementById('sluit').onclick = () => document.getElementById('detail').hidden = true;

// 6. Alles (her)laden
async function ververs() {
  statusTekst.textContent = 'Laden...';
  const actief = [...document.querySelectorAll('[data-laag]')].filter(c => c.checked).map(c => c.dataset.laag);
  try {
    let totaal = 0;
    await Promise.all(Object.keys(lagen).map(async naam => {
      if (!actief.includes(naam)) { lagen[naam].clearLayers(); return; }
      const data = await laadLaag(naam);
      teken(naam, data);
      totaal += data.length;
    }));
    statusTekst.textContent = totaal + ' objecten geladen.';
  } catch (e) {
    statusTekst.textContent = 'Fout: ' + e.message;
  }
}

// 7. Events
document.querySelectorAll('[data-laag], #filterWijk, #filterStatus, #alleenZichtbaar')
  .forEach(el => el.addEventListener('change', ververs));

let timer;
kaart.on('moveend', () => {              // niet bij elke pixel opnieuw laden
  if (!document.getElementById('alleenZichtbaar').checked) return;
  clearTimeout(timer);
  timer = setTimeout(ververs, 300);
});

ververs();
