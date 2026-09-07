// ============================================================
// routes/inversionRoutes.js — RUTAS DE INVERSIONES (ACCIONES Y CAUCIONES)
// Todas requieren estar logueado: se opera siempre contra la cuenta propia.
// ============================================================

const express = require('express');
const router = express.Router();

const inversionController = require('../controllers/inversionController');
const caucionController = require('../controllers/caucionController');
const { verificarToken } = require('../middleware/authMiddleware');

// Acciones (argentinas y extranjeras)
router.get('/inversiones/cotizaciones/:mercado', verificarToken, inversionController.obtenerCotizacionesPanel);
router.get('/inversiones/tenencias', verificarToken, inversionController.obtenerTenencias);
router.post('/inversiones/comprar', verificarToken, inversionController.comprar);
router.post('/inversiones/vender', verificarToken, inversionController.vender);

// Cauciones
router.get('/cauciones/plazos', verificarToken, caucionController.obtenerPlazos);
router.get('/cauciones', verificarToken, caucionController.obtenerMisCauciones);
router.post('/cauciones', verificarToken, caucionController.colocar);

module.exports = router;
