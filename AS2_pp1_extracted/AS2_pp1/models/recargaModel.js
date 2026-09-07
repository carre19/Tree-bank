// ============================================================
// models/recargaModel.js — CATÁLOGO DE RECARGAS DE CELULAR
// Igual que servicioModel.js: no hace falta una tabla propia, cada recarga
// es una operación puntual que solo deja registrado el movimiento en la
// cuenta. A diferencia de un servicio (monto variable, factura simulada),
// una recarga tiene denominaciones fijas, como en la realidad.
// ============================================================

const OPERADORES = {
    MOVISTAR: { empresa: 'Movistar' },
    PERSONAL: { empresa: 'Personal' },
    CLARO:    { empresa: 'Claro' },
};

// Denominaciones fijas permitidas (en pesos)
const MONTOS_PERMITIDOS = [500, 1000, 1500, 2000, 3000, 5000];

module.exports = { OPERADORES, MONTOS_PERMITIDOS };
