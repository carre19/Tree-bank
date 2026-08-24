// ============================================================
// routes/tarjetaRoutes.js — RUTAS DE TARJETAS DE CREDITO
// Todas requieren estar logueado (son operaciones sobre las tarjetas propias).
// ============================================================

const express = require('express');
const router = express.Router();

const tarjetaController = require('../controllers/tarjetaController');
const { verificarToken } = require('../middleware/authMiddleware');

router.post('/tarjetas', verificarToken, tarjetaController.emitirTarjeta);
router.get('/tarjetas', verificarToken, tarjetaController.listarMisTarjetas);
router.post('/tarjetas/:id/compras', verificarToken, tarjetaController.realizarCompra);
router.post('/tarjetas/:id/pagar-resumen', verificarToken, tarjetaController.pagarResumen);
router.get('/tarjetas/:id/movimientos', verificarToken, tarjetaController.obtenerMovimientos);
router.post('/tarjetas/:id/cerrar', verificarToken, tarjetaController.cerrarTarjeta);

module.exports = router;
