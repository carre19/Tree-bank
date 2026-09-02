// ============================================================
// models/tarjetaModel.js — CONSULTAS SQL DE TARJETAS DE CREDITO
// Igual que un prestamo, una tarjeta es un Producto mas: reutiliza
// Estados_Producto (ACTIVO/BLOQUEADO/CERRADO) para su ciclo de vida.
// saldo_consumido es lo que se debe del resumen (limite_compra - saldo_consumido
// = disponible para seguir comprando).
// ============================================================

const crypto = require('crypto');
const db = require('../config/db');

const MARCAS_VALIDAS = ['VISA', 'MASTERCARD'];

// Limite de compra segun la situacion crediticia informada por la Central de
// Deudores al momento de emitir la tarjeta (mismo criterio que prestamos:
// situacion 4 o 5 ya se rechaza antes de llegar aca).
const LIMITE_POR_SITUACION = { 1: 300000, 2: 150000, 3: 50000 };
const DIA_CIERRE_FIJO = 10;

// Numero de tarjeta de prueba: BIN fijo (no corresponde a ninguna red real) +
// 12 digitos aleatorios, para que se pueda usar como si fuera una tarjeta real
// en el resto del sistema sin pisar numeros de otras tarjetas.
const generarNumeroTarjeta = () => {
    const BIN = '4556';
    const resto = Array.from({ length: 12 }, () => crypto.randomInt(0, 10)).join('');
    return BIN + resto;
};

// Codigo de seguridad (CVV) de 3 digitos
const generarCVV = () => String(crypto.randomInt(0, 1000)).padStart(3, '0');

const Tarjeta = {

    MARCAS_VALIDAS,
    LIMITE_POR_SITUACION,

    // Crea el producto + la tarjeta en una sola transaccion. Reintenta si el
    // numero de tarjeta generado ya existe (colision extremadamente rara).
    crearTarjeta: async ({ id_persona, marca, situacion_al_otorgar }) => {
        const limite_compra = LIMITE_POR_SITUACION[situacion_al_otorgar] || LIMITE_POR_SITUACION[1];

        for (let intento = 0; intento < 3; intento++) {
            const client = await db.connect();
            try {
                await client.query('BEGIN');

                const resProducto = await client.query(
                    `INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto)
                     SELECT $1, id_tipo_producto, 1 FROM tipos_producto WHERE nombre = 'TARJETA_CREDITO'
                     RETURNING id_producto`,
                    [id_persona]
                );
                const id_producto = resProducto.rows[0].id_producto;

                const resTarjeta = await client.query(
                    `INSERT INTO tarjetas_credito (id_producto, numero_tarjeta, marca, fecha_vencimiento, limite_compra, dia_cierre, codigo_seguridad)
                     VALUES ($1, $2, $3, CURRENT_DATE + INTERVAL '5 years', $4, $5, $6) RETURNING *`,
                    [id_producto, generarNumeroTarjeta(), marca, limite_compra, DIA_CIERRE_FIJO, generarCVV()]
                );

                await client.query('COMMIT');
                return { id_producto, ...resTarjeta.rows[0] };
            } catch (e) {
                await client.query('ROLLBACK');
                const esColisionNumero = e.code === '23505' && e.constraint === 'tarjetas_credito_numero_tarjeta_key';
                if (!esColisionNumero) throw e;
            } finally {
                client.release();
            }
        }
        throw new Error('No se pudo generar un numero de tarjeta unico, intenta de nuevo');
    },

    // Una persona no puede tener mas de una tarjeta ACTIVA de la misma marca
    // (si cerro la anterior, puede pedir una nueva de esa marca sin problema)
    tieneActivaDeMarca: async (id_persona, marca) => {
        const { rows } = await db.query(
            `SELECT 1 FROM tarjetas_credito t
             JOIN productos p ON t.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             WHERE p.id_persona = $1 AND t.marca = $2 AND ep.nombre = 'ACTIVO'
             LIMIT 1`,
            [id_persona, marca]
        );
        return rows.length > 0;
    },

    getTarjetasByPersona: async (id_persona) => {
        const { rows } = await db.query(
            `SELECT t.*, p.id_producto, ep.nombre AS estado
             FROM tarjetas_credito t
             JOIN productos p ON t.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             WHERE p.id_persona = $1
             ORDER BY p.fecha_alta DESC`,
            [id_persona]
        );
        return rows;
    },

    // Una tarjeta puntual con su dueno y estado (para validar ownership antes de operar)
    getTarjetaDetalle: async (id_tarjeta) => {
        const { rows } = await db.query(
            `SELECT t.*, p.id_producto, p.id_persona, ep.nombre AS estado,
                    per.dni, per.nombre AS nombre_persona, per.apellido AS apellido_persona
             FROM tarjetas_credito t
             JOIN productos p ON t.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             JOIN personas per ON p.id_persona = per.id
             WHERE t.id_tarjeta = $1`,
            [id_tarjeta]
        );
        return rows[0];
    },

    // Registra una compra si hay limite disponible; devuelve undefined si no alcanza
    // (evita una consulta previa + update separados, que podrian pisarse entre si)
    registrarConsumo: async (id_tarjeta, monto) => {
        const { rows } = await db.query(
            `UPDATE tarjetas_credito
             SET saldo_consumido = saldo_consumido + $2
             WHERE id_tarjeta = $1 AND saldo_consumido + $2 <= limite_compra
             RETURNING *`,
            [id_tarjeta, monto]
        );
        return rows[0];
    },

    registrarPagoResumen: async (id_tarjeta, monto) => {
        const { rows } = await db.query(
            `UPDATE tarjetas_credito
             SET saldo_consumido = GREATEST(saldo_consumido - $2, 0)
             WHERE id_tarjeta = $1
             RETURNING *`,
            [id_tarjeta, monto]
        );
        return rows[0];
    },

    // Movimiento de tarjeta: una compra no toca ninguna cuenta (id_cuenta null);
    // un pago de resumen sí, y se guarda en el mismo movimiento (id_cuenta + id_tarjeta)
    // para poder ver el pago tanto en el historial de la cuenta como en el de la tarjeta.
    registrarMovimiento: async ({ id_tarjeta, id_cuenta, tipo_movimiento, monto, descripcion }) => {
        await db.query(
            `INSERT INTO movimientos (id_cuenta, id_tarjeta, tipo_movimiento, monto, descripcion, fecha)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [id_cuenta || null, id_tarjeta, tipo_movimiento, monto, descripcion]
        );
    },

    getMovimientos: async (id_tarjeta) => {
        const { rows } = await db.query(
            'SELECT * FROM movimientos WHERE id_tarjeta = $1 ORDER BY fecha DESC',
            [id_tarjeta]
        );
        return rows;
    },

    cerrarTarjeta: async (id_producto) => {
        const { rows } = await db.query(
            `UPDATE productos SET id_estado_producto = (
                SELECT id_estado_producto FROM estados_producto WHERE nombre = 'CERRADO'
             ) WHERE id_producto = $1 RETURNING id_producto`,
            [id_producto]
        );
        return rows[0];
    },

    getAllTarjetasAdmin: async () => {
        const { rows } = await db.query(
            `SELECT t.*, p.id_producto, ep.nombre AS estado,
                    per.id AS id_persona, per.nombre, per.apellido, per.dni
             FROM tarjetas_credito t
             JOIN productos p ON t.id_producto = p.id_producto
             JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
             JOIN personas per ON p.id_persona = per.id
             ORDER BY p.fecha_alta DESC`
        );
        return rows;
    },

};

module.exports = Tarjeta;
