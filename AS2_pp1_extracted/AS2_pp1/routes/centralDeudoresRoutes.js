// ============================================================
// routes/centralDeudoresRoutes.js — RUTAS DE CENTRAL DE DEUDORES
// ============================================================

const express = require('express');
const router = express.Router();

const centralDeudoresController = require('../controllers/centralDeudoresController');
const { verificarToken, verificarAdmin } = require('../middleware/authMiddleware');

// POST /api/central-deudores — Informa/actualiza una deuda (solo ADMIN)
router.post('/central-deudores', verificarToken, verificarAdmin, centralDeudoresController.informarDeuda);

// GET /api/central-deudores/:dni — Consulta la situacion crediticia de un DNI
router.get('/central-deudores/:dni', centralDeudoresController.consultarSituacion);

module.exports = router;
