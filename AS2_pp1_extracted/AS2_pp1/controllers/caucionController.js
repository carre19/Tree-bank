// ============================================================
// controllers/caucionController.js — CAUCIONES COLOCADAS
// Coloca pesos a un plazo corto (1, 7, 15 o 30 dias) y cobra un interes al
// vencimiento (ver caucionModel.js sobre por que la tasa es simulada y no
// un feed en vivo). El monto colocado sale de la caja en ARS al momento de
// colocar, y vuelve con el interes ya sumado cuando se liquida (ver
// services/caucionLiquidacionService.js, que corre solo por cron).
// ============================================================

const Persona = require('../models/personaModel');
const Caucion = require('../models/caucionModel');
const { validarMonto, aMonto } = require('../utils/validaciones');

// GET /api/cauciones/plazos — Tabla de tasas vigente, para armar el formulario
exports.obtenerPlazos = (req, res) => {
    res.json({
        plazos: Object.entries(Caucion.TASAS_POR_PLAZO).map(([dias, tasa_anual]) => ({
            plazo_dias: Number(dias),
            tasa_anual,
        })),
    });
};

// GET /api/cauciones — Cauciones del usuario logueado
exports.obtenerMisCauciones = async (req, res) => {
    try {
        const cauciones = await Caucion.getMisCauciones(req.usuario.id);
        res.json(cauciones);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener tus cauciones', detalle: error.message });
    }
};

// POST /api/cauciones — { monto, plazo_dias }
exports.colocar = async (req, res) => {
    const plazo_dias = Number(req.body.plazo_dias);

    if (!Caucion.TASAS_POR_PLAZO[plazo_dias]) {
        return res.status(400).json({ error: `El plazo debe ser uno de: ${Object.keys(Caucion.TASAS_POR_PLAZO).join(', ')} dias` });
    }
    if (!validarMonto(req.body.monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero positivo, con hasta 2 decimales y dentro del limite permitido' });
    }
    const monto = aMonto(req.body.monto);

    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro tu cuenta en ARS' });
        }

        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (disponible < monto) {
            return res.status(400).json({ error: `Disponible insuficiente para colocar la caucion (disponible: $ ${disponible.toFixed(2)})` });
        }

        const { tasa_anual, monto_a_cobrar } = Caucion.simular(monto, plazo_dias);

        await Persona.descontarSaldo(cuenta.cbu, monto);
        const caucion = await Caucion.crear({
            id_persona: req.usuario.id,
            id_cuenta: cuenta.id_cuenta,
            monto, plazo_dias, tasa_anual, monto_a_cobrar,
        });
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'CAUCION_COLOCADA',
            monto,
            descripcion: `Caucion a ${plazo_dias} dia(s), TNA ${tasa_anual}%`,
        });

        res.status(201).json({
            mensaje: `Colocaste $ ${monto.toFixed(2)} a ${plazo_dias} dia(s). Vas a cobrar $ ${monto_a_cobrar.toFixed(2)} al vencimiento.`,
            caucion,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo colocar la caucion', detalle: error.message });
    }
};
