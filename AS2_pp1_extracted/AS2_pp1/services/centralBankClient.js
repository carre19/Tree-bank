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

module.exports = centralBank;
