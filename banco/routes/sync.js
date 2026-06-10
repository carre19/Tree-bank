const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');

// Función principal de sincronización con el Banco Central
const ejecutarSync = async () => {
    try {
        const response = await axios.get(`${process.env.CENTRAL_BANK_URL}/transactions?minutos=30`, {
            headers: {
                'x-api-key': process.env.CENTRAL_BANK_API_KEY,
                'x-environment': process.env.X_ENVIRONMENT
            }
        });

        const transacciones = response.data;

        if (!Array.isArray(transacciones) || transacciones.length === 0) {
            console.log('ℹ️ Sync: No hay transacciones nuevas del Banco Central.');
            return { mensaje: 'Sin transacciones nuevas', cantidad: 0 };
        }

        let sincronizadas = 0;

        for (const tx of transacciones) {
            // Buscar si la cuenta destino es de este banco
            const cuentaDestino = await db.query(
                'SELECT * FROM cuentas_bancarias WHERE cbu = $1',
                [tx.cbuDestino]
            );

            if (cuentaDestino.rows.length > 0) {
                const cuenta = cuentaDestino.rows[0];

                // Verificar si el movimiento ya fue registrado (evitar duplicados)
                const existe = await db.query(
                    'SELECT id_movimiento FROM movimientos WHERE referencia_externa = $1',
                    [String(tx._id)]
                );

                if (existe.rows.length === 0) {
                    // Actualizar saldo
                    await db.query(
                        'UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE id_cuenta = $2',
                        [tx.importe, cuenta.id_cuenta]
                    );

                    // Registrar el movimiento
                    await db.query(
                        `INSERT INTO movimientos (id_cuenta, tipo_movimiento, monto, descripcion, referencia_externa, fecha)
                         VALUES ($1, 'TRANSFERENCIA_INGRESO', $2, $3, $4, NOW())`,
                        [cuenta.id_cuenta, tx.importe, tx.descripcion || 'Transferencia recibida del exterior', String(tx._id)]
                    );

                    sincronizadas++;
                }
            }
        }

        console.log(`✅ Sync completado: ${sincronizadas} transacciones nuevas registradas.`);
        return { mensaje: 'Sync exitoso', cantidad: sincronizadas };

    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        console.error('❌ Error durante el sync:', detalle);
        return { error: 'Error en sync', detalle };
    }
};

// Endpoint para disparar el sync manualmente
router.post('/sync', async (req, res) => {
    const resultado = await ejecutarSync();
    if (resultado.error) {
        return res.status(500).json(resultado);
    }
    res.json(resultado);
});

module.exports = router;
module.exports.ejecutarSync = ejecutarSync;
