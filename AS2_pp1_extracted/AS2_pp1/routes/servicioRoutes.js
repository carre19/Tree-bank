// ============================================================
// routes/servicioRoutes.js — RUTAS DE PAGO DE SERVICIOS
// Todas requieren estar logueado (se paga desde la cuenta propia).
// ============================================================

const express = require('express');
const router = express.Router();

const servicioController = require('../controllers/servicioController');
const { verificarToken } = require('../middleware/authMiddleware');

router.post('/servicios/consultar-factura', verificarToken, servicioController.consultarFactura);
router.post('/servicios/pagar', verificarToken, servicioController.pagarServicio);

module.exports = router;
