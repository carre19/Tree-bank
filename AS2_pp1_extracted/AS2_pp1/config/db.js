// ============================================================
// config/db.js — CONEXIÓN A LA BASE DE DATOS
// Este archivo crea la conexión con Supabase (PostgreSQL).
// Todos los controllers y models lo importan para hacer consultas SQL.
// ============================================================

// pg es el driver oficial de PostgreSQL para Node.js
// Pool significa "pileta de conexiones": en vez de abrir y cerrar una conexión
// por cada consulta, mantiene varias conexiones abiertas listas para usar (más rápido)
const { Pool } = require('pg');

// Cargamos las variables del .env (contraseña, usuario, etc.)
require('dotenv').config();

// En produccion (Render) la conexion viaja por internet hasta Supabase, asi que
// tiene que ir cifrada con TLS. Se activa poniendo DB_SSL=true en las variables
// de entorno. rejectUnauthorized:false porque el pooler de Supabase presenta un
// certificado propio que Node no tiene en su lista de confianza.
// Con un PostgreSQL local (docker-compose) se deja DB_SSL vacio o en false.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

// Creamos el pool con los datos de conexión de Supabase
// Todos estos valores vienen del archivo .env (nunca se hardcodean en el código)
const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD), // String() porque a veces viene como número
  port:     process.env.DB_PORT,             // Supabase usa el puerto 6543
  ssl,
});

// Exportamos el pool para que cualquier archivo pueda hacer:
// const db = require('../config/db');
// db.query('SELECT * FROM personas') → devuelve los datos
module.exports = pool;