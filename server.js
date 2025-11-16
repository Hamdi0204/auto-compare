import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ------------------------
// API-Route
// ------------------------
app.get('/api/compare', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Parameter "url" fehlt.' });
  }

  try {
    // optionale Überschreibungen aus Query lesen
    const overrides = {};
    if (req.query.year) overrides.year = parseInt(req.query.year, 10);
    if (req.query.km) overrides.km = parseInt(req.query.km, 10);
    if (req.query.fuel) overrides.fuel = req.query.fuel;
    if (req.query.transmission) overrides.transmission = req.query.transmission;
    if (req.query.price) overrides.price = parseInt(req.query.price, 10);
    if (req.query.powerHp) overrides.powerHp = parseInt(req.query.powerHp, 10);

    // Ausgangsfahrzeug mit URL + Overrides bauen
    const baseCar = await extractCarFromListing(url, overrides);

    // Vergleichsfahrzeuge auf Basis dieses Fahrzeugs erzeugen
    const comparables = await findComparables(baseCar);

    res.json({ baseCar, comparables });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'Interner Fehler', details: err.message });
  }
});

// ------------------------
// Ausgangsfahrzeug
// ------------------------
async function extractCarFromListing(url, overrides = {}) {
  const u = new URL(url);
  const host = u.hostname;

  // Marke & Modell aus der URL erraten
  const { make, model } = guessMakeModelFromUrl(u);

  // Basis-Dummywerte
  const base = {
    url,
    source: host,
    make,
    model,
    year: 2017,
    km: 85000,
    fuel: 'Benzin',
    transmission: 'Automatik',
    powerHp: 150,
    price: 15990,
  };

  // Nutzerwerte überschreiben Dummywerte
  return { ...base, ...overrides };
}

// ------------------------
// Vergleichsfahrzeuge generieren
// ------------------------
async function findComparables(baseCar) {
  const platforms = ['mobile.de', 'autoscout24.de', 'kleinanzeigen.de'];
  const comparables = [];

  const basePrice = baseCar.price || 10000;
  const baseKm = baseCar.km || 100000;
  const baseYear = baseCar.year || 2015;
  const baseHp = baseCar.powerHp || 120; // Eingabe-PS, sonst 120

  // Regeln nach deinem Wunsch:
  const minYear = baseYear - 1;
  const maxYear = baseYear + 1;

  const maxKm = baseKm + 25000;      // 0 bis Eingabe + 25.000 km
  const minHp = baseHp;              // mindestens Eingabe-PS
  const maxHp = baseHp + 80;         // nach oben offen (ca. +80 PS)

  for (let i = 0; i < 10; i++) {
    const year = randomInt(minYear, maxYear);       // ±1 Jahr
    const km = randomInt(0, maxKm);                 // 0–(eingabe+25k)
    const powerHp = randomInt(minHp, maxHp);        // ab Eingabe-PS

    // Preis: zufällig um deinen Preis herum (ca. -15% bis +15%)
    const priceFactor = 0.85 + Math.random() * 0.30;
    const price = Math.round(basePrice * priceFactor);

    const platform = platforms[i % platforms.length];
    const exampleUrl = `https://www.${platform}/fiktives-inserat-${i + 1}`;

    const priceDiffPercent = ((price - basePrice) / basePrice) * 100;

    comparables.push({
      source: platform.replace('.de', ''),
      url: exampleUrl,
      title: `${baseCar.make} ${baseCar.model} ${year}`,
      make: baseCar.make,
      model: baseCar.model,
      year,
      km,
      fuel: baseCar.fuel,
      transmission: baseCar.transmission,
      powerHp,
      price,
      priceDiffPercent,
    });
  }

  return comparables;
}

// einfache Zufallszahl-Funktion
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ------------------------
// Marke/Modell aus URL
// ------------------------
function guessMakeModelFromUrl(u) {
  const knownMakes = [
    'audi', 'vw', 'volkswagen', 'bmw', 'mercedes', 'mercedes-benz',
    'seat', 'skoda', 'opel', 'ford', 'toyota', 'hyundai', 'kia',
    'peugeot', 'citroen', 'renault', 'fiat', 'mazda', 'nissan',
    'honda', 'volvo', 'porsche', 'mini', 'smart',
  ];

  let path = u.pathname.toLowerCase();
  const segments = path.split('/').filter(Boolean);

  // vorletzten Teil nehmen (audi-a3-...) statt ID am Ende
  let slug =
    segments.length >= 2
      ? segments[segments.length - 2]
      : segments[segments.length - 1];

  // Dateiendung entfernen
  slug = slug.replace(/\.[a-z0-9]+$/, '');

  const parts = slug.split('-').filter(Boolean);

  let makeIndex = parts.findIndex((p) => knownMakes.includes(p));
  if (makeIndex === -1) {
    makeIndex = 0; // Fallback
  }

  let make = parts[makeIndex] || '';
  let model = parts[makeIndex + 1] || '';

  if (make === 'vw') make = 'Volkswagen';
  else if (make === 'mercedes') make = 'Mercedes-Benz';
  else make = capitalize(make);

  model = model ? model.toUpperCase() : '';

  return { make, model };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ------------------------
// Server starten
// ------------------------
app.listen(PORT, () => {
  console.log(`API läuft auf http://localhost:${PORT}`);
});
