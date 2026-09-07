// ============================================================
// services/caucionLiquidacionService.js — LIQUIDACION AUTOMATICA DE CAUCIONES
// Al llegar la fecha de vencimiento, se acredita el capital + interes a la
// caja en ARS de origen y se marca la caucion como LIQUIDADA. Corre solo,
// por cron (ver app.js), una vez por dia.
// ============================================================

const Persona = require('../models/personaModel');
const Caucion = require('../models/caucionModel');

const ejecutarLiquidacionCauciones = async () => {
    const vencidas = await Caucion.getVencidas();
    let liquidadas = 0;

    for (const caucion of vencidas) {
        try {
            const actualizada = await Caucion.liquidar(caucion.id_caucion);
            if (!actualizada) continue; // ya la liquido otro proceso justo antes

            const cuenta = await Persona.getCuentaArsPorPersona(caucion.id_persona);
            if (!cuenta) {
                console.error(`Caucion #${caucion.id_caucion}: no se encontro la cuenta ARS de la persona ${caucion.id_persona}`);
                continue;
            }

            await Persona.acreditarSaldo(cuenta.cbu, Number(caucion.monto_a_cobrar));
            await Persona.registrarMovimiento({
                id_cuenta: cuenta.id_cuenta,
                tipo_movimiento: 'CAUCION_LIQUIDADA',
                monto: Number(caucion.monto_a_cobrar),
                descripcion: `Liquidacion de caucion a ${caucion.plazo_dias} dia(s) (capital + interes)`,
            });
            liquidadas++;
        } catch (error) {
            console.error(`No se pudo liquidar la caucion #${caucion.id_caucion}:`, error.message);
        }
    }

    return { candidatas: vencidas.length, liquidadas };
};

module.exports = { ejecutarLiquidacionCauciones };
