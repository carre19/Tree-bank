const express = require('express');
const router = express.Router();
const bancoController = require('../controllers/bancoController');
const { verificarToken, verificarAdmin } = require('../middleware/authMiddleware');

// GET /api/bancos — Lista todos los bancos del sistema
router.get('/bancos', bancoController.listarBancos);

// GET /api/bancos/:bankCode — Obtiene un banco por su código numérico
router.get('/bancos/:bankCode', bancoController.obtenerBancoPorCodigo);

// PUT /api/bancos/nombre — Cambia el nombre de este banco en el Banco Central (solo ADMIN).
// Usa NUESTRA api-key contra el Banco Central, asi que abierto al publico
// cualquiera podia renombrar el banco en el sistema del profe.
router.put('/bancos/nombre', verificarToken, verificarAdmin, bancoController.cambiarNombreBanco);

module.exports = router;
