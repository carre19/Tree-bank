-- 1) SEGUROS: producto interno del banco (no hay endpoint de seguros en el
-- Banco Central del profe). Igual que prestamos y tarjetas, es un Producto
-- mas: reutiliza Estados_Producto (ACTIVO/CERRADO) para su ciclo de vida.
INSERT INTO Tipos_Producto (nombre) VALUES ('SEGURO') ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS Polizas (
    id_poliza SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL UNIQUE,
    tipo_seguro VARCHAR(30) NOT NULL, -- 'VIDA', 'HOGAR', 'PROTECCION_COMPRAS'
    cobertura DECIMAL(15, 2) NOT NULL,
    prima_mensual DECIMAL(15, 2) NOT NULL,
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_proximo_pago DATE NOT NULL,
    FOREIGN KEY (id_producto) REFERENCES Productos(id_producto)
);

-- 2) RESERVAS: plata "apartada" dentro de una cuenta propia para no gastarla
-- por error. No mueve el saldo real de la cuenta: solo lo etiqueta. El
-- disponible para operar (transferir, pagar cuotas/resumenes, etc.) pasa a
-- ser saldo - suma de sus reservas.
CREATE TABLE IF NOT EXISTS Reservas (
    id_reserva SERIAL PRIMARY KEY,
    id_cuenta INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    monto DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cuenta) REFERENCES Cuentas_Bancarias(id_cuenta)
);
