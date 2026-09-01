// ============================================================
// app.js — PUNTO DE ENTRADA DEL SERVIDOR
// Este es el primer archivo que se ejecuta cuando hacés "npm start"
// Acá se configura todo Express y se conectan las rutas.
// ============================================================

// Lee el archivo .env y carga las variables de entorno (PORT, JWT_SECRET, etc.)
require('dotenv').config();

// Express es el framework que convierte Node.js en un servidor web
const express = require('express');

// CORS permite que el frontend (React en otro puerto) pueda hacer pedidos al backend
const cors = require('cors');

// node-cron permite ejecutar código automáticamente cada cierto tiempo (como un reloj)
const cron = require('node-cron');

// axios es un cliente HTTP para hacer pedidos a APIs externas (el Banco Central del profe)
const axios = require('axios');

// Creamos la aplicación Express
const app = express();

// ---- Importamos las rutas de cada módulo ----
// Cada archivo de rutas define qué URLs existen y qué función las maneja
const personaRoutes = require('./routes/personaRoutes'); // /api/personas, /api/transferencias, etc.
const bancoRoutes   = require('./routes/bancoRoutes');   // /api/bancos
const authRoutes    = require('./routes/authRoutes');    // /api/auth/login, /api/auth/register, etc.
const syncRoutes    = require('./routes/sync');          // /api/sync
const adminRoutes   = require('./routes/adminRoutes');   // /api/admin/cuentas (solo rol ADMIN)
const centralDeudoresRoutes = require('./routes/centralDeudoresRoutes'); // /api/central-deudores
const cuentaRoutes  = require('./routes/cuentaRoutes');  // /api/cuentas (cajas de ahorro ARS/USD)
const prestamoRoutes = require('./routes/prestamoRoutes'); // /api/prestamos
const cambioRoutes   = require('./routes/cambioRoutes');   // /api/cambio (compra/venta de dolares)
const tarjetaRoutes  = require('./routes/tarjetaRoutes');  // /api/tarjetas (tarjetas de credito)
const seguroRoutes   = require('./routes/seguroRoutes');   // /api/seguros (polizas)
const reservaRoutes  = require('./routes/reservaRoutes');  // /api/cuentas/:cbu/reservas, /api/reservas

// tablaController se usa directamente aquí (no tiene archivo de rutas propio)
const tablaController = require('./controllers/tablaController');

// También importamos la función de sync para usarla en el cron job
const { ejecutarSync } = require('./routes/sync');

// Chequeo automático de préstamos vencidos (mora), para el otro cron job
const { ejecutarVerificacionMoraAutomatica } = require('./services/moraService');

// Chequeo automático de pólizas impagas (caducidad), para el otro cron job
const { ejecutarVerificacionPolizasVencidas } = require('./services/polizaService');

// ---- MIDDLEWARES GLOBALES ----
// Un middleware es código que se ejecuta ANTES de llegar a las rutas.
// Estos dos son obligatorios en todo backend Express:

// Habilita CORS: sin esto el navegador bloquea los pedidos del frontend
app.use(cors());

// Permite leer JSON en el body de los pedidos (req.body)
app.use(express.json());

// ---- RUTAS ----
// Acá conectamos todos los archivos de rutas bajo el prefijo /api
// Ejemplo: personaRoutes tiene POST /personas → queda disponible como POST /api/personas
app.use('/api', authRoutes);
app.use('/api', personaRoutes);
app.use('/api', bancoRoutes);
app.use('/api', syncRoutes);
app.use('/api', adminRoutes);
app.use('/api', centralDeudoresRoutes);
app.use('/api', cuentaRoutes);
app.use('/api', prestamoRoutes);
app.use('/api', cambioRoutes);
app.use('/api', tarjetaRoutes);
app.use('/api', seguroRoutes);
app.use('/api', reservaRoutes);

// Esta ruta especial permite leer el contenido de cualquier tabla de Supabase
// Ejemplo: GET /api/tablas/personas → devuelve todas las personas
app.get('/api/tablas/:tabla', tablaController.obtenerTabla);

// ---- MANEJO DE RUTAS INEXISTENTES (404) ----
// Si alguien llama a una URL que no existe, respondemos con error 404
app.use((req, res) => {
    res.status(404).json({ error: "La ruta solicitada no existe." });
});

// ---- ARRANCAR EL SERVIDOR ----
// Leemos el puerto del .env (3001 por defecto)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `--- Servidor levantado en puerto ${PORT} ---`);
    // Avisamos si falta la API KEY del Banco Central
    if (!process.env.CENTRAL_BANK_API_KEY) {
        console.log('\x1b[33m%s\x1b[0m', "⚠️ Falta la API KEY del Banco Central en .env");
    }
});

// ---- CRON JOB: SINCRONIZACIÓN AUTOMÁTICA ----
// Esto ejecuta la función ejecutarSync cada 15 minutos automáticamente
// */15 * * * * = "cada 15 minutos, todos los días, todo el tiempo"
// Sirve para recibir transferencias de otros bancos del sistema del profe
cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Sync automático ejecutándose...');
    await ejecutarSync();
});

// ---- CRON JOB: MORA AUTOMÁTICA DE PRÉSTAMOS ----
// Una vez por día busca préstamos ACTIVOS cuya cuota venció hace más de
// DIAS_GRACIA_MORA_AUTOMATICA días y los reporta a la Central de Deudores,
// igual que el botón manual del panel de administrador.
cron.schedule('0 6 * * *', async () => {
    console.log('📋 Verificación automática de préstamos vencidos ejecutándose...');
    const { candidatos, reportados } = await ejecutarVerificacionMoraAutomatica();
    console.log(`📋 Préstamos vencidos revisados: ${candidatos}, reportados en mora: ${reportados}`);
});

// ---- CRON JOB: CADUCIDAD AUTOMÁTICA DE PÓLIZAS IMPAGAS ----
// Una vez por día busca pólizas ACTIVAS cuya prima venció hace más de
// DIAS_GRACIA_POLIZA días y las cancela (no se informa a la Central de
// Deudores: no pagar un seguro no es una deuda).
cron.schedule('0 6 * * *', async () => {
    console.log('🛡️  Verificación automática de pólizas vencidas ejecutándose...');
    const { candidatas, canceladas } = await ejecutarVerificacionPolizasVencidas();
    console.log(`🛡️  Pólizas vencidas revisadas: ${candidatas}, canceladas: ${canceladas}`);
});