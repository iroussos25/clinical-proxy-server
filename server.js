const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// Trust the first proxy (ALB, CloudFront, API Gateway, etc.) so that
// rate-limiting and logging see the real client IP, not the proxy's.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// HIPAA COMPLIANCE NOTE
// This is a demonstration application using *synthetic* FHIR data from the
// public HAPI FHIR sandbox. No real Protected Health Information (PHI) is
// transmitted or stored. The safeguards below illustrate the controls that
// would be present in a production clinical system.
// ---------------------------------------------------------------------------

// ========================== 1. SECURITY MIDDLEWARE ==========================

// Helmet — sets secure HTTP headers (X-Content-Type-Options, Strict-Transport-
// Security, X-Frame-Options, etc.) to mitigate common web vulnerabilities.
app.use(helmet());

// CORS — restrict to known frontend origins instead of wildcard "*".
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://b9ubzeabav.us-east-1.awsapprunner.com', 'http://localhost:3000'];

app.use(cors({
    origin(origin, callback) {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS policy'));
        }
    },
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting — prevents abuse / brute-force; HIPAA §164.312(a)(1).
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15-minute window
    max: 100,                   // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please try again later.' },
});
app.use(limiter);

app.use(express.json());

// ============================= 2. AUDIT LOG ================================
// HIPAA §164.312(b) — Record and examine access activity.  In production this
// would feed into a SIEM; here we write an append-only log file.

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const auditStream = fs.createWriteStream(path.join(logDir, 'audit.log'), { flags: 'a' });

// Apache-combined-style log written to file for audit trail
app.use(morgan('combined', { stream: auditStream }));

// Lightweight console log for dev convenience
app.use(morgan('dev'));

// ============================ 3. FHIR CONFIG ===============================

const FHIR_BASE = process.env.FHIR_BASE || 'https://hapi.fhir.org/baseR4';

// ============================== 4. ROUTES ==================================

// Health Check — no PHI exposed
app.get('/', (_req, res) => {
    res.json({
        status: 'online',
        demo: true,
        notice: 'This server proxies synthetic FHIR data for demonstration purposes only. No real PHI is handled.',
    });
});

// Patient Proxy
app.get('/api/clinical/patient', async (_req, res) => {
    try {
        const response = await axios.get(`${FHIR_BASE}/Patient/lt-sulu`);
        res.json(response.data);
    } catch (error) {
        console.error('Patient fetch error:', error.message);
        res.status(502).json({ error: 'Upstream clinical data source unavailable.' });
    }
});

// Vitals Proxy
app.get('/api/clinical/vitals', async (_req, res) => {
    try {
        const response = await axios.get(
            `${FHIR_BASE}/Observation?patient=lt-sulu&category=vital-signs&_sort=-date&_count=200`
        );
        res.json(response.data);
    } catch (error) {
        console.error('Vitals fetch error:', error.message);
        res.status(502).json({ error: 'Upstream clinical data source unavailable.' });
    }
});

// ======================== 5. ERROR HANDLING =================================
// Catch-all — never leak stack traces or internal details (HIPAA §164.312(e)).
app.use((_req, res) => {
    res.status(404).json({ error: 'Resource not found.' });
});

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
});

// ============================ 6. LISTENER ==================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Clinical Proxy Server active on http://localhost:${PORT}`);
    console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`   Audit log:    ${path.join(logDir, 'audit.log')}`);
});

// Keep process alive for your specific environment
setInterval(() => {}, 1000000);