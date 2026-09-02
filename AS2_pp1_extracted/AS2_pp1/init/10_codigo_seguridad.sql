-- Agrega el codigo de seguridad (CVV) de 3 digitos a las tarjetas: el
-- usuario tiene que poder ver el numero completo y el CVV de su propia
-- tarjeta, no solo la version enmascarada.
ALTER TABLE Tarjetas_Credito ADD COLUMN IF NOT EXISTS codigo_seguridad VARCHAR(3);

-- Genera uno para las tarjetas que ya existian antes de este cambio
UPDATE Tarjetas_Credito
SET codigo_seguridad = LPAD((FLOOR(RANDOM() * 1000))::TEXT, 3, '0')
WHERE codigo_seguridad IS NULL;

ALTER TABLE Tarjetas_Credito ALTER COLUMN codigo_seguridad SET NOT NULL;
