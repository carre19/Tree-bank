const TablaModel = require('../models/tablaModel');

const mapaRutas = {
  personas:          'Personas',
  roles:             'Roles',
  roles_x_personas:  'Roles_x_Personas',
  tipos_producto:    'Tipos_Producto',
  estados_producto:  'Estados_Producto',
  productos:         'Productos',
  cuentas_bancarias: 'Cuentas_Bancarias',
  tarjetas_credito:  'Tarjetas_Credito',
};

// Columnas que no salen nunca de la base, ni siquiera para un ADMIN:
// el hash de la contrasena no le sirve a nadie del lado del cliente y filtrarlo
// permite crackearlo offline.
const COLUMNAS_OCULTAS = ['password_hash'];

const ocultarSensibles = (filas) => filas.map((fila) => {
  const copia = { ...fila };
  COLUMNAS_OCULTAS.forEach((col) => delete copia[col]);
  return copia;
});

exports.obtenerTabla = async (req, res) => {
  const nombreTabla = mapaRutas[req.params.tabla];
  if (!nombreTabla) {
    return res.status(404).json({ error: `Tabla '${req.params.tabla}' no encontrada` });
  }
  try {
    const rows = await TablaModel[nombreTabla].getAll();
    res.json(ocultarSensibles(rows));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
