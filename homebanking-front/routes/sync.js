require('dotenv').config(); // ✅ Blindaje para las variables de entorno
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movimiento = require('../models/movimientosModel.js'); // ✅ Extensión .js agregada
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,       
    process.env.SUPABASE_KEY
);

// Tomamos el número de banco del .env, por defecto 8
const NUMERO_BANK = parseInt(process.env.NUMERO_BANK) || 8;

// ✅ La lógica está separada en una función reutilizable
async function ejecutarSync() {
    try {
        console.log("--- INICIANDO SINCRONIZACIÓN ---");

        const { data: cuentas } = await supabase.from('cuentas_bancarias').select('*');

        const { data: movsProcesados } = await supabase
            .from('movimientos')
            .select('id_externo')
            .not('id_externo', 'is', null);

        const idsYaProcesados = new Set(
            (movsProcesados || []).map(m => String(m.id_externo))
        );

        const response = await axios.get(
            `${process.env.CENTRAL_BANK_URL}/transactions?minutos=1440`,
            {
                headers: {
                    'x-api-key': process.env.CENTRAL_BANK_API_KEY,
                    'x-environment': process.env.X_ENVIRONMENT
                }
            }
        );

        // ✅ Usamos la variable del entorno en lugar del número hardcodeado
        const misRecibos = response.data.filter(
            t => t.bankCodeDestino === NUMERO_BANK && t.estado === 'aprobada'
        );

        console.log("Transacciones aprobadas encontradas:", misRecibos.length);

        let acreditados = 0;
        let saltados = 0;

        for (const t of misRecibos) {
            const idExterno = String(t._id);       // ✅ Campo correcto
            const montoFinal = parseFloat(t.importe || 0); // ✅ Campo correcto

            if (idsYaProcesados.has(idExterno)) {
                saltados++;
                continue;
            }

            const match = cuentas.find(c =>
                String(c.cbu).trim() === String(t.cbuDestino).trim()
            );

            if (!match || montoFinal <= 0) continue;

            // Saldo fresco para evitar bug de saldo cacheado
            const { data: cuentaFresh } = await supabase
                .from('cuentas_bancarias')
                .select('saldo')
                .eq('id_cuenta', match.id_cuenta)
                .single();

            if (!cuentaFresh) continue;

            const nuevoSaldo = parseFloat(cuentaFresh.saldo) + montoFinal;

            const { error: errUpd } = await Movimiento.actualizarSaldo(match.id_cuenta, nuevoSaldo);
            if (errUpd) { console.log("Error saldo:", errUpd.message); continue; }

            const { error: errMov } = await Movimiento.crear({
                id_cuenta: match.id_cuenta,
                tipo_movimiento: 'TRANSFERENCIA_INGRESO',
                monto: montoFinal,
                descripcion: `Transf. recibida de ${t.personaOrigen?.nombre || ''} ${t.personaOrigen?.apellido || ''}`.trim(),
                fecha: new Date().toISOString(), // ✅ Aseguramos la fecha
                id_externo: idExterno
            });

            if (!errMov) {
                acreditados++;
                idsYaProcesados.add(idExterno);
            } else {
                console.log("Error movimiento:", errMov.message);
            }
        }

        console.log(`✅ Acreditados: ${acreditados} | Saltados: ${saltados}`);
        return { acreditados, saltados };

    } catch (error) {
        console.error("Error en sync:", error.message);
        throw error;
    }
}

// Ruta manual para triggear desde Bruno / Postman
router.get('/central-sync', async (req, res) => {
    try {
        const resultado = await ejecutarSync();
        res.json({ status: "OK", ...resultado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.ejecutarSync = ejecutarSync; // ✅ Exportamos para el cron