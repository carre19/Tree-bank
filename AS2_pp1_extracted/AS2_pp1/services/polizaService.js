// ============================================================
// services/polizaService.js — CADUCIDAD AUTOMATICA DE POLIZAS IMPAGAS
// A diferencia de un prestamo en mora, no pagar un seguro no es una deuda:
// no se informa a la Central de Deudores. Simplemente, si se deja pasar
// demasiado tiempo sin pagar la prima, la poliza se cancela sola.
// ============================================================

const Persona = require('../models/personaModel');
const Seguro = require('../models/seguroModel');

const DIAS_GRACIA_POLIZA = 15;

const ejecutarVerificacionPolizasVencidas = async () => {
    const vencidas = await Seguro.getPolizasVencidas(DIAS_GRACIA_POLIZA);
    let canceladas = 0;
    for (const poliza of vencidas) {
        try {
            await Persona.cambiarEstadoCuenta(poliza.id_producto, 'CERRADO');
            canceladas++;
            console.log(`⚠️  Poliza #${poliza.id_poliza} cancelada automaticamente por falta de pago`);
        } catch (error) {
            console.error(`No se pudo cancelar la poliza #${poliza.id_poliza}:`, error.message);
        }
    }
    return { candidatas: vencidas.length, canceladas };
};

module.exports = { ejecutarVerificacionPolizasVencidas, DIAS_GRACIA_POLIZA };
