// ============================================================
// routes/reservaRoutes.js — RUTAS DE RESERVAS DE PLATA
// Todas requieren estar logueado (son operaciones sobre cuentas propias).
// ============================================================

const express = require('express');
const router = express.Router();

const reservaController = require('../controllers/reservaController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/cuentas/:cbu/reservas', verificarToken, reservaController.listarReservas);
router.post('/cuentas/:cbu/reservas', verificarToken, reservaController.crearReserva);
router.post('/reservas/:id/agregar', verificarToken, reservaController.agregarMonto);
router.post('/reservas/:id/liberar', verificarToken, reservaController.liberarMonto);
router.delete('/reservas/:id', verificarToken, reservaController.eliminarReserva);

module.exports = router;
