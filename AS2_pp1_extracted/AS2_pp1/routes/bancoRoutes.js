const express = require('express');
const router = express.Router();
const bancoController = require('../controllers/bancoController');

// GET /api/bancos — Lista todos los bancos del sistema
router.get('/bancos', bancoController.listarBancos);

// GET /api/bancos/:bankCode — Obtiene un banco por su código numérico
router.get('/bancos/:bankCode', bancoController.obtenerBancoPorCodigo);

// PUT /api/bancos/nombre — Cambia el nombre de este banco en el Banco Central
router.put('/bancos/nombre', bancoController.cambiarNombreBanco);

module.exports = router;
