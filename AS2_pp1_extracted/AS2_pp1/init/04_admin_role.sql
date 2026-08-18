-- ============================================================
-- 04_admin_role.sql — Alta del rol ADMIN
-- Ejecutar en el SQL Editor de Supabase (o con psql) para habilitar
-- el panel de administrador. Es seguro ejecutarlo mas de una vez.
-- ============================================================

-- 1. Crear el rol ADMIN si todavia no existe
INSERT INTO Roles (nombre_rol, descripcion)
SELECT 'ADMIN', 'Administrador del sistema: gestiona las cuentas de todos los clientes'
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'ADMIN');

-- 2. Asignar el rol ADMIN a una persona ya existente
-- Reemplazar '35123456' por el DNI real de quien va a administrar el banco
-- (esa persona debe tener ya su contrasena creada via POST /api/auth/register)
INSERT INTO Roles_x_Personas (id_persona, id_rol)
SELECT per.id, rol.id_rol
FROM Personas per, Roles rol
WHERE per.dni = '35123456' AND rol.nombre_rol = 'ADMIN'
ON CONFLICT (id_persona, id_rol) DO NOTHING;
