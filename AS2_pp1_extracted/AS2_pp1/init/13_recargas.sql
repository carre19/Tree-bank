-- RECARGAS DE CELULAR: además del registro genérico en Movimientos, guardamos
-- el detalle propio de cada recarga (operador y número de celular) en su
-- propia tabla, para poder consultarlas/reportarlas sin parsear la
-- descripción del movimiento.
CREATE TABLE IF NOT EXISTS Recargas (
    id_recarga SERIAL PRIMARY KEY,
    id_cuenta INTEGER NOT NULL,
    id_movimiento INTEGER NOT NULL,
    operador VARCHAR(30) NOT NULL, -- 'MOVISTAR', 'PERSONAL', 'CLARO'
    numero_celular VARCHAR(10) NOT NULL,
    monto DECIMAL(15, 2) NOT NULL,
    saldo_posterior DECIMAL(15, 2) NOT NULL, -- saldo de la cuenta justo después de la recarga
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cuenta) REFERENCES Cuentas_Bancarias(id_cuenta),
    FOREIGN KEY (id_movimiento) REFERENCES Movimientos(id_movimiento)
);
