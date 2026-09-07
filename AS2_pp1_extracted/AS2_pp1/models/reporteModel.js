// ============================================================
// models/reporteModel.js — REPORTES DE PROBLEMAS DE LA APLICACION
// Guarda lo que un usuario cuenta cuando algo le funciona mal, para que
// el equipo lo vea en el panel de administrador (ver reporteController.js).
// ============================================================

const db = require('../config/db');

const Reporte = {
    crear: async ({ id_persona, pagina, descripcion, contacto, user_agent }) => {
        const { rows } = await db.query(
            `INSERT INTO reportes (id_persona, pagina, descripcion, contacto, user_agent)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, fecha`,
            [id_persona || null, pagina || null, descripcion, contacto || null, user_agent || null]
        );
        return rows[0];
    },

    // Todos los reportes, con los datos de quien lo hizo si estaba logueado
    // (LEFT JOIN: un reporte anonimo no tiene persona asociada)
    getAll: async () => {
        const { rows } = await db.query(
            `SELECT r.id, r.pagina, r.descripcion, r.contacto, r.estado, r.fecha,
                    p.nombre, p.apellido, p.dni
             FROM reportes r
             LEFT JOIN personas p ON p.id = r.id_persona
             ORDER BY r.fecha DESC`
        );
        return rows;
    },

    cambiarEstado: async (id, estado) => {
        const { rows } = await db.query(
            'UPDATE reportes SET estado = $1 WHERE id = $2 RETURNING id, estado',
            [estado, id]
        );
        return rows[0];
    },
};

module.exports = Reporte;
