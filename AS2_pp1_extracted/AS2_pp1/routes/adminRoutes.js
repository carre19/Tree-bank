// ============================================================
// routes/adminRoutes.js — RUTAS DEL PANEL DE ADMINISTRADOR
// Todas requieren estar logueado (verificarToken) Y tener el rol ADMIN
// (verificarAdmin). Si falta cualquiera de los dos, se rechaza el pedido.
// ============================================================

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { verificarToken, verificarAdmin } = require('../middleware/authMiddleware');

// GET /api/admin/cuentas - Lista todas las cuentas del banco
router.get('/admin/cuentas', verificarToken, verificarAdmin, adminController.listarCuentas);

// PUT /api/admin/cuentas/:idProducto/estado - Cambia el estado de una cuenta
router.put('/admin/cuentas/:idProducto/estado', verificarToken, verificarAdmin, adminController.cambiarEstadoCuenta);

// DELETE /api/admin/cuentas/:idProducto - Elimina la cuenta para siempre (sin saldo ni prestamos pendientes)
router.delete('/admin/cuentas/:idProducto', verificarToken, verificarAdmin, adminController.eliminarCuenta);

module.exports = router;
