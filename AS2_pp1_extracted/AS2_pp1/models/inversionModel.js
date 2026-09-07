// ============================================================
// models/inversionModel.js — TENENCIAS DE ACCIONES (ARGENTINAS Y EXTRANJERAS)
// ============================================================

const db = require('../config/db');

const Inversion = {

    getTenencias: async (id_persona) => {
        const { rows } = await db.query(
            `SELECT * FROM tenencias WHERE id_persona = $1 AND cantidad > 0 ORDER BY mercado, simbolo`,
            [id_persona]
        );
        return rows;
    },

    getTenencia: async (id_persona, mercado, simbolo) => {
        const { rows } = await db.query(
            `SELECT * FROM tenencias WHERE id_persona = $1 AND mercado = $2 AND simbolo = $3`,
            [id_persona, mercado, simbolo]
        );
        return rows[0];
    },

    // Suma cantidad a la tenencia (o la crea) y recalcula el precio promedio
    // ponderado: promedio = (cantidad_vieja*pp_viejo + cantidad_nueva*precio) / cantidad_total
    comprar: async ({ id_persona, mercado, simbolo, cantidad, precio, moneda }) => {
        const existente = await Inversion.getTenencia(id_persona, mercado, simbolo);

        if (!existente) {
            const { rows } = await db.query(
                `INSERT INTO tenencias (id_persona, mercado, simbolo, cantidad, precio_promedio, moneda)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [id_persona, mercado, simbolo, cantidad, precio, moneda]
            );
            return rows[0];
        }

        const cantidadTotal = Number(existente.cantidad) + cantidad;
        const promedioNuevo = (Number(existente.cantidad) * Number(existente.precio_promedio) + cantidad * precio) / cantidadTotal;

        const { rows } = await db.query(
            `UPDATE tenencias SET cantidad = $1, precio_promedio = $2, fecha_actualizacion = NOW()
             WHERE id_tenencia = $3 RETURNING *`,
            [cantidadTotal, Number(promedioNuevo.toFixed(4)), existente.id_tenencia]
        );
        return rows[0];
    },

    // Resta cantidad de la tenencia (el precio promedio no cambia al vender,
    // solo al comprar mas)
    vender: async ({ id_persona, mercado, simbolo, cantidad }) => {
        const { rows } = await db.query(
            `UPDATE tenencias SET cantidad = cantidad - $1, fecha_actualizacion = NOW()
             WHERE id_persona = $2 AND mercado = $3 AND simbolo = $4 AND cantidad >= $1
             RETURNING *`,
            [cantidad, id_persona, mercado, simbolo]
        );
        return rows[0];
    },

};

module.exports = Inversion;
