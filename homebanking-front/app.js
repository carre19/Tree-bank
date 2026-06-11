require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const app = express();

// Agregamos el ".js" a todas las rutas locales para evitar que Node se pierda
const personaRoutes = require('./routes/personaRoutes.js');
const tablaController = require('./controllers/tablaControllers.js'); 
const syncRoutes = require('./routes/sync.js');
const { ejecutarSync } = require('./routes/sync.js');

app.use(cors());
app.use(express.json());

// Sirve el frontend (HTML, CSS, JS)
app.use(express.static('public'));

// Rutas API
app.use('/api', personaRoutes);
app.use('/api', syncRoutes);
app.get('/api/tablas/:tabla', tablaController.obtenerTabla);

// 404
app.use((req, res) => {
    res.status(404).json({ error: "La ruta solicitada no existe." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `--- Servidor levantado en puerto ${PORT} ---`);
    if (!process.env.CENTRAL_BANK_API_KEY) {
        console.log('\x1b[33m%s\x1b[0m', "⚠️  Falta la API KEY del Banco Central en .env");
    }
});

// Cronjob para sincronización cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Sync automático ejecutándose...');
    await ejecutarSync();
});