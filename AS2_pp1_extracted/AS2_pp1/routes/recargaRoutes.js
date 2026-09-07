// ============================================================
// routes/recargaRoutes.js — RUTAS DE RECARGA DE CELULAR
// Todas requieren estar logueado (se paga desde la cuenta propia).
// ============================================================

const express = require('express');
const router = express.Router();

const recargaController = require('../controllers/recargaController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/recargas/operadores', verificarToken, recargaController.listarOperadores);
router.post('/recargas', verificarToken, recargaController.recargar);

module.exports = router;
