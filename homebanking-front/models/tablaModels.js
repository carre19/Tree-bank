const path = require('path');
const db = require(path.join(__dirname, '../config/db.js'));
const tablas = [
  'Personas',
  'Roles',
  'Roles_x_Personas',
  'Tipos_Producto',
  'Estados_Producto',
  'Productos',
  'Cuentas_Bancarias',
  'Tarjetas_Credito',
];

const TablaModel = {};

tablas.forEach((tabla) => {
  TablaModel[tabla] = {
    getAll: async () => {
      // Pasamos el nombre a minúsculas para que Postgres no tire error de "table not found"
      const nombreTablaPg = tabla.toLowerCase(); 
      const { rows } = await db.query(`SELECT * FROM ${nombreTablaPg}`);
      return rows;
    },
  };
});

module.exports = TablaModel;