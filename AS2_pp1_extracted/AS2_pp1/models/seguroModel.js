// ============================================================
// models/seguroModel.js — CONSULTAS SQL DE POLIZAS DE SEGURO
// Es un producto interno del banco (no existe en la API del Banco Central del
// profe): igual que prestamos y tarjetas, una poliza es un Producto mas y
// reutiliza Estados_Producto (ACTIVO mientras se paga, CERRADO si se cancela
// o si se deja de pagar la prima).
// ============================================================

const db = require('../config/db');

// Cobertura y prima mensual fijas por tipo de seguro (no dependen de la
// Central de Deudores: a diferencia de un prestamo o una tarjeta, una poliza
// no es una linea de credito, asi que no hay riesgo crediticio que evaluar).
const TIPOS_SEGURO = {
    VIDA:                { cobertura: 5000000, prima_mensual: 2500 },
    HOGAR:               { cobertura: 3000000, prima_mensual: 1800 },
    PROTECCION_COMPRAS:  { cobertura: 500000,  prima_mensual: 900 },
};

const Seguro = {

    TIPOS_SEGURO,

    // Crea el producto + la poliza. Si se pasa un client externo (el caller ya
    // abrio su propia transaccion, para que el alta y el cobro de la primera
    // prima queden en un solo commit), lo usa tal cual sin manejar BEGIN/COMMIT
    // ni release — eso queda del lado del caller.
    contratarPoliza: async ({ id_persona, tipo_seguro }, clienteExterno = null) => {
        const { cobertura, prima_mensual } = TIPOS_SEGURO[tipo_seguro];
        const client = clienteExterno || await db.connect();
        const propiaTransaccion = !clienteExterno;
        try {
            if (propiaTransaccion) await client.query('BEGIN');

            const resProducto = await client.query(
                `INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto)
                 SELECT $1, id_tipo_producto, 1 FROM tipos_producto WHERE nombre = 'SEGURO'
                 RETURNING id_producto`,
                [id_persona]
            );
            const id_producto = resProducto.rows[0].id_producto;

            const resPoliza = await client.query(
                `INSERT INTO polizas (id_producto, tipo_seguro, cobertura, prima_mensual, fecha_proximo_pago)
                 VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '1 month') RETURNING *`,
                [id_producto, tipo_seguro, cobertura, prima_mensual]
            );

            if (propiaTransaccion) await client.query('COMMIT');
            return { id_producto, ...resPoliza.rows[0] };
        } catch (e) {
            if (propiaTransaccion) await client.query('ROLLBACK');
            throw e;
        } finally {
            if (propiaTransaccion) client.release();
        }
    },

    getPolizasByPersona: async (id_persona) => {
        const { rows } = await db.query(
            `SELECT pz.*, p.id_producto, ep.nombre AS estado
             FROM polizas pz
             JOIN productos p ON pz.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             WHERE p.id_persona = $1
             ORDER BY pz.fecha_alta DESC`,
            [id_persona]
        );
        return rows;
    },

    // Una poliza puntual con su dueno y estado (para validar ownership antes de operar)
    getPolizaDetalle: async (id_poliza) => {
        const { rows } = await db.query(
            `SELECT pz.*, p.id_producto, p.id_persona, ep.nombre AS estado
             FROM polizas pz
             JOIN productos p ON pz.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             WHERE pz.id_poliza = $1`,
            [id_poliza]
        );
        return rows[0];
    },

    pagarPrima: async (id_poliza, client = db) => {
        const { rows } = await client.query(
            `UPDATE polizas SET fecha_proximo_pago = fecha_proximo_pago + INTERVAL '1 month'
             WHERE id_poliza = $1 RETURNING *`,
            [id_poliza]
        );
        return rows[0];
    },

    // Polizas ACTIVAS cuya prima vencio hace mas de "diasGracia" dias: candidatas a
    // caducar automaticamente por falta de pago (no se informa a la Central de
    // Deudores: a diferencia de un prestamo, no dejar de pagar un seguro no es una deuda).
    getPolizasVencidas: async (diasGracia) => {
        const { rows } = await db.query(
            `SELECT pz.*, p.id_producto, p.id_persona
             FROM polizas pz
             JOIN productos p ON pz.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             WHERE ep.nombre = 'ACTIVO'
               AND pz.fecha_proximo_pago < CURRENT_DATE - ($1 || ' days')::interval`,
            [diasGracia]
        );
        return rows;
    },

    getAllPolizasAdmin: async () => {
        const { rows } = await db.query(
            `SELECT pz.*, p.id_producto, ep.nombre AS estado,
                    per.id AS id_persona, per.nombre, per.apellido, per.dni
             FROM polizas pz
             JOIN productos p ON pz.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             JOIN personas per ON p.id_persona = per.id
             ORDER BY pz.fecha_alta DESC`
        );
        return rows;
    },

};

module.exports = Seguro;
