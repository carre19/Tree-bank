// ============================================================
// models/caucionModel.js — CAUCIONES COLOCADAS
// Una caucion bursatil real tiene una tasa que fluctua minuto a minuto en
// el mercado (BYMA la calcula en tiempo real via su indice de tasa de
// caucion), pero esa tasa NO tiene una API publica y gratuita como si la
// tienen las acciones: BYMA la vende como dato de mercado a las casas de
// bolsa. Por eso, igual que ya se hace con la tasa de los prestamos
// (TASAS_POR_CUOTAS en prestamoModel.js), se simula una tasa de referencia
// fija por plazo, del orden de las tasas reales de caucion en pesos.
// ============================================================

const db = require('../config/db');

// Tasa nominal anual (%) segun el plazo en dias. A mas plazo, mas tasa.
const TASAS_POR_PLAZO = { 1: 32, 7: 33, 15: 34, 30: 35 };

const Caucion = {

    TASAS_POR_PLAZO,

    // Interes simple: monto * tasa_anual/100 * plazo_dias/365
    simular: (monto, plazo_dias) => {
        const tasa_anual = TASAS_POR_PLAZO[plazo_dias];
        const interes = Number((monto * (tasa_anual / 100) * (plazo_dias / 365)).toFixed(2));
        const monto_a_cobrar = Number((monto + interes).toFixed(2));
        return { tasa_anual, interes, monto_a_cobrar };
    },

    crear: async ({ id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar }) => {
        const { rows } = await db.query(
            `INSERT INTO cauciones (id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar, fecha_vencimiento)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + make_interval(days => $4))
             RETURNING *`,
            [id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar]
        );
        return rows[0];
    },

    getMisCauciones: async (id_persona) => {
        const { rows } = await db.query(
            `SELECT * FROM cauciones WHERE id_persona = $1 ORDER BY fecha_alta DESC`,
            [id_persona]
        );
        return rows;
    },

    // Cauciones ACTIVAS cuyo plazo ya se cumplio: candidatas a liquidar
    // (acreditar capital + interes y cerrar)
    getVencidas: async () => {
        const { rows } = await db.query(
            `SELECT * FROM cauciones WHERE estado = 'ACTIVA' AND fecha_vencimiento <= CURRENT_DATE`
        );
        return rows;
    },

    liquidar: async (id_caucion) => {
        const { rows } = await db.query(
            `UPDATE cauciones SET estado = 'LIQUIDADA' WHERE id_caucion = $1 AND estado = 'ACTIVA' RETURNING *`,
            [id_caucion]
        );
        return rows[0];
    },

};

module.exports = Caucion;
