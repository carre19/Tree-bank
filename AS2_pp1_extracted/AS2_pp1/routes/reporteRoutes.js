// ============================================================
// routes/reporteRoutes.js — RUTAS DE REPORTES DE PROBLEMAS
// ============================================================

const express = require('express');
const router = express.Router();

const reporteController = require('../controllers/reporteController');
const { verificarToken, verificarAdmin } = require('../middleware/authMiddleware');

// POST /api/reportes — publico (con o sin login); el limite de intentos se
// aplica en app.js, antes de llegar aca
router.post('/reportes', reporteController.crearReporte);

// GET /api/reportes/mios — el usuario logueado ve lo que reporto (con su estado)
router.get('/reportes/mios', verificarToken, reporteController.misReportes);

// GET /api/admin/reportes y PUT /api/admin/reportes/:id/estado — solo ADMIN
router.get('/admin/reportes', verificarToken, verificarAdmin, reporteController.listarReportes);
router.put('/admin/reportes/:id/estado', verificarToken, verificarAdmin, reporteController.cambiarEstadoReporte);

module.exports = router;
