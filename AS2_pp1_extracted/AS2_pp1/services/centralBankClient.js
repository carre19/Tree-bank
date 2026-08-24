// ============================================================
// services/centralBankClient.js — CLIENTE HTTP DEL BANCO CENTRAL
// Instancia única de axios para hablar con la API del Banco Central.
// Antes cada controller armaba sus propios headers (x-api-key,
// x-environment) y repetía process.env.CENTRAL_BANK_URL a mano.
// Con esto alcanza con: const centralBank = require('../services/centralBankClient')
// y despues centralBank.get('/banks'), centralBank.post('/persons', {...}), etc.
// ============================================================

const axios = require('axios');

const centralBank = axios.create({
    baseURL: process.env.CENTRAL_BANK_URL
});

// Se agregan los headers obligatorios en cada pedido, tomando el valor
// mas actual de las variables de entorno (por si cambian en runtime/tests)
centralBank.interceptors.request.use((config) => {
    config.headers['x-api-key'] = process.env.CENTRAL_BANK_API_KEY;
    config.headers['x-environment'] = process.env.X_ENVIRONMENT;
    return config;
});

// Reintentos ante 429 (rate limit del entorno de test). El mensaje del Banco
// Central sugiere esperar 15 minutos, pero eso es demasiado para bloquear un
// request HTTP: reintentamos un par de veces con una espera corta (respetando
// el header Retry-After si viene) para absorber picos breves de trafico de
// pruebas. Si sigue devolviendo 429 despues de eso, se deja pasar el error
// para que el controller lo muestre tal cual lo informa el Banco Central.
const MAX_REINTENTOS = 2;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

centralBank.interceptors.response.use(
    (respuesta) => respuesta,
    async (error) => {
        const config = error.config;
        const esRateLimit = error.response?.status === 429;

        if (!esRateLimit || !config) {
            return Promise.reject(error);
        }

        config._reintentos = (config._reintentos || 0) + 1;
        if (config._reintentos > MAX_REINTENTOS) {
            return Promise.reject(error);
        }

        const retryAfterSeg = Number(error.response.headers?.['retry-after']);
        const esperaMs = Number.isFinite(retryAfterSeg) && retryAfterSeg > 0
            ? Math.min(retryAfterSeg * 1000, 5000)
            : 800 * config._reintentos;

        await esperar(esperaMs);
        return centralBank(config);
    }
);

module.exports = centralBank;
