// ============================================================
// routes/prestamoRoutes.js — RUTAS DE PRESTAMOS
// Todas requieren estar logueado: un prestamo siempre es sobre la
// cuenta propia del usuario autenticado.
// ============================================================

const express = require('express');
const router = express.Router();

const prestamoController = require('../controllers/prestamoController');
const { verificarToken } = require('../middleware/authMiddleware');

// POST /api/prestamos — Solicita un prestamo (consulta la Central de Deudores antes de aprobar)
router.post('/prestamos', verificarToken, prestamoController.solicitarPrestamo);

// GET /api/prestamos — Lista los prestamos del usuario logueado
router.get('/prestamos', verificarToken, prestamoController.listarMisPrestamos);

// POST /api/prestamos/:id/pagar-cuota — Paga la siguiente cuota
router.post('/prestamos/:id/pagar-cuota', verificarToken, prestamoController.pagarCuota);

module.exports = router;
