// ============================================================
// services/cotizacionService.js — COTIZACIÓN DEL DÓLAR OFICIAL
// Orden de búsqueda: 1) Banco Central del profe (por si algún día expone
// una cotización propia) 2) DolarAPI (pública y gratuita, dólar oficial)
// 3) valor fijo de .env como último recurso si no hay internet.
// Se cachea 5 minutos para no golpear las APIs externas en cada operación.
// ============================================================

const axios = require('axios');
const centralBank = require('./centralBankClient');

const FALLBACK = {
    compra: Number(process.env.COTIZACION_USD_FALLBACK_COMPRA || 1000),
    venta: Number(process.env.COTIZACION_USD_FALLBACK_VENTA || 1050),
    fuente: 'valor fijo (.env, sin conexion a APIs externas)'
};

let cache = null;
let cacheHasta = 0;

const obtenerCotizacionOficial = async () => {
    const ahora = Date.now();
    if (cache && ahora < cacheHasta) return cache;

    // 1) Banco Central del profe (no documenta este endpoint hoy, pero lo intentamos igual)
    try {
        const r = await centralBank.get('/cotizacion');
        if (r.data?.compra && r.data?.venta) {
            cache = { compra: Number(r.data.compra), venta: Number(r.data.venta), fuente: 'Banco Central' };
            cacheHasta = ahora + 5 * 60 * 1000;
            return cache;
        }
    } catch (_) { /* no existe o esta caido: seguimos con DolarAPI */ }

    // 2) DolarAPI — cotizacion oficial, publica y sin necesidad de API key
    try {
        const r = await axios.get('https://dolarapi.com/v1/dolares/oficial', { timeout: 5000 });
        cache = { compra: Number(r.data.compra), venta: Number(r.data.venta), fuente: 'DolarAPI (oficial)' };
        cacheHasta = ahora + 5 * 60 * 1000;
        return cache;
    } catch (_) { /* sin internet o DolarAPI caido: usamos el fallback fijo */ }

    // 3) Ultimo recurso: valor fijo, se reintenta pronto por si vuelve la conexion
    cache = { ...FALLBACK };
    cacheHasta = ahora + 60 * 1000;
    return cache;
};

module.exports = { obtenerCotizacionOficial };
