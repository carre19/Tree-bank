// ============================================================
// controllers/reporteController.js — REPORTES DE PROBLEMAS
// Cualquiera puede reportar un problema, este logueado o no (puede fallar
// justo el login). Si viene un token valido, el reporte queda asociado a
// esa persona; si no, queda anonimo. El panel de administrador los lista
// y permite marcarlos como resueltos.
// ============================================================

const jwt = require('jsonwebtoken');
const Reporte = require('../models/reporteModel');
const { validarTexto, validarEntero } = require('../utils/validaciones');
const { avisarReporteNuevo } = require('../services/notificacionService');

// A diferencia de verificarToken, ACA un token ausente o invalido no rechaza
// el pedido: solo hace que el reporte quede sin persona asociada
const idPersonaOpcional = (req) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET).id;
    } catch {
        return null;
    }
};

// POST /api/reportes — Publico (con o sin login), limitado por IP en app.js
exports.crearReporte = async (req, res) => {
    const { descripcion, pagina, contacto } = req.body;

    if (!validarTexto(descripcion, { min: 10, max: 2000 })) {
        return res.status(400).json({ error: 'Contanos el problema con al menos 10 caracteres (máximo 2000)' });
    }
    if (pagina !== undefined && pagina !== '' && !validarTexto(pagina, { min: 1, max: 255 })) {
        return res.status(400).json({ error: 'La página indicada no es válida' });
    }
    if (contacto !== undefined && contacto !== '' && !validarTexto(contacto, { min: 3, max: 255 })) {
        return res.status(400).json({ error: 'El contacto indicado no es válido' });
    }

    try {
        const reporte = await Reporte.crear({
            id_persona: idPersonaOpcional(req),
            pagina: pagina || null,
            descripcion,
            contacto: contacto || null,
            user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
        });

        // No se espera el resultado del webhook: si tarda o falla, no debe
        // demorar ni romper la respuesta al usuario que reporto el problema
        avisarReporteNuevo({ id: reporte.id, pagina, descripcion });

        res.status(201).json({ mensaje: 'Gracias, recibimos tu reporte. El equipo lo va a revisar.' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo enviar el reporte', detalle: error.message });
    }
};

// GET /api/reportes/mios — el usuario logueado ve sus propios reportes
// (los que mando anonimo, sin token, no quedan asociados y no aparecen aca)
exports.misReportes = async (req, res) => {
    try {
        const reportes = await Reporte.getByPersona(req.usuario.id);
        res.json(reportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tus reportes', detalle: error.message });
    }
};

// GET /api/admin/reportes (solo ADMIN)
exports.listarReportes = async (req, res) => {
    try {
        const reportes = await Reporte.getAll();
        res.json(reportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar los reportes', detalle: error.message });
    }
};

// PUT /api/admin/reportes/:id/estado (solo ADMIN)
exports.cambiarEstadoReporte = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (!validarEntero(id)) {
        return res.status(400).json({ error: 'Id de reporte inválido' });
    }
    if (!['ABIERTO', 'RESUELTO'].includes(estado)) {
        return res.status(400).json({ error: 'El estado debe ser ABIERTO o RESUELTO' });
    }

    try {
        const actualizado = await Reporte.cambiarEstado(id, estado);
        if (!actualizado) {
            return res.status(404).json({ error: 'No se encontró el reporte indicado' });
        }
        res.json({ mensaje: `Reporte actualizado a ${estado}`, ...actualizado });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo actualizar el reporte', detalle: error.message });
    }
};
