-- ============================================================
-- 11_reportes.sql — Reportes de problemas de la aplicacion
-- Cualquier usuario (logueado o no) puede reportar un problema desde la
-- app. Quedan guardados aca para que el equipo los revise en el panel de
-- administrador, y opcionalmente se avisa a un webhook externo apenas
-- llegan (ver REPORTES_WEBHOOK_URL en el .env.example).
-- Es seguro correr este script mas de una vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS Reportes (
    id SERIAL PRIMARY KEY,
    id_persona INTEGER REFERENCES Personas(id) ON DELETE SET NULL,
    pagina VARCHAR(255),
    descripcion TEXT NOT NULL,
    contacto VARCHAR(255),
    user_agent VARCHAR(500),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'RESUELTO')),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
