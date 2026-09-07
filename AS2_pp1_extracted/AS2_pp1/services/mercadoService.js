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

// ============================================================
// PRECIO HISTÓRICO
// Acciones argentinas: data912.com SÍ tiene un endpoint de historico
// (/historical/stocks/:ticker, serie diaria completa desde ~2002). Para
// acciones extranjeras data912 NO lo tiene (solo trae el panel en vivo),
// asi que para esas se usa el chart API publico de Yahoo Finance
// (query1.finance.yahoo.com/v8/finance/chart) — no pide API key y es de
// uso muy comun en proyectos que necesitan una serie historica gratis.
// Cada simbolo se cachea 10 minutos: la serie historica no cambia
// intradiario salvo la ultima vela, no hace falta pedirla mas seguido.
// ============================================================

const TTL_HISTORICO_MS = 10 * 60 * 1000;
const cacheHistorico = new Map(); // clave: `${mercado}:${simbolo}:${rango}` -> { puntos, expira }

// Cuantos dias de calendario hacia atras entran en cada rango (para recortar
// la serie diaria completa de data912). 'MAX' no recorta nada.
const DIAS_POR_RANGO = { '1M': 31, '3M': 93, '6M': 186, '1A': 366 };

// Rango -> parametros del chart API de Yahoo (range + interval)
const YAHOO_POR_RANGO = {
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1A': { range: '1y', interval: '1d' },
    MAX: { range: 'max', interval: '1wk' },
};

const historicoArgentino = async (simbolo, rango) => {
    const { data } = await axios.get(`https://data912.com/historical/stocks/${encodeURIComponent(simbolo)}`, { timeout: 8000 });
    const serie = (Array.isArray(data) ? data : []).map((f) => ({ fecha: f.date, cierre: Number(f.c) }));
    if (rango === 'MAX' || !DIAS_POR_RANGO[rango]) return serie;

    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_POR_RANGO[rango]);
    const limiteISO = limite.toISOString().slice(0, 10);
    return serie.filter((p) => p.fecha >= limiteISO);
};

const historicoExtranjero = async (simbolo, rango) => {
    const { range, interval } = YAHOO_POR_RANGO[rango] || YAHOO_POR_RANGO['1A'];
    const { data } = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}`,
        { params: { range, interval }, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
    );
    const resultado = data?.chart?.result?.[0];
    if (!resultado) return [];

    const timestamps = resultado.timestamp || [];
    const cierres = resultado.indicators?.quote?.[0]?.close || [];
    return timestamps
        .map((ts, i) => ({ fecha: new Date(ts * 1000).toISOString().slice(0, 10), cierre: cierres[i] }))
        .filter((p) => p.cierre != null);
};

// Serie de precios de cierre para graficar, ya recortada al rango pedido
const obtenerHistorico = async (mercado, simbolo, rango) => {
    const rangoValido = ['1M', '3M', '6M', '1A', 'MAX'].includes(rango) ? rango : '1A';
    const clave = `${mercado}:${simbolo.toUpperCase()}:${rangoValido}`;
    const ahora = Date.now();

    const cacheado = cacheHistorico.get(clave);
    if (cacheado && ahora < cacheado.expira) return cacheado.puntos;

    try {
        const puntos = mercado === 'ACCION_AR'
            ? await historicoArgentino(simbolo, rangoValido)
            : await historicoExtranjero(simbolo, rangoValido);

        cacheHistorico.set(clave, { puntos, expira: ahora + TTL_HISTORICO_MS });
        return puntos;
    } catch (error) {
        if (cacheado) return cacheado.puntos; // vencido pero mejor que nada
        return [];
    }
};

module.exports = { obtenerCotizaciones, buscarSimbolo, obtenerHistorico };
