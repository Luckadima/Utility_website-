const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

// Dynamic import for node-fetch (works in CommonJS)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const transactions = [];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'templates')));

// Payment POST endpoint
app.post('/api/pay', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const option = req.body.option;

    if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

    let record = '';

    if (option === '1') {
      const kwh = (amount * 1.17).toFixed(2);
      record = `${kwh} kWh for R${amount.toFixed(2)}`;
      res.json({ success: true, message: `Estimated units: ${kwh} kWh` });
    } else if (option === '2') {
      const liters = (amount * 40).toFixed(2);
      record = `${liters} liters for R${amount.toFixed(2)}`;
      res.json({ success: true, message: `Estimated units: ${liters} liters` });
    } else if (option === '3') {
      const cubicMeters = (amount * 0.02).toFixed(2);
      record = `${cubicMeters} m³ for R${amount.toFixed(2)}`;
      res.json({ success: true, message: `Estimated units: ${cubicMeters} m³` });
    } else {
      throw new Error("Unknown utility type");
    }

    transactions.push({ timestamp: new Date().toISOString(), record });

  } catch (error) {
    console.error(error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Loadshedding proxy
app.get('/api/loadshedding', async (req, res) => {
  try {
    const response = await fetch('https://loadshedding.eskom.co.za/LoadShedding/GetStatus');
    const stage = await response.text();
    res.send(stage);
  } catch (err) {
    console.error('Failed to fetch Eskom status:', err.message);
    res.status(500).send('Error fetching loadshedding data');
  }
});

// Water status endpoint
app.get('/api/waterstatus', (req, res) => {
  const waterStatus = "No current outage updates";
  res.send(waterStatus);
});

// Serve AllUtility.html with injected transactions
app.get('/AllUtility.html', (req, res) => {
  const filePath = path.join(__dirname, 'templates', 'AllUtility.html');

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).send("Error loading page");

    const listHTML = transactions.map(item => `<p>${item.record}</p>`).join('');
    const updatedHTML = html.replace('<!-- Transaction data can go here -->', listHTML);

    res.send(updatedHTML);
  });
});

// Load gas suppliers JSON from static folder
const gasSuppliers = require('./static/gasSuppliers.json');

// Haversine formula to calculate distance between two lat/lng points in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

app.post('/api/find-nearest-gas', async (req, res) => {
  try {
    const userAddress = req.body.address;
    if (!userAddress) return res.status(400).json({ error: 'Address is required' });

    // Geocode user address with User-Agent header (Nominatim requirement)
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(userAddress)}`, {
      headers: { 'User-Agent': 'Utility Website (lukekadima1942@gmail.com)' }
    });
    const geoData = await geoRes.json();

    if (!geoData.length) return res.status(404).json({ error: 'Address not found' });

    const userLat = parseFloat(geoData[0].lat);
    const userLng = parseFloat(geoData[0].lon);

    // Calculate distances to suppliers
    const suppliersWithDistance = gasSuppliers.map(supplier => {
      const dist = getDistanceFromLatLonInKm(userLat, userLng, supplier.lat, supplier.lng);
      return { ...supplier, distanceKm: dist };
    });

    suppliersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    const closest = suppliersWithDistance[0];

    // Only return if within 50 km, otherwise return error
    if (closest.distanceKm > 50) {
      return res.status(404).json({ error: 'No nearby gas supplier found within 50 km.' });
    }

    res.json({ nearestSupplier: closest });

  } catch (error) {
    console.error('Error in /api/find-nearest-gas:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});














