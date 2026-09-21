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

// En Render (y en cualquier hosting) la app corre detras de un proxy: el pedido
// llega con la IP del proxy y la del cliente real en el header X-Forwarded-For.
// Sin esto req.ip devuelve siempre la misma IP, y el limitador de intentos
// bloquearia a TODOS los usuarios cuando alguien falla 10 logins seguidos.
// TRUST_PROXY=1 en produccion; vacio en local, donde no hay proxy que confiar.
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

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
const servicioRoutes = require('./routes/servicioRoutes'); // /api/servicios (agua, luz, gas)
const recargaRoutes  = require('./routes/recargaRoutes');  // /api/recargas (recarga de celular)
const reporteRoutes  = require('./routes/reporteRoutes');  // /api/reportes (reportes de problemas de la app)
const inversionRoutes = require('./routes/inversionRoutes'); // /api/inversiones y /api/cauciones

// tablaController se usa directamente aquí (no tiene archivo de rutas propio)
const tablaController = require('./controllers/tablaController');

// Middlewares de seguridad: el guardián de rutas y el limitador de intentos de login
const { verificarToken, verificarAdmin } = require('./middleware/authMiddleware');
const { limitarIntentos, limitarReportes } = require('./middleware/rateLimit');
const { ocultarDetalles } = require('./middleware/ocultarDetalles');

// También importamos la función de sync para usarla en el cron job
const { ejecutarSync } = require('./routes/sync');

// Chequeo automático de préstamos vencidos (mora), para el otro cron job
const { ejecutarVerificacionMoraAutomatica } = require('./services/moraService');

// Chequeo automático de pólizas impagas (caducidad), para el otro cron job
const { ejecutarVerificacionPolizasVencidas } = require('./services/polizaService');

// Liquidación automática de cauciones vencidas, para el otro cron job
const { ejecutarLiquidacionCauciones } = require('./services/caucionLiquidacionService');

// ---- MIDDLEWARES GLOBALES ----
// Un middleware es código que se ejecuta ANTES de llegar a las rutas.
// Estos dos son obligatorios en todo backend Express:

// Habilita CORS solo para los origenes del frontend.
// CORS_ORIGINS en el .env acepta varios separados por coma; si no esta definido,
// se permiten los puertos locales de Vite para no romper el desarrollo.
const origenesPermitidos = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Un origen puede empezar con * para cubrir los dominios que cambian solos:
// los deploy previews de Netlify llegan como https://<rama>--tree-bank.netlify.app,
// asi que con "*--tree-bank.netlify.app" en CORS_ORIGINS quedan todos cubiertos
// sin abrir la API a cualquier sitio.
const terminacionesPermitidas = origenesPermitidos
    .filter(o => o.startsWith('*'))
    .map(o => o.slice(1));

app.use(cors({
    origin: (origin, callback) => {
        // Sin header Origin (curl, Postman, healthchecks) se deja pasar:
        // el navegador es el unico que manda Origin y el unico al que hay que proteger
        if (!origin || origenesPermitidos.includes(origin)) return callback(null, true);
        if (terminacionesPermitidas.some(fin => origin.endsWith(fin))) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'));
    }
}));

// Permite leer JSON en el body de los pedidos (req.body).
// El limite de tamano evita que alguien mande un body gigante y tumbe el proceso.
app.use(express.json({ limit: '100kb' }));

// En produccion, evita que los errores internos (mensajes de Postgres, del
// Banco Central, rutas de archivos) salgan en las respuestas 5xx.
app.use(ocultarDetalles);

// ---- RUTAS ----
// Acá conectamos todos los archivos de rutas bajo el prefijo /api
// Ejemplo: personaRoutes tiene POST /personas → queda disponible como POST /api/personas
// Los endpoints de credenciales van detras de un limitador de intentos:
// sin esto se puede probar contrasenas por fuerza bruta a full velocidad.
app.use('/api/auth/login', limitarIntentos);
app.use('/api/auth/register', limitarIntentos);
app.use('/api/auth/olvide-password', limitarIntentos);

// El endpoint de reportes es publico (puede fallar justo el login) asi que
// tambien va limitado por IP, para que no lo usen para llenar la tabla de spam
app.use('/api/reportes', limitarReportes);

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
app.use('/api', servicioRoutes);
app.use('/api', recargaRoutes);
app.use('/api', reporteRoutes);
app.use('/api', inversionRoutes);

// Esta ruta vuelca una tabla entera de la base: es una herramienta de back-office,
// solo para ADMIN. Estando abierta, GET /api/tablas/personas devolvia el DNI, el
// email y el hash de contrasena de todos los clientes, y /api/tablas/cuentas_bancarias
// el CBU y el saldo de cada cuenta del banco, a cualquiera sin login.
app.get('/api/tablas/:tabla', verificarToken, verificarAdmin, tablaController.obtenerTabla);

// ---- HEALTHCHECK ----
// Ruta publica y barata que solo dice "estoy vivo". La usa Render para saber si
// el deploy quedo sano, y sirve para el ping que mantiene despierta la instancia
// gratuita (se duerme a los 15 minutos sin trafico y ahi se cortan los cron jobs).
app.get('/health', (req, res) => {
    res.json({ ok: true, servicio: 'tree-bank-api', uptime: Math.round(process.uptime()) });
});

// ---- MANEJO DE RUTAS INEXISTENTES (404) ----
// Si alguien llama a una URL que no existe, respondemos con error 404
app.use((req, res) => {
    res.status(404).json({ error: "La ruta solicitada no existe." });
});

// ---- MANEJO DE ERRORES ----
// Ultimo middleware de la cadena: atrapa lo que haya explotado antes
// (body JSON invalido, body demasiado grande, origen bloqueado por CORS).
// Responde en JSON y sin stack trace, para no filtrar detalles internos.
app.use((err, req, res, next) => {
    if (err.message === 'Origen no permitido por CORS') {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'El cuerpo del pedido es demasiado grande' });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'El cuerpo del pedido no es JSON valido' });
    }
    console.error('Error no controlado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ---- ARRANCAR EL SERVIDOR ----
// Sin JWT_SECRET no se pueden firmar ni verificar tokens: cortamos el arranque
// aca en vez de dejar que cada login falle con un 500 confuso en produccion.
if (!process.env.JWT_SECRET) {
    console.error('\x1b[31m%s\x1b[0m', '✖ Falta JWT_SECRET en el .env. El servidor no puede arrancar sin esa clave.');
    process.exit(1);
}

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

// ---- CRON JOB: LIQUIDACIÓN AUTOMÁTICA DE CAUCIONES ----
// Una vez por día busca cauciones ACTIVAS cuyo plazo ya se cumplió y
// acredita capital + interés a la caja en ARS de origen.
cron.schedule('0 6 * * *', async () => {
    console.log('💰 Liquidación automática de cauciones ejecutándose...');
    const { candidatas, liquidadas } = await ejecutarLiquidacionCauciones();
    console.log(`💰 Cauciones vencidas revisadas: ${candidatas}, liquidadas: ${liquidadas}`);
});
