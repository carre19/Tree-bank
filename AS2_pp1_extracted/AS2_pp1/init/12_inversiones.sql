-- ============================================================
-- 12_inversiones.sql — Tenencias de acciones y cauciones
-- Igual que Reservas, estos NO son Productos con ciclo de vida propio
-- (a diferencia de Prestamos o Seguros): son registros operativos atados
-- directamente a la persona / cuenta. Es seguro correr este script mas
-- de una vez.
-- ============================================================

-- Tenencias: cuantas acciones (argentinas o extranjeras) tiene cada persona,
-- con el precio promedio de compra (para calcular la ganancia/perdida contra
-- la cotizacion en vivo). Una fila por persona+mercado+simbolo.
CREATE TABLE IF NOT EXISTS Tenencias (
    id_tenencia SERIAL PRIMARY KEY,
    id_persona INTEGER NOT NULL REFERENCES Personas(id) ON DELETE CASCADE,
    mercado VARCHAR(20) NOT NULL CHECK (mercado IN ('ACCION_AR', 'ACCION_EX')),
    simbolo VARCHAR(20) NOT NULL,
    cantidad DECIMAL(18, 6) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    precio_promedio DECIMAL(15, 4) NOT NULL DEFAULT 0,
    moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('ARS', 'USD')),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_persona, mercado, simbolo)
);

-- Cauciones colocadas (el cliente presta pesos a un dia/plazo corto y cobra un
-- interes): monto colocado, plazo, tasa y cuanto va a cobrar al vencimiento.
CREATE TABLE IF NOT EXISTS Cauciones (
    id_caucion SERIAL PRIMARY KEY,
    id_persona INTEGER NOT NULL REFERENCES Personas(id) ON DELETE CASCADE,
    id_cuenta INTEGER NOT NULL REFERENCES Cuentas_Bancarias(id_cuenta),
    monto DECIMAL(15, 2) NOT NULL CHECK (monto > 0),
    plazo_dias INTEGER NOT NULL,
    tasa_anual DECIMAL(6, 2) NOT NULL,
    monto_a_cobrar DECIMAL(15, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'LIQUIDADA')),
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE NOT NULL
);
