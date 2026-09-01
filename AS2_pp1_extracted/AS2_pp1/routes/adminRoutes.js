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

// GET /api/admin/prestamos - Lista todos los prestamos del banco
router.get('/admin/prestamos', verificarToken, verificarAdmin, adminController.listarPrestamos);

// PUT /api/admin/prestamos/:idPrestamo/mora - Marca un prestamo en mora e informa a la Central de Deudores
router.put('/admin/prestamos/:idPrestamo/mora', verificarToken, verificarAdmin, adminController.marcarPrestamoEnMora);

// GET /api/admin/tarjetas - Lista todas las tarjetas de credito del banco
router.get('/admin/tarjetas', verificarToken, verificarAdmin, adminController.listarTarjetas);

// GET /api/admin/seguros - Lista todas las polizas del banco
router.get('/admin/seguros', verificarToken, verificarAdmin, adminController.listarSeguros);

module.exports = router;
