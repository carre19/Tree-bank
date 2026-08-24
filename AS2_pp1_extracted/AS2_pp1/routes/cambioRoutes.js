// ============================================================
// routes/cambioRoutes.js — RUTAS DE COMPRA/VENTA DE DÓLARES
// ============================================================

const express = require('express');
const router = express.Router();

const cambioController = require('../controllers/cambioController');
const { verificarToken } = require('../middleware/authMiddleware');

// GET /api/cambio/cotizacion — Cotizacion del dolar oficial vigente (publica)
router.get('/cambio/cotizacion', cambioController.obtenerCotizacion);

// POST /api/cambio — Compra o vende dolares para el usuario logueado
router.post('/cambio', verificarToken, cambioController.realizarCambio);

module.exports = router;
