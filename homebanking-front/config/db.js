const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD),
  port: parseInt(process.env.DB_PORT) || 6543,
  statement_timeout: 10000, 
  idle_in_transaction_session_timeout: 10000
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err.message || err);
});

module.exports = pool;