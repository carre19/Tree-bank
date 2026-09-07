// ============================================================
// services/mercadoService.js — COTIZACIONES EN VIVO (ACCIONES)
// Fuente: data912.com, una API publica y gratuita (sin API key) que
// publica datos reales del mercado argentino (BYMA) y estadounidense.
// No es tick-a-tick: el propio proveedor cachea unas horas del lado de
// ellos, pero el precio en si es el real de mercado, no simulado.
//
// Cada mercado se cachea unos segundos de nuestro lado para no golpear
// la API en cada request del frontend (que hace polling). Si la API
// externa falla, se devuelve el ultimo valor bueno que se tenga en
// cache (por viejo que sea) en vez de cortar la pantalla; si todavia
// no hay nada en cache, se devuelve una lista vacia con un aviso.
// ============================================================

const axios = require('axios');

const BASE_URL = 'https://data912.com/live';
const TTL_MS = 15 * 1000; // 15 segundos: suficiente para "sentirse" en vivo sin abusar de la API

const cache = {
    ACCION_AR: { datos: [], actualizado: null, expira: 0 },
    ACCION_EX: { datos: [], actualizado: null, expira: 0 },
};

const ENDPOINTS = {
    ACCION_AR: '/arg_stocks',
    ACCION_EX: '/usa_stocks',
};

// Normaliza la respuesta cruda de data912 a un formato estable para el frontend:
// simbolo, precio (ultimo/cierre), variacion % del dia, y puntas de compra/venta
// cuando la API las informa (null si el simbolo no opero puntas hoy).
const normalizar = (fila) => ({
    simbolo: fila.symbol,
    precio: Number(fila.c),
    variacion_pct: fila.pct_change != null ? Number(fila.pct_change) : null,
    punta_compra: fila.px_bid != null ? Number(fila.px_bid) : null,
    punta_venta: fila.px_ask != null ? Number(fila.px_ask) : null,
    volumen: fila.v != null ? Number(fila.v) : null,
});

const obtenerCotizaciones = async (mercado) => {
    const entrada = cache[mercado];
    const ahora = Date.now();
    if (entrada.datos.length > 0 && ahora < entrada.expira) {
        return { datos: entrada.datos, actualizado: entrada.actualizado, fuente: 'data912.com (cache)' };
    }

    try {
        const { data } = await axios.get(`${BASE_URL}${ENDPOINTS[mercado]}`, { timeout: 6000 });
        const datos = (Array.isArray(data) ? data : [])
            .filter((f) => f.c != null)
            .map(normalizar);

        entrada.datos = datos;
        entrada.actualizado = new Date().toISOString();
        entrada.expira = ahora + TTL_MS;
        return { datos, actualizado: entrada.actualizado, fuente: 'data912.com' };
    } catch (error) {
        // Sin internet o la API externa caida: devolvemos lo ultimo que teniamos
        // (aunque este vencido) en vez de dejar la pantalla vacia
        if (entrada.datos.length > 0) {
            return { datos: entrada.datos, actualizado: entrada.actualizado, fuente: 'data912.com (ultimo valor conocido, sin conexion)' };
        }
        return { datos: [], actualizado: null, fuente: 'sin datos: no se pudo conectar con data912.com' };
    }
};

// Busca un simbolo puntual dentro de las cotizaciones ya cacheadas/actualizadas
// de un mercado (se usa para validar y fijar el precio de una compra/venta)
const buscarSimbolo = async (mercado, simbolo) => {
    const { datos } = await obtenerCotizaciones(mercado);
    return datos.find((d) => d.simbolo.toUpperCase() === String(simbolo).toUpperCase()) || null;
};

module.exports = { obtenerCotizaciones, buscarSimbolo };
