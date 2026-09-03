#!/usr/bin/env node
// ============================================================
// scripts/admin.js — GESTION DE ADMINISTRADORES
// Herramienta de linea de comandos para el back-office del banco.
// El rol ADMIN no se puede asignar desde la API (a proposito: si existiera
// un endpoint para darse ADMIN a uno mismo, seria el agujero mas grande
// del sistema). Se hace desde aca, con acceso al servidor.
//
// Uso:
//   node scripts/admin.js listar
//   node scripts/admin.js promover <dni>
//   node scripts/admin.js quitar   <dni>
//   node scripts/admin.js password <dni> <password-nueva>
//   node scripts/admin.js limpiar-passwords
// ============================================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

const salir = async (codigo = 0) => { await db.end(); process.exit(codigo); };

const error = async (msg) => {
    console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
    await salir(1);
};

const ok = (msg) => console.log(`\x1b[32m✔ ${msg}\x1b[0m`);

// Busca a la persona por DNI
const buscarPersona = async (dni) => {
    const { rows } = await db.query(
        'SELECT id, nombre, apellido, dni, password_hash FROM personas WHERE dni = $1',
        [String(dni).trim()]
    );
    return rows[0];
};

// Devuelve el id del rol ADMIN, creandolo si todavia no existe
const idRolAdmin = async () => {
    const existente = await db.query("SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'");
    if (existente.rows.length > 0) return existente.rows[0].id_rol;

    const creado = await db.query(
        `INSERT INTO roles (nombre_rol, descripcion)
         VALUES ('ADMIN', 'Administrador del sistema: gestiona las cuentas de todos los clientes')
         RETURNING id_rol`
    );
    ok('Rol ADMIN creado (no existia en la base)');
    return creado.rows[0].id_rol;
};

// ---- Comandos ----

const listar = async () => {
    const { rows } = await db.query(
        `SELECT p.id, p.nombre, p.apellido, p.dni,
                (p.password_hash IS NOT NULL) AS tiene_password
         FROM personas p
         JOIN roles_x_personas rp ON rp.id_persona = p.id
         JOIN roles r ON r.id_rol = rp.id_rol
         WHERE r.nombre_rol = 'ADMIN'
         ORDER BY p.id`
    );
    if (rows.length === 0) {
        console.log('No hay ningun ADMIN cargado. Crealo con:  node scripts/admin.js promover <dni>');
    } else {
        console.log(`Administradores (${rows.length}):`);
        console.table(rows);
    }
};

const promover = async (dni) => {
    if (!dni) return error('Falta el DNI.  Uso: node scripts/admin.js promover <dni>');
    const persona = await buscarPersona(dni);
    if (!persona) return error(`No existe ninguna persona con DNI ${dni}`);

    const idRol = await idRolAdmin();
    await db.query(
        `INSERT INTO roles_x_personas (id_persona, id_rol) VALUES ($1, $2)
         ON CONFLICT (id_persona, id_rol) DO NOTHING`,
        [persona.id, idRol]
    );

    ok(`${persona.nombre} ${persona.apellido} (DNI ${persona.dni}) ahora es ADMIN`);
    if (!persona.password_hash) {
        console.log('\x1b[33m⚠ Esa persona todavia no tiene contrasena. Asignale una con:\x1b[0m');
        console.log(`   node scripts/admin.js password ${persona.dni} <password-nueva>`);
    } else {
        console.log('Ya tiene contrasena: puede entrar por /login y va a caer directo en /admin.');
    }
};

const quitar = async (dni) => {
    if (!dni) return error('Falta el DNI.  Uso: node scripts/admin.js quitar <dni>');
    const persona = await buscarPersona(dni);
    if (!persona) return error(`No existe ninguna persona con DNI ${dni}`);

    // No dejar el banco sin ningun administrador
    const { rows } = await db.query(
        `SELECT COUNT(*)::int AS total FROM roles_x_personas rp
         JOIN roles r ON r.id_rol = rp.id_rol WHERE r.nombre_rol = 'ADMIN'`
    );
    if (rows[0].total <= 1) {
        return error('Es el unico ADMIN que queda. Promove a otro antes de quitarle el rol a este.');
    }

    const res = await db.query(
        `DELETE FROM roles_x_personas WHERE id_persona = $1
         AND id_rol = (SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN')`,
        [persona.id]
    );
    if (res.rowCount === 0) return error(`${persona.nombre} ${persona.apellido} no era ADMIN`);
    ok(`Rol ADMIN quitado a ${persona.nombre} ${persona.apellido} (DNI ${persona.dni})`);
};

const password = async (dni, nueva) => {
    if (!dni || !nueva) return error('Uso: node scripts/admin.js password <dni> <password-nueva>');
    if (nueva.length < 8) return error('La contrasena debe tener al menos 8 caracteres');

    const persona = await buscarPersona(dni);
    if (!persona) return error(`No existe ninguna persona con DNI ${dni}`);

    const hash = await bcrypt.hash(nueva, 10);
    await db.query('UPDATE personas SET password_hash = $1 WHERE id = $2', [hash, persona.id]);
    ok(`Contrasena actualizada para ${persona.nombre} ${persona.apellido} (DNI ${persona.dni})`);
};

// Borra credenciales guardadas en texto plano (no son hashes de bcrypt).
// Esas cuentas no podian loguear igual, porque bcrypt.compare falla contra
// un valor que no es un hash: lo unico que hacian era exponer la password.
const limpiarPasswords = async () => {
    const { rows } = await db.query(
        `SELECT id, nombre, apellido, dni FROM personas
         WHERE password_hash IS NOT NULL AND password_hash NOT LIKE '$2%'`
    );
    if (rows.length === 0) {
        ok('No hay contrasenas en texto plano. Todo guardado con bcrypt.');
        return;
    }
    console.log(`Se encontraron ${rows.length} contrasena(s) en texto plano:`);
    console.table(rows);
    await db.query(
        `UPDATE personas SET password_hash = NULL
         WHERE password_hash IS NOT NULL AND password_hash NOT LIKE '$2%'`
    );
    ok('Limpiadas. Esas personas quedan sin contrasena y deben usar "Olvide mi contrasena".');
};

// ---- Dispatcher ----
(async () => {
    const [comando, ...args] = process.argv.slice(2);
    try {
        switch (comando) {
            case 'listar':             await listar(); break;
            case 'promover':           await promover(args[0]); break;
            case 'quitar':             await quitar(args[0]); break;
            case 'password':           await password(args[0], args[1]); break;
            case 'limpiar-passwords':  await limpiarPasswords(); break;
            default:
                console.log(`Gestion de administradores de Tree Bank

  node scripts/admin.js listar                        Lista los ADMIN actuales
  node scripts/admin.js promover <dni>                Le da el rol ADMIN a una persona
  node scripts/admin.js quitar <dni>                  Le quita el rol ADMIN
  node scripts/admin.js password <dni> <nueva>        Define/resetea una contrasena
  node scripts/admin.js limpiar-passwords             Borra credenciales en texto plano
`);
        }
        await salir(0);
    } catch (e) {
        await error(e.message);
    }
})();
