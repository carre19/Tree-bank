// ============================================================
// models/personaModel.js — CONSULTAS SQL DE PERSONAS Y CUENTAS
// El model es la capa que habla directamente con la base de datos.
// Solo contiene consultas SQL, sin lógica de negocio.
// Los controllers llaman a estas funciones para leer/escribir datos.
// ============================================================

// Importamos la conexión a Supabase
const db = require('../config/db');

// Exportamos un objeto con todas las funciones de base de datos
const Persona = {

  // Devuelve todas las personas de la tabla (usada por el panel admin)
  getAll: async () => {
    const { rows } = await db.query('SELECT * FROM personas ORDER BY id ASC');
    return rows;
  },

  // Busca una cuenta bancaria por su CBU
  // Devuelve la cuenta completa (id_cuenta, saldo, alias, etc.) o undefined si no existe
  getByCbu: async (cbu) => {
    const { rows } = await db.query(
      'SELECT * FROM cuentas_bancarias WHERE cbu = $1',
      [cbu]
    );
    return rows[0]; // rows[0] = primer resultado, o undefined si no hay ninguno
  },

  // Resta monto del saldo de una cuenta (se usa al hacer una transferencia que sale)
  descontarSaldo: async (cbu, monto) => {
    await db.query(
      'UPDATE cuentas_bancarias SET saldo = saldo - $1 WHERE cbu = $2',
      [monto, cbu]
    );
  },

  // Suma monto al saldo de una cuenta (se usa al recibir transferencia o depósito)
  acreditarSaldo: async (cbu, monto) => {
    await db.query(
      'UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE cbu = $2',
      [monto, cbu]
    );
  },

  // Hace descontar y acreditar en una sola función (transferencia interna entre dos cuentas del mismo banco)
  transferirSaldo: async (origen, destino, monto) => {
    await db.query('UPDATE cuentas_bancarias SET saldo = saldo - $1 WHERE cbu = $2', [monto, origen]);
    await db.query('UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE cbu = $2', [monto, destino]);
  },

  // Guarda un movimiento en la tabla movimientos (historial de transacciones)
  // tipos posibles: TRANSFERENCIA_INGRESO, TRANSFERENCIA_EGRESO, DEPOSITO, TRANSFERENCIA_RECHAZADA
  registrarMovimiento: async (datos) => {
    const { id_cuenta, tipo_movimiento, monto, descripcion } = datos;
    await db.query(
      'INSERT INTO movimientos (id_cuenta, tipo_movimiento, monto, descripcion, fecha) VALUES ($1, $2, $3, $4, NOW())',
      [id_cuenta, tipo_movimiento, monto, descripcion]
      // NOW() = fecha y hora actual del servidor
    );
  },

  // Actualiza el alias de una cuenta bancaria en Supabase
  actualizarAlias: async (cbu, alias) => {
    await db.query(
      'UPDATE cuentas_bancarias SET alias = $1 WHERE cbu = $2',
      [alias, cbu]
    );
  },

  // Crea una persona nueva con su producto y su cuenta bancaria en un solo paso
  // Usa una TRANSACCIÓN SQL: si cualquier INSERT falla, se revierten TODOS (para no dejar datos a medias)
  createConCuenta: async (datos) => {
    const { nombre, apellido, dni, cbu, alias } = datos;

    // client es una conexión individual (necesaria para transacciones)
    const client = await db.connect();
    try {
      await client.query('BEGIN'); // Inicio de la transacción

      // 1. Insertar en tabla personas
      const resPersona = await client.query(
        'INSERT INTO personas (nombre, apellido, dni) VALUES ($1, $2, $3) RETURNING id',
        [nombre, apellido, dni]
      );
      const id_persona = resPersona.rows[0].id;

      // 2. Insertar en tabla productos (tipo 1 = cuenta bancaria, estado 1 = activo)
      const resProducto = await client.query(
        'INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto) VALUES ($1, 1, 1) RETURNING id_producto',
        [id_persona]
      );
      const id_producto = resProducto.rows[0].id_producto;

      // 3. Insertar en tabla cuentas_bancarias con saldo 0 en ARS
      const resCuenta = await client.query(
        "INSERT INTO cuentas_bancarias (id_producto, cbu, alias, saldo, moneda) VALUES ($1, $2, $3, 0, 'ARS') RETURNING *",
        [id_producto, cbu, alias || null]
      );

      await client.query('COMMIT'); // Si todo salió bien → confirmar los cambios
      return { id_persona, ...resCuenta.rows[0] };

    } catch (e) {
      await client.query('ROLLBACK'); // Si algo falló → deshacer todo
      throw e;
    } finally {
      client.release(); // Devolver la conexión al pool
    }
  },

  // Devuelve los roles de una persona (ej: ADMIN, CLIENTE)
  getRoles: async (id) => {
    const { rows } = await db.query(
      'SELECT r.nombre_rol FROM roles r JOIN roles_x_personas rp ON r.id_rol = rp.id_rol WHERE rp.id_persona = $1',
      [id]
      // JOIN une la tabla roles con roles_x_personas para obtener el nombre del rol
    );
    return rows;
  },

  // Devuelve los productos (cuentas) de una persona
  getProductos: async (id) => {
    const { rows } = await db.query(
      'SELECT p.id_producto, tp.nombre as tipo FROM productos p JOIN tipos_producto tp ON p.id_tipo_producto = tp.id_tipo_producto WHERE p.id_persona = $1',
      [id]
    );
    return rows;
  },

  // Devuelve el historial de movimientos de una cuenta, del más reciente al más antiguo
  getMovimientos: async (id_cuenta) => {
    const { rows } = await db.query(
      'SELECT * FROM movimientos WHERE id_cuenta = $1 ORDER BY fecha DESC',
      [id_cuenta]
    );
    return rows;
  }

};

module.exports = Persona;
