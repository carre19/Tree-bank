-- Agrega la fecha de la proxima cuota a vencer de cada prestamo, para poder
-- mostrarla al cliente y para que el chequeo automatico de mora sepa cuales
-- estan atrasados. Los prestamos ya existentes arrancan venciendo en 1 mes
-- desde hoy (no tenemos su fecha real de alta con precision de dia a dia util
-- para esto, y es un valor razonable para no dejarlos "vencidos" de arranque).
ALTER TABLE Prestamos ADD COLUMN IF NOT EXISTS fecha_proximo_vencimiento DATE;

UPDATE Prestamos
SET fecha_proximo_vencimiento = CURRENT_DATE + INTERVAL '1 month'
WHERE fecha_proximo_vencimiento IS NULL;
