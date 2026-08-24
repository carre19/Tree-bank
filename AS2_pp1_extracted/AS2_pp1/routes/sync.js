// ============================================================
// routes/sync.js — SINCRONIZACIÓN CON EL BANCO CENTRAL
// Este archivo hace dos cosas:
// 1. Define la ruta GET/POST /api/sync para disparar el sync manualmente
// 2. Exporta la función ejecutarSync para que app.js la use en el cron job
//
// El sync pregunta al Banco Central: "¿hubo transferencias hacia mis cuentas
// en los últimos 30 minutos?" y si las hubo, las registra en Supabase.
// ============================================================

const express = require('express');
const router = express.Router();

// Cliente HTTP ya configurado con baseURL y headers (x-api-key, x-environment)
const centralBank = require('../services/centralBankClient');

// Conexión a Supabase para guardar las transacciones
const db = require('../config/db');

// Función principal de sincronización con el Banco Central
const ejecutarSync = async () => {
    try {
        // Llamamos al Banco Central para obtener las transacciones de los últimos 30 minutos
        // Parámetro ?minutos=30 → solo trae las recientes (no toda la historia)
        const response = await centralBank.get('/transactions', { params: { minutos: 30 } });

        // response.data es el array de transacciones que devolvió el Banco Central
        const transacciones = response.data;

        // Si no hay transacciones nuevas → no hay nada que hacer
        if (!Array.isArray(transacciones) || transacciones.length === 0) {
            console.log('ℹ️ Sync: No hay transacciones nuevas del Banco Central.');
            return { mensaje: 'Sin transacciones nuevas', cantidad: 0 };
        }

        let sincronizadas = 0;

        // Recorremos cada transacción que llegó del Banco Central
        for (const tx of transacciones) {

            // Buscamos si el CBU destino de la transacción pertenece a nuestro banco
            // Si es de otro banco → la ignoramos (no nos corresponde)
            const cuentaDestino = await db.query(
                'SELECT * FROM cuentas_bancarias WHERE cbu = $1',
                [tx.cbuDestino]
            );

            if (cuentaDestino.rows.length > 0) {
                const cuenta = cuentaDestino.rows[0];

                // Anti-duplicados: verificamos si esta transacción ya fue procesada antes
                // tx._id es el ID de MongoDB del Banco Central (lo guardamos como referencia_externa)
                // Si ya existe en nuestra tabla → la saltamos para no acreditar el saldo dos veces
                const existe = await db.query(
                    'SELECT id_movimiento FROM movimientos WHERE referencia_externa = $1',
                    [String(tx._id)]
                );

                if (existe.rows.length === 0) {
                    // Acreditamos el saldo en la cuenta destino
                    await db.query(
                        'UPDATE cuentas_bancarias SET saldo = saldo + $1 WHERE id_cuenta = $2',
                        [tx.importe, cuenta.id_cuenta]
                    );

                    // El Banco Central manda los datos del emisor en personaOrigen (nombre,
                    // apellido, cbu, alias). Los guardamos como contraparte del movimiento
                    // para que esta transferencia entrante tambien arme un Contacto.
                    const emisor = tx.personaOrigen || {};
                    const nombreEmisor = [emisor.nombre, emisor.apellido].filter(Boolean).join(' ') || null;

                    // Registramos el movimiento en el historial
                    // referencia_externa guarda el ID del Banco Central para evitar duplicados futuros
                    await db.query(
                        `INSERT INTO movimientos (id_cuenta, tipo_movimiento, monto, descripcion, referencia_externa, cbu_contraparte, nombre_contraparte, fecha)
                         VALUES ($1, 'TRANSFERENCIA_INGRESO', $2, $3, $4, $5, $6, NOW())`,
                        [cuenta.id_cuenta, tx.importe, tx.descripcion || 'Transferencia recibida del exterior', String(tx._id), tx.cbuOrigen || null, nombreEmisor]
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

// Endpoint para disparar el sync manualmente (POST o GET)
const handlerSync = async (req, res) => {
    const resultado = await ejecutarSync();
    if (resultado.error) {
        return res.status(500).json(resultado);
    }
    res.json(resultado);
};

router.post('/sync', handlerSync);
router.get('/sync', handlerSync);

module.exports = router;
module.exports.ejecutarSync = ejecutarSync;
