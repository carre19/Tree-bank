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

  // Indica si ya existe una persona con ese DNI (se usa antes de abrir una
  // cuenta nueva: una persona no puede tener dos cuentas en Tree Bank)
  existePorDni: async (dni) => {
    const { rows } = await db.query('SELECT 1 FROM personas WHERE dni = $1', [dni]);
    return rows.length > 0;
  },

  // Busca una cuenta bancaria por su CBU
  // Devuelve la cuenta completa (id_cuenta, saldo, alias, etc.) junto con el dueno
  // (id_persona) y el estado del producto (ACTIVO/BLOQUEADO/CERRADO), o undefined si no existe
  // reservado = plata "apartada" en Reservas para esta cuenta (ver models/personaModel.js
  // funciones de reservas mas abajo). disponible = saldo - reservado: es lo que de verdad
  // se puede transferir, pagar o gastar sin tocar lo que el usuario aparto a proposito.
  getByCbu: async (cbu) => {
    const { rows } = await db.query(
      `SELECT cb.*, ep.nombre AS estado, p.id_persona,
              COALESCE((SELECT SUM(r.monto) FROM reservas r WHERE r.id_cuenta = cb.id_cuenta), 0) AS reservado
       FROM cuentas_bancarias cb
       JOIN productos p ON cb.id_producto = p.id_producto
       JOIN estados_producto ep ON p.id_estado_producto = ep.id_estado_producto
       WHERE cb.cbu = $1`,
      [cbu]
    );
    return rows[0]; // rows[0] = primer resultado, o undefined si no hay ninguno
  },

  // Busca la cuenta en ARS de una persona a partir de su id (no de su CBU).
  // Se usa para acreditar/descontar prestamos: sabemos QUIEN pidio el prestamo (por el token JWT)
  // pero necesitamos SU cuenta para mover la plata.
  getCuentaArsPorPersona: async (id_persona) => {
    const { rows } = await db.query(
      `SELECT cb.*, per.dni, per.nombre, per.apellido,
              COALESCE((SELECT SUM(r.monto) FROM reservas r WHERE r.id_cuenta = cb.id_cuenta), 0) AS reservado
       FROM cuentas_bancarias cb
       JOIN productos p ON cb.id_producto = p.id_producto
       JOIN personas per ON p.id_persona = per.id
       WHERE per.id = $1 AND cb.moneda = 'ARS'
       LIMIT 1`,
      [id_persona]
    );
    return rows[0];
  },

  // Busca una persona local por DNI (usado para sincronizar altas de cuentas en moneda extranjera)
  getPersonaByDni: async (dni) => {
    const { rows } = await db.query('SELECT id FROM personas WHERE dni = $1', [dni]);
    return rows[0];
  },

  // Busca la cuenta bancaria local de una persona en una moneda especifica (ARS, USD, etc.)
  getCuentaPorPersonaYMoneda: async (id_persona, moneda) => {
    const { rows } = await db.query(
      `SELECT cb.*,
              COALESCE((SELECT SUM(r.monto) FROM reservas r WHERE r.id_cuenta = cb.id_cuenta), 0) AS reservado
       FROM cuentas_bancarias cb
       JOIN productos p ON cb.id_producto = p.id_producto
       WHERE p.id_persona = $1 AND cb.moneda = $2`,
      [id_persona, moneda]
    );
    return rows[0];
  },

  // Crea un producto + cuenta bancaria nuevos para una persona ya existente, en la moneda indicada.
  // Se usa para abrir cajas en monedas distintas de ARS: la caja en ARS ya se crea junto con la
  // persona (ver createConCuenta), asi que esta cuenta es siempre una adicional sobre la misma persona.
  crearCuentaEnMoneda: async ({ id_persona, moneda, cbu, alias }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Nuevo producto tipo CAJA_AHORRO (id 1) y estado ACTIVO (id 1), igual que createConCuenta
      const resProducto = await client.query(
        'INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto) VALUES ($1, 1, 1) RETURNING id_producto',
        [id_persona]
      );
      const id_producto = resProducto.rows[0].id_producto;

      const resCuenta = await client.query(
        'INSERT INTO cuentas_bancarias (id_producto, cbu, alias, saldo, moneda) VALUES ($1, $2, $3, 0, $4) RETURNING *',
        [id_producto, cbu, alias || null, moneda]
      );

      await client.query('COMMIT');
      return resCuenta.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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
  // cbu_contraparte/nombre_contraparte son opcionales: identifican a quien envio o recibio
  // la plata del otro lado de una transferencia, y son la base de la lista de "Contactos"
  // (a proposito NO se llenan en depositos: no tienen contraparte real).
  registrarMovimiento: async (datos) => {
    const { id_cuenta, tipo_movimiento, monto, descripcion, cbu_contraparte, nombre_contraparte } = datos;
    await db.query(
      `INSERT INTO movimientos (id_cuenta, tipo_movimiento, monto, descripcion, cbu_contraparte, nombre_contraparte, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id_cuenta, tipo_movimiento, monto, descripcion, cbu_contraparte || null, nombre_contraparte || null]
      // NOW() = fecha y hora actual del servidor
    );
  },

  // Devuelve los contactos de una persona: el CBU y nombre de cada contraparte con la que
  // ya hizo una transferencia (enviada o recibida), sin duplicados y del mas reciente al mas viejo.
  // Reemplaza el listado anterior que mostraba a TODOS los clientes del banco.
  getContactos: async (id_persona) => {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (m.cbu_contraparte)
              m.cbu_contraparte AS cbu, m.nombre_contraparte AS nombre, m.fecha
       FROM movimientos m
       JOIN cuentas_bancarias cb ON m.id_cuenta = cb.id_cuenta
       JOIN productos p ON cb.id_producto = p.id_producto
       WHERE p.id_persona = $1
         AND m.tipo_movimiento IN ('TRANSFERENCIA_EGRESO', 'TRANSFERENCIA_INGRESO')
         AND m.cbu_contraparte IS NOT NULL
       ORDER BY m.cbu_contraparte, m.fecha DESC`,
      [id_persona]
    );
    // DISTINCT ON obliga a ordenar primero por cbu_contraparte; reordenamos aca
    // por fecha para que el contacto mas reciente aparezca primero.
    return rows.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  // Actualiza el alias de una cuenta bancaria en Supabase
  actualizarAlias: async (cbu, alias) => {
    await db.query(
      'UPDATE cuentas_bancarias SET alias = $1 WHERE cbu = $2',
      [alias, cbu]
    );
  },

  // ---- Reservas: plata apartada dentro de una cuenta, sin moverla del saldo real ----

  getReservasPorCuenta: async (id_cuenta) => {
    const { rows } = await db.query(
      'SELECT * FROM reservas WHERE id_cuenta = $1 ORDER BY fecha_creacion DESC',
      [id_cuenta]
    );
    return rows;
  },

  // Trae una reserva puntual junto con el dueno de la cuenta (para validar ownership)
  getReservaDetalle: async (id_reserva) => {
    const { rows } = await db.query(
      `SELECT r.*, cb.cbu, cb.saldo, p.id_persona
       FROM reservas r
       JOIN cuentas_bancarias cb ON r.id_cuenta = cb.id_cuenta
       JOIN productos p ON cb.id_producto = p.id_producto
       WHERE r.id_reserva = $1`,
      [id_reserva]
    );
    return rows[0];
  },

  crearReserva: async ({ id_cuenta, nombre, monto }) => {
    const { rows } = await db.query(
      'INSERT INTO reservas (id_cuenta, nombre, monto) VALUES ($1, $2, $3) RETURNING *',
      [id_cuenta, nombre, monto]
    );
    return rows[0];
  },

  // Suma (delta positivo) o resta (delta negativo) plata de una reserva existente.
  // La condicion monto + delta >= 0 en el WHERE evita liberar mas de lo que tiene
  // sin necesidad de una lectura previa por separado.
  modificarMontoReserva: async (id_reserva, delta) => {
    const { rows } = await db.query(
      `UPDATE reservas SET monto = monto + $2
       WHERE id_reserva = $1 AND monto + $2 >= 0
       RETURNING *`,
      [id_reserva, delta]
    );
    return rows[0];
  },

  eliminarReserva: async (id_reserva) => {
    await db.query('DELETE FROM reservas WHERE id_reserva = $1', [id_reserva]);
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

      // 4. Asignar el rol CLIENTE por defecto (lo crea si todavia no existe en la tabla Roles)
      await client.query(
        `INSERT INTO roles (nombre_rol, descripcion)
         SELECT 'CLIENTE', 'Cliente del banco: opera su propia cuenta'
         WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nombre_rol = 'CLIENTE')`
      );
      const resRolCliente = await client.query(
        "SELECT id_rol FROM roles WHERE nombre_rol = 'CLIENTE'"
      );
      await client.query(
        'INSERT INTO roles_x_personas (id_persona, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id_persona, resRolCliente.rows[0].id_rol]
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
  },

  // Devuelve todas las cuentas bancarias del banco con los datos del dueno
  // Se usa en el panel de administrador para listar y gestionar cuentas
  getAllCuentasAdmin: async () => {
    const { rows } = await db.query(
      `SELECT cb.id_cuenta, cb.cbu, cb.alias, cb.saldo, cb.moneda,
              pr.id_producto, tp.nombre AS tipo,
              ep.nombre AS estado, ep.id_estado_producto,
              per.id AS id_persona, per.nombre, per.apellido, per.dni
       FROM cuentas_bancarias cb
       JOIN productos pr ON cb.id_producto = pr.id_producto
       JOIN tipos_producto tp ON pr.id_tipo_producto = tp.id_tipo_producto
       JOIN estados_producto ep ON pr.id_estado_producto = ep.id_estado_producto
       JOIN personas per ON pr.id_persona = per.id
       ORDER BY per.apellido, per.nombre`
    );
    return rows;
  },

  // Cambia el estado de un producto (cuenta): ACTIVO, BLOQUEADO o CERRADO
  // Usado por el administrador para bloquear/reactivar/cerrar una cuenta
  cambiarEstadoCuenta: async (id_producto, nombreEstado) => {
    const { rows } = await db.query(
      `UPDATE productos SET id_estado_producto = (
         SELECT id_estado_producto FROM estados_producto WHERE nombre = $1
       ) WHERE id_producto = $2 RETURNING id_producto`,
      [nombreEstado, id_producto]
    );
    return rows[0];
  },

  // Trae los datos necesarios para decidir si una cuenta se puede eliminar para siempre:
  // el saldo actual y si el dueno tiene alguna tarjeta de credito activa (prestamo pendiente)
  getCuentaParaCierre: async (id_producto) => {
    const { rows } = await db.query(
      `SELECT cb.id_cuenta, pr.id_producto, pr.id_persona, cb.saldo,
              EXISTS (
                SELECT 1 FROM productos pr2
                JOIN tipos_producto tp2 ON pr2.id_tipo_producto = tp2.id_tipo_producto
                JOIN estados_producto ep2 ON pr2.id_estado_producto = ep2.id_estado_producto
                WHERE pr2.id_persona = pr.id_persona
                  AND tp2.nombre = 'TARJETA_CREDITO'
                  AND ep2.nombre <> 'CERRADO'
              ) AS tiene_prestamo_pendiente
       FROM productos pr
       JOIN cuentas_bancarias cb ON cb.id_producto = pr.id_producto
       WHERE pr.id_producto = $1`,
      [id_producto]
    );
    return rows[0];
  },

  // Elimina para siempre una cuenta: sus movimientos, la cuenta bancaria y el producto.
  // La persona sigue existiendo (puede tener otros productos o abrir otra cuenta despues)
  eliminarCuentaDefinitivo: async (id_producto) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const cuentaRes = await client.query(
        'SELECT id_cuenta FROM cuentas_bancarias WHERE id_producto = $1',
        [id_producto]
      );
      if (cuentaRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      const id_cuenta = cuentaRes.rows[0].id_cuenta;

      await client.query('DELETE FROM movimientos WHERE id_cuenta = $1', [id_cuenta]);
      await client.query('DELETE FROM cuentas_bancarias WHERE id_cuenta = $1', [id_cuenta]);
      await client.query('DELETE FROM productos WHERE id_producto = $1', [id_producto]);

      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

};

module.exports = Persona;
