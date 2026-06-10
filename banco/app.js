require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const app     = express();

const personaRoutes  = require('./routes/personaRoutes');
const bancoRoutes    = require('./routes/bancoRoutes');
const authRoutes     = require('./routes/authRoutes');
const tablaController = require('./controllers/tablaController');
const syncRoutes     = require('./routes/sync');
const { ejecutarSync } = require('./routes/sync');

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Panel de administracion (sirve public/index.html en http://localhost:3001)
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas de la API ──────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', personaRoutes);
app.use('/api', bancoRoutes);
app.use('/api', syncRoutes);
app.get('/api/tablas/:tabla', tablaController.obtenerTabla);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'La ruta solicitada no existe.' });
});

// ── Servidor ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `--- Servidor levantado en puerto ${PORT} ---`);
    console.log('\x1b[36m%s\x1b[0m', `Panel admin: http://localhost:${PORT}`);
    if (!process.env.CENTRAL_BANK_API_KEY) {
        console.log('\x1b[33m%s\x1b[0m', 'Falta la API KEY del Banco Central en .env');
    }
});

// ── Sync automatico cada 15 minutos ──────────────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
    console.log('Sync automatico ejecutandose...');
    await ejecutarSync();
});
