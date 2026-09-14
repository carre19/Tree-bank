// ============================================================
// controllers/caucionController.js — CAUCIONES COLOCADAS
// Coloca pesos a un plazo elegido (1 a 30 dias, o uno de los plazos largos
// de caucionModel.js) y cobra un interes al vencimiento (ver caucionModel.js
// sobre por que la tasa es simulada y no un feed en vivo). Solo se pueden
// colocar mientras el mercado esta en rueda (dias habiles, 11 a 17hs
// Argentina) — fuera de ese horario la tasa es 0 y el pedido se rechaza,
// igual que en la vida real no hay caucion fuera de sesion. El monto sale
// de la caja en ARS al colocar, y vuelve con el interes ya sumado cuando se
// liquida (ver services/caucionLiquidacionService.js, que corre por cron).
// ============================================================

const Persona = require('../models/personaModel');
const Caucion = require('../models/caucionModel');
const db = require('../config/db');
const { validarMonto, aMonto } = require('../utils/validaciones');

// GET /api/cauciones/plazos — Tabla de tasas vigente, para armar el formulario.
// Si el mercado esta cerrado, todas las tasas vienen en 0 (mercado_abierto: false)
// para que el frontend pueda avisar y deshabilitar la colocacion.
exports.obtenerPlazos = (req, res) => {
    const abierto = Caucion.mercadoAbierto();
    res.json({
        mercado_abierto: abierto,
        horario: `${Caucion.HORA_APERTURA}:00 a ${Caucion.HORA_CIERRE}:00, dias habiles (hora Argentina)`,
        plazos: Caucion.PLAZOS_VALIDOS.map((dias) => ({
            plazo_dias: dias,
            tasa_anual: abierto ? Caucion.tasaCurva(dias) : 0,
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

    if (!Caucion.PLAZOS_VALIDOS.includes(plazo_dias)) {
        return res.status(400).json({ error: `El plazo debe ser uno de: ${Caucion.PLAZOS_VALIDOS.join(', ')} dias` });
    }
    if (!validarMonto(req.body.monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero positivo, con hasta 2 decimales y dentro del limite permitido' });
    }
    if (!Caucion.mercadoAbierto()) {
        return res.status(400).json({
            error: `El mercado de cauciones está cerrado. Se opera de ${Caucion.HORA_APERTURA}:00 a ${Caucion.HORA_CIERRE}:00, días hábiles (hora Argentina) — volvé a intentar en el próximo horario de rueda.`
        });
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

        const client = await db.connect();
        let caucion;
        try {
            await client.query('BEGIN');
            await Persona.descontarSaldo(cuenta.cbu, monto, client);
            caucion = await Caucion.crear({
                id_persona: req.usuario.id,
                id_cuenta: cuenta.id_cuenta,
                monto, plazo_dias, tasa_anual, monto_a_cobrar,
            }, client);
            await Persona.registrarMovimiento({
                id_cuenta: cuenta.id_cuenta,
                tipo_movimiento: 'CAUCION_COLOCADA',
                monto,
                descripcion: `Caucion a ${plazo_dias} dia(s), TNA ${tasa_anual}%`,
            }, client);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.status(201).json({
            mensaje: `Colocaste $ ${monto.toFixed(2)} a ${plazo_dias} dia(s). Vas a cobrar $ ${monto_a_cobrar.toFixed(2)} al vencimiento.`,
            caucion,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo colocar la caucion', detalle: error.message });
    }
};
