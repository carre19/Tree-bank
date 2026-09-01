// ============================================================
// routes/seguroRoutes.js — RUTAS DE SEGUROS
// Todas requieren estar logueado (son operaciones sobre las polizas propias).
// ============================================================

const express = require('express');
const router = express.Router();

const seguroController = require('../controllers/seguroController');
const { verificarToken } = require('../middleware/authMiddleware');

router.post('/seguros', verificarToken, seguroController.contratarPoliza);
router.get('/seguros', verificarToken, seguroController.listarMisPolizas);
router.post('/seguros/:id/pagar-prima', verificarToken, seguroController.pagarPrima);
router.post('/seguros/:id/cancelar', verificarToken, seguroController.cancelarPoliza);

module.exports = router;
