const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');
const verificarToken = require('../middleware/authMiddleware');

// GET /api/personas - Lista todas las personas (publico, para admin)
router.get('/personas', personaController.obtenerPersonas);

// POST /api/personas - Registra una persona (llama al Banco Central)
router.post('/personas', personaController.crearPersona);

// IMPORTANTE: la ruta con 'alias' debe ir ANTES de '/:id' para no entrar en conflicto
// GET /api/personas/alias/:alias
router.get('/personas/alias/:alias', personaController.buscarPorAlias);

// GET /api/personas/:cbu/buscar
router.get('/personas/:cbu/buscar', personaController.buscarPorCbu);

// PUT /api/personas/:cbu/alias
router.put('/personas/:cbu/alias', personaController.asignarAlias);

// GET /api/personas/:id/roles
router.get('/personas/:id/roles', personaController.obtenerRoles);

// GET /api/personas/:id/productos (requiere token - solo el propio usuario)
router.get('/personas/:id/productos', verificarToken, personaController.obtenerProductos);

// POST /api/transferencias (requiere token)
router.post('/transferencias', verificarToken, personaController.realizarTransferencia);

// POST /api/depositos (requiere token)
router.post('/depositos', verificarToken, personaController.realizarDeposito);

// GET /api/movimientos/:idCuenta (requiere token - solo el dueno)
router.get('/movimientos/:idCuenta', verificarToken, personaController.obtenerMovimientos);

module.exports = router;
