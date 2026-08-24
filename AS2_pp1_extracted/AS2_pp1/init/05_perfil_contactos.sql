-- Dato de sexo autopercibido, capturado al crear la contraseña (POST /auth/register).
-- Opcional: nunca se asume, por eso admite NULL / "Prefiero no decir".
ALTER TABLE Personas ADD COLUMN IF NOT EXISTS sexo VARCHAR(30);

-- Contraparte de cada movimiento de transferencia (CBU + nombre de quien envía/recibe).
-- Se usa para armar la lista de "Contactos": solo gente con la que ya operaste,
-- en vez de exponer a todos los clientes del banco.
ALTER TABLE Movimientos ADD COLUMN IF NOT EXISTS cbu_contraparte VARCHAR(22);
ALTER TABLE Movimientos ADD COLUMN IF NOT EXISTS nombre_contraparte VARCHAR(255);
