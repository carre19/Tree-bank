const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController.js');

router.get('/personas', personaController.obtenerPersonas);
router.post('/personas', personaController.crearPersona);
router.post('/personas/transferir', personaController.realizarTransferencia);
router.get('/cuentas/:idCuenta/movimientos', personaController.obtenerMovimientos);
router.get('/personas/:id/roles', personaController.obtenerRoles);
router.get('/personas/:id/productos', personaController.obtenerProductos);

module.exports = router;