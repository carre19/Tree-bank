-- Habilita el uso real de Tarjetas_Credito (hasta ahora la tabla existia pero
-- ninguna funcionalidad la usaba, salvo como bloqueo al cerrar una cuenta).
-- saldo_consumido = cuanto del limite esta usado (lo que se debe del resumen).
ALTER TABLE Tarjetas_Credito ADD COLUMN IF NOT EXISTS saldo_consumido DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Movimientos ahora puede pertenecer a una cuenta bancaria O a una tarjeta de
-- credito (una compra con tarjeta no mueve saldo de ninguna cuenta al momento
-- de hacerse). id_cuenta pasa a ser opcional y agregamos id_tarjeta.
ALTER TABLE Movimientos ALTER COLUMN id_cuenta DROP NOT NULL;
ALTER TABLE Movimientos ADD COLUMN IF NOT EXISTS id_tarjeta INTEGER REFERENCES Tarjetas_Credito(id_tarjeta);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_movimiento_origen'
    ) THEN
        ALTER TABLE Movimientos
            ADD CONSTRAINT chk_movimiento_origen CHECK (id_cuenta IS NOT NULL OR id_tarjeta IS NOT NULL);
    END IF;
END $$;
