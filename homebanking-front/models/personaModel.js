const path = require('path');
const db = require(path.join(__dirname, '../config/db.js'));
require('dotenv').config();

// IMPORTANTE: Necesitas esta línea para que Supabase funcione
const { createClient } = require('@supabase/supabase-js');

// Inicializamos el cliente de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const Persona = {
    // Obtener todas las personas con sus cuentas
    getAll: async () => {
        const query = `
            SELECT p.*, cb.id_cuenta, cb.cbu, cb.alias, cb.saldo, cb.moneda 
            FROM personas p
            LEFT JOIN productos pr ON p.id = pr.id_persona
            LEFT JOIN cuentas_bancarias cb ON pr.id_producto = cb.id_producto
            ORDER BY p.id DESC
        `;
        const res = await db.query(query);
        return res.rows;
    },

    // Verificar si un alias ya existe
    existeAlias: async (alias) => {
        const res = await db.query('SELECT 1 FROM cuentas_bancarias WHERE alias = $1', [alias]);
        return res.rows.length > 0;
    },

    // Crear persona y cuenta en transacción
    createConCuenta: async (datos) => {
        const { nombre, apellido, dni, cbu, alias, email, telefono, direccion, fecha_nac } = datos;
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            const resPersona = await client.query(
                `INSERT INTO personas (nombre, apellido, dni, email, telefono, direccion, fecha_nac) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [nombre, apellido, dni, email || null, telefono || null, direccion || null, fecha_nac || null]
            );
            const id_persona = resPersona.rows[0].id;

            const resProducto = await client.query(
                'INSERT INTO productos (id_persona, id_tipo_producto, id_estado_producto) VALUES ($1, 1, 1) RETURNING id_producto',
                [id_persona]
            );
            const id_producto = resProducto.rows[0].id_producto;

            const resCuenta = await client.query(
                `INSERT INTO cuentas_bancarias (id_producto, cbu, alias, saldo, moneda) 
                 VALUES ($1, $2, $3, 0, 'ARS') RETURNING *`,
                [id_producto, cbu, alias]
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

    buscarPorCbu: async (cbu) => {
        const query = `
            SELECT cb.*, p.id as id_persona, p.nombre, p.apellido 
            FROM cuentas_bancarias cb
            JOIN productos pr ON cb.id_producto = pr.id_producto
            JOIN personas p ON pr.id_persona = p.id
            WHERE cb.cbu = $1
        `;
        const res = await db.query(query, [cbu]);
        return res.rows[0];
    },

    actualizarSaldo: async (idCuenta, nuevoSaldo) => {
        await db.query('UPDATE cuentas_bancarias SET saldo = $1 WHERE id_cuenta = $2', [nuevoSaldo, idCuenta]);
    },

    getRoles: async (idPersona) => {
        const query = `
            SELECT r.* FROM roles r
            JOIN roles_x_personas rxp ON r.id = rxp.id_rol
            WHERE rxp.id_persona = $1
        `;
        const res = await db.query(query, [idPersona]);
        return res.rows;
    },

    getProductos: async (idPersona) => {
        const query = `
            SELECT pr.*, cb.id_cuenta, cb.cbu, cb.alias, cb.saldo, cb.moneda 
            FROM productos pr
            LEFT JOIN cuentas_bancarias cb ON pr.id_producto = cb.id_producto
            WHERE pr.id_persona = $1
        `;
        const res = await db.query(query, [idPersona]);
        return res.rows;
    },

    getMovimientos: async (idCuenta) => {
        try {
            const { data, error } = await supabase
                .from('movimientos')
                .select('*')
                .eq('id_cuenta', parseInt(idCuenta))
                .order('fecha', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error nativo de Supabase:", error.message);
            throw new Error("Error al leer la tabla movimientos");
        }
    }
};

module.exports = Persona;