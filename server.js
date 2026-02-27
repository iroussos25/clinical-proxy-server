const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// 1. MIDDLEWARE (The Top Bun)
app.use(cors());
app.use(express.json());

// Logger to see incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} request to ${req.url}`);
    next();
});

const FHIR_BASE = 'https://hapi.fhir.org/baseR4';

// 2. THE ROUTES (The Filling)

// Health Check
app.get('/', (req, res) => {
    res.send('Clinical Proxy Server is Online');
});

// Patient Proxy
app.get('/api/clinical/patient', async (req, res) => {
    try {
        const response = await axios.get(`${FHIR_BASE}/Patient/lt-sulu`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching patient:", error.message);
        res.status(500).json({ error: "FHIR Patient Fetch Failed" });
    }
});

// Vitals Proxy
app.get('/api/clinical/vitals', async (req, res) => {
    try {
        const response = await axios.get(`${FHIR_BASE}/Observation?patient=lt-sulu&category=vital-signs&_sort=-date&_count=200`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching vitals:", error.message);
        res.status(500).json({ error: "FHIR Vitals Fetch Failed" });
    }
});

// 3. THE LISTENER (The Bottom Bun)
app.listen(PORT, () => {
    console.log(`🚀 Clinical Proxy Server active on http://localhost:${PORT}`);
});

// Keep process alive for your specific environment
setInterval(() => {}, 1000000);