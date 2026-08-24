// ============================================================
// models/prestamoModel.js — CONSULTAS SQL DE PRESTAMOS
// Un prestamo es un Producto mas (como una cuenta o una tarjeta), asi que
// reutiliza Estados_Producto para su ciclo de vida: ACTIVO (pagando),
// CERRADO (pagado en su totalidad) o BLOQUEADO (en mora, reportado a la
// Central de Deudores).
// ============================================================

const db = require('../config/db');

// Interes total (%) segun el plazo elegido. Simple: a mas cuotas, mas tasa.
const TASAS_POR_CUOTAS = { 3: 8, 6: 15, 12: 28, 24: 45 };

const Prestamo = {

  TASAS_POR_CUOTAS,

  // Calcula tasa, cuota mensual y saldo total a devolver para un monto/plazo
  simular: (monto, cuotas) => {
    const tasa = TASAS_POR_CUOTAS[cuotas];
    const saldo_pendiente = Number((monto * (1 + tasa / 100)).toFixed(2));
    const monto_cuota = Number((saldo_pendiente / cuotas).toFixed(2));
    return { tasa, monto_cuota, saldo_pendiente };
  },

  // Crea el producto + el prestamo en una sola transaccion
  crearPrestamo: async ({ id_persona, monto, tasa_interes, cuotas_totales, monto_cuota, saldo_pendiente, situacion_al_otorgar }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const resProducto = await client.query(
        `INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto)
         SELECT $1, id_tipo_producto, 1 FROM tipos_producto WHERE nombre = 'PRESTAMO'
         RETURNING id_producto`,
        [id_persona]
      );
      const id_producto = resProducto.rows[0].id_producto;

      const resPrestamo = await client.query(
        `INSERT INTO prestamos (id_producto, monto, tasa_interes, cuotas_totales, monto_cuota, saldo_pendiente, situacion_al_otorgar, fecha_proximo_vencimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE + INTERVAL '1 month') RETURNING *`,
        [id_producto, monto, tasa_interes, cuotas_totales, monto_cuota, saldo_pendiente, situacion_al_otorgar]
      );

      await client.query('COMMIT');
      return { id_producto, ...resPrestamo.rows[0] };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  // Todos los prestamos de una persona (para "Mis prestamos")
  getPrestamosByPersona: async (id_persona) => {
    const { rows } = await db.query(
      `SELECT pr.*, p.id_producto, ep.nombre AS estado
       FROM prestamos pr
       JOIN productos p ON pr.id_producto = p.id_producto
       JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
       WHERE p.id_persona = $1
       ORDER BY pr.fecha_alta DESC`,
      [id_persona]
    );
    return rows;
  },

  // Un prestamo puntual, con el dueno y su estado (para validar ownership antes de pagar/bloquear)
  getPrestamoDetalle: async (id_prestamo) => {
    const { rows } = await db.query(
      `SELECT pr.*, p.id_producto, p.id_persona, ep.nombre AS estado,
              per.dni, per.nombre AS nombre_persona, per.apellido AS apellido_persona
       FROM prestamos pr
       JOIN productos p ON pr.id_producto = p.id_producto
       JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
       JOIN personas per ON p.id_persona = per.id
       WHERE pr.id_prestamo = $1`,
      [id_prestamo]
    );
    return rows[0];
  },

  // Registra el pago de una cuota (resta del saldo pendiente, suma una cuota pagada,
  // y empuja el proximo vencimiento un mes para adelante)
  registrarPagoCuota: async (id_prestamo, monto_cuota) => {
    const { rows } = await db.query(
      `UPDATE prestamos
       SET cuotas_pagadas = cuotas_pagadas + 1,
           saldo_pendiente = GREATEST(saldo_pendiente - $2, 0),
           fecha_proximo_vencimiento = fecha_proximo_vencimiento + INTERVAL '1 month'
       WHERE id_prestamo = $1
       RETURNING *`,
      [id_prestamo, monto_cuota]
    );
    return rows[0];
  },

  // Prestamos ACTIVOS cuya cuota vencio hace mas de "diasGracia" dias y todavia
  // no se termino de pagar: candidatos a mora automatica.
  getPrestamosVencidos: async (diasGracia) => {
    const { rows } = await db.query(
      `SELECT pr.*, p.id_producto, per.dni, per.nombre, per.apellido
       FROM prestamos pr
       JOIN productos p ON pr.id_producto = p.id_producto
       JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
       JOIN personas per ON p.id_persona = per.id
       WHERE ep.nombre = 'ACTIVO'
         AND pr.cuotas_pagadas < pr.cuotas_totales
         AND pr.fecha_proximo_vencimiento < CURRENT_DATE - ($1 || ' days')::interval`,
      [diasGracia]
    );
    return rows;
  },

  // Todos los prestamos del banco, para el panel de administrador
  getAllPrestamosAdmin: async () => {
    const { rows } = await db.query(
      `SELECT pr.*, p.id_producto, ep.nombre AS estado,
              per.id AS id_persona, per.nombre, per.apellido, per.dni
       FROM prestamos pr
       JOIN productos p ON pr.id_producto = p.id_producto
       JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
       JOIN personas per ON p.id_persona = per.id
       ORDER BY pr.fecha_alta DESC`
    );
    return rows;
  },

};

module.exports = Prestamo;
