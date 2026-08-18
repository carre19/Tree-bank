// ============================================================
// routes/authRoutes.js — RUTAS DE AUTENTICACIÓN
// Este archivo solo define qué URLs existen y qué función las maneja.
// No tiene lógica propia: delega todo al authController.
// ============================================================

// express.Router() crea un "mini-servidor" para este grupo de rutas
const express = require('express');
const router = express.Router();

// Importamos las funciones de lógica del controller
const authController = require('../controllers/authController');

// Importamos el middleware que verifica el token JWT
// Las rutas marcadas con verificarToken solo funcionan si el usuario está logueado
const { verificarToken } = require('../middleware/authMiddleware');

// POST /api/auth/register - Crea una contrasena para una persona existente
router.post('/auth/register', authController.register);

// POST /api/auth/login - Inicia sesion y devuelve un token JWT
router.post('/auth/login', authController.login);

// GET /api/auth/me - Datos basicos del usuario (requiere token)
router.get('/auth/me', verificarToken, authController.me);

// GET /api/auth/perfil - Perfil completo editable (requiere token)
router.get('/auth/perfil', verificarToken, authController.getPerfil);

// PUT /api/auth/perfil - Actualiza datos personales (requiere token)
router.put('/auth/perfil', verificarToken, authController.updatePerfil);

// PUT /api/auth/cambiar-password - Cambia la password (requiere token)
router.put('/auth/cambiar-password', verificarToken, authController.cambiarPassword);

module.exports = router;
