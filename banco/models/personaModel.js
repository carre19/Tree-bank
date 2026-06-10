const db = require('../config/db');

const Persona = {

  getAll: async () => {
    const { rows } = await db.query('SELECT * FROM personas ORDER BY id ASC');
    return rows;
  },

  getByCbu: async (cbu) => {
    const { rows } = await db.query(
      'SELECT * FROM cuentas_bancarias WHERE cbu = $1',
      [cbu]
    );
    return rows[0];
  },

  descontarSaldo: async (cbu, monto) => {
    await db.query(
      'UPDATE cuentas_bancarias SET saldo = saldo - $1 WHERE cbu = $2',
      [monto, cbu]
    );
  },

  acreditarSaldo: async (cbu, monto) => {
    await db.query(
      'UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE cbu = $2',
      [monto, cbu]
    );
  },

  transferirSaldo: async (origen, destino, monto) => {
    await db.query('UPDATE cuentas_bancarias SET saldo = saldo - $1 WHERE cbu = $2', [monto, origen]);
    await db.query('UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE cbu = $2', [monto, destino]);
  },

  registrarMovimiento: async (datos) => {
    const { id_cuenta, tipo_movimiento, monto, descripcion } = datos;
    await db.query(
      'INSERT INTO movimientos (id_cuenta, tipo_movimiento, monto, descripcion, fecha) VALUES ($1, $2, $3, $4, NOW())',
      [id_cuenta, tipo_movimiento, monto, descripcion]
    );
  },

  actualizarAlias: async (cbu, alias) => {
    await db.query(
      'UPDATE cuentas_bancarias SET alias = $1 WHERE cbu = $2',
      [alias, cbu]
    );
  },

  createConCuenta: async (datos) => {
    const { nombre, apellido, dni, cbu, alias } = datos;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const resPersona = await client.query(
        'INSERT INTO personas (nombre, apellido, dni) VALUES ($1, $2, $3) RETURNING id',
        [nombre, apellido, dni]
      );
      const id_persona = resPersona.rows[0].id;
      const resProducto = await client.query(
        'INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto) VALUES ($1, 1, 1) RETURNING id_producto',
        [id_persona]
      );
      const id_producto = resProducto.rows[0].id_producto;
      const resCuenta = await client.query(
        "INSERT INTO cuentas_bancarias (id_producto, cbu, alias, saldo, moneda) VALUES ($1, $2, $3, 0, 'ARS') RETURNING *",
        [id_producto, cbu, alias || null]
      );
      await client.query('COMMIT');
      return { id_persona, ...resCuenta.rows[0] };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  getRoles: async (id) => {
    const { rows } = await db.query(
      'SELECT r.nombre_rol FROM roles r JOIN roles_x_personas rp ON r.id_rol = rp.id_rol WHERE rp.id_persona = $1',
      [id]
    );
    return rows;
  },

  getProductos: async (id) => {
    const { rows } = await db.query(
      'SELECT p.id_producto, tp.nombre as tipo FROM productos p JOIN tipos_producto tp ON p.id_tipo_producto = tp.id_tipo_producto WHERE p.id_persona = $1',
      [id]
    );
    return rows;
  },

  getMovimientos: async (id_cuenta) => {
    const { rows } = await db.query(
      'SELECT * FROM movimientos WHERE id_cuenta = $1 ORDER BY fecha DESC',
      [id_cuenta]
    );
    return rows;
  }

};

module.exports = Persona;
