-- Prestamos: se modelan como un Producto mas (igual que Cuentas_Bancarias y
-- Tarjetas_Credito), asi reutilizan Estados_Producto para su ciclo de vida:
-- ACTIVO = vigente pagando cuotas, CERRADO = pagado en su totalidad,
-- BLOQUEADO = en mora (y ya reportado a la Central de Deudores).
INSERT INTO Tipos_Producto (nombre) VALUES ('PRESTAMO') ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS Prestamos (
    id_prestamo SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL UNIQUE,
    monto DECIMAL(15, 2) NOT NULL,
    tasa_interes DECIMAL(5, 2) NOT NULL,
    cuotas_totales INTEGER NOT NULL,
    cuotas_pagadas INTEGER NOT NULL DEFAULT 0,
    monto_cuota DECIMAL(15, 2) NOT NULL,
    saldo_pendiente DECIMAL(15, 2) NOT NULL,
    -- Situacion crediticia (1-5) consultada a la Central de Deudores al momento
    -- de aprobar el prestamo, guardada para trazabilidad. NULL = no figuraba.
    situacion_al_otorgar INTEGER,
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES Productos(id_producto)
);
