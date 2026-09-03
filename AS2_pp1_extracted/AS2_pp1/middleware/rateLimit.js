// ============================================================
// middleware/rateLimit.js — LIMITADOR DE INTENTOS
// Frena la fuerza bruta contra los endpoints de credenciales:
// sin esto, alguien puede probar miles de contrasenas por minuto
// contra /api/auth/login hasta acertar una.
//
// Es un contador en memoria por IP: simple, sin dependencias nuevas.
// Como vive en memoria, se reinicia cuando se reinicia el servidor y no
// se comparte entre varias instancias; para este proyecto alcanza.
// ============================================================

// Cuantos intentos se permiten por ventana, y cuanto dura la ventana
const MAX_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

// Mapa: IP → { intentos, expira }
const intentosPorIp = new Map();

// Limpieza periodica de las entradas vencidas, para que el Map no crezca
// indefinidamente si el servidor queda levantado mucho tiempo.
// unref() evita que este timer mantenga vivo el proceso al apagarlo.
const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [ip, dato] of intentosPorIp) {
        if (dato.expira <= ahora) intentosPorIp.delete(ip);
    }
}, VENTANA_MS);
if (typeof limpieza.unref === 'function') limpieza.unref();

const limitarIntentos = (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
    const ahora = Date.now();
    const dato = intentosPorIp.get(ip);

    // Si la ventana anterior ya vencio, se descarta y se empieza de cero
    if (dato && dato.expira <= ahora) intentosPorIp.delete(ip);

    const actual = intentosPorIp.get(ip);
    if (actual && actual.intentos >= MAX_INTENTOS) {
        const segundos = Math.ceil((actual.expira - ahora) / 1000);
        res.set('Retry-After', String(segundos));
        return res.status(429).json({
            error: `Demasiados intentos. Volve a probar en ${Math.ceil(segundos / 60)} minuto(s).`
        });
    }

    // Solo contamos los intentos FALLIDOS: un login correcto no gasta cupo, asi
    // que alguien que entra bien varias veces seguidas nunca se auto-bloquea.
    // Un 4xx/5xx (password incorrecta, DNI inexistente) si suma.
    res.on('finish', () => {
        if (res.statusCode < 400) {
            intentosPorIp.delete(ip);
            return;
        }
        // 429 propio: ya esta contabilizado, no lo sumamos de nuevo
        if (res.statusCode === 429) return;

        const previo = intentosPorIp.get(ip);
        if (previo && previo.expira > Date.now()) previo.intentos++;
        else intentosPorIp.set(ip, { intentos: 1, expira: Date.now() + VENTANA_MS });
    });

    next();
};

module.exports = { limitarIntentos };
