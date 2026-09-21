// ============================================================
// models/recargaModel.js — CATÁLOGO DE RECARGAS DE CELULAR
// Igual que servicioModel.js: no hace falta una tabla propia, cada recarga
// es una operación puntual que solo deja registrado el movimiento en la
// cuenta. A diferencia de un servicio (monto variable, factura simulada),
// una recarga tiene denominaciones fijas, como en la realidad.
// ============================================================

const db = require('../config/db');

const OPERADORES = {
    MOVISTAR: { empresa: 'Movistar' },
    PERSONAL: { empresa: 'Personal' },
    CLARO:    { empresa: 'Claro' },
};

// Denominaciones fijas permitidas (en pesos)
const MONTOS_PERMITIDOS = [500, 1000, 1500, 2000, 3000, 5000];

// Guarda el detalle de la recarga (operador, número de celular) en su propia
// tabla, además del registro genérico que ya queda en Movimientos.
const registrarRecarga = async (datos, client = db) => {
    const { id_cuenta, id_movimiento, operador, numero_celular, monto, saldo_posterior } = datos;
    await client.query(
        `INSERT INTO recargas (id_cuenta, id_movimiento, operador, numero_celular, monto, saldo_posterior, fecha)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id_cuenta, id_movimiento, operador, numero_celular, monto, saldo_posterior]
    );
};

module.exports = { OPERADORES, MONTOS_PERMITIDOS, registrarRecarga };
