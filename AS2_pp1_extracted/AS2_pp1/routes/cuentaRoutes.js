// ============================================================
// routes/cuentaRoutes.js — RUTAS DE CAJAS DE AHORRO (ARS / USD)
// ============================================================

const express = require('express');
const router = express.Router();

const cuentaController = require('../controllers/cuentaController');
const { verificarToken } = require('../middleware/authMiddleware');

// POST /api/cuentas — Abre (o recupera) una caja de ahorro en ARS o USD, para el usuario logueado
router.post('/cuentas', verificarToken, cuentaController.abrirCuenta);

// IMPORTANTE: la ruta con 'alias' debe ir ANTES de '/:cbu' para no entrar en conflicto
// GET /api/cuentas/alias/:alias
router.get('/cuentas/alias/:alias', cuentaController.buscarPorAlias);

// GET /api/cuentas/:cbu
router.get('/cuentas/:cbu', cuentaController.buscarPorCbu);

// PUT /api/cuentas/:cbu/alias
router.put('/cuentas/:cbu/alias', cuentaController.asignarAlias);

module.exports = router;
