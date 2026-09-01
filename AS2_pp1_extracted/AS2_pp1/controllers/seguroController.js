// ============================================================
// controllers/seguroController.js — CONTRATACION Y PAGO DE SEGUROS
// Producto interno del banco: no hay integracion con el Banco Central del
// profe para esto. La prima se paga desde la caja de ahorro en ARS,
// respetando el disponible (saldo - reservas) igual que cualquier otro pago.
// ============================================================

const Seguro = require('../models/seguroModel');
const Persona = require('../models/personaModel');

// POST /api/seguros — Contrata una poliza nueva (cobra la primera prima al instante)
exports.contratarPoliza = async (req, res) => {
    const tipo_seguro = (req.body.tipo_seguro || '').toUpperCase();
    if (!Seguro.TIPOS_SEGURO[tipo_seguro]) {
        return res.status(400).json({ error: `El tipo de seguro debe ser uno de: ${Object.keys(Seguro.TIPOS_SEGURO).join(', ')}` });
    }

    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta en ARS para pagar la prima' });
        }

        const { prima_mensual } = Seguro.TIPOS_SEGURO[tipo_seguro];
        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (disponible < prima_mensual) {
            return res.status(400).json({ error: `Disponible insuficiente para la primera prima ($ ${prima_mensual.toFixed(2)}). Disponible: $ ${disponible.toFixed(2)}` });
        }

        const poliza = await Seguro.contratarPoliza({ id_persona: req.usuario.id, tipo_seguro });

        await Persona.descontarSaldo(cuenta.cbu, prima_mensual);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'SEGURO_PRIMA',
            monto: prima_mensual,
            descripcion: `Alta de poliza ${tipo_seguro.toLowerCase().replace('_', ' ')}: primera prima`
        });

        res.status(201).json({ mensaje: 'Poliza contratada correctamente', poliza });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo contratar la poliza', detalle: error.message });
    }
};

// GET /api/seguros — Lista las polizas del usuario logueado
exports.listarMisPolizas = async (req, res) => {
    try {
        const polizas = await Seguro.getPolizasByPersona(req.usuario.id);
        res.json(polizas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las polizas', detalle: error.message });
    }
};

// POST /api/seguros/:id/pagar-prima — Paga la prima del mes en curso
exports.pagarPrima = async (req, res) => {
    const { id } = req.params;
    try {
        const poliza = await Seguro.getPolizaDetalle(id);
        if (!poliza) {
            return res.status(404).json({ error: 'No se encontro la poliza' });
        }
        if (poliza.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta poliza' });
        }
        if (poliza.estado !== 'ACTIVO') {
            return res.status(409).json({ error: `Esta poliza esta ${poliza.estado.toLowerCase()}, no se le pueden pagar primas` });
        }

        const cuenta = await Persona.getCuentaArsPorPersona(poliza.id_persona);
        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (!cuenta || disponible < Number(poliza.prima_mensual)) {
            return res.status(400).json({ error: `Disponible insuficiente para pagar la prima (disponible: $ ${disponible.toFixed(2)})` });
        }

        await Persona.descontarSaldo(cuenta.cbu, poliza.prima_mensual);
        const actualizada = await Seguro.pagarPrima(id);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'SEGURO_PRIMA',
            monto: poliza.prima_mensual,
            descripcion: `Pago de prima: poliza ${poliza.tipo_seguro.toLowerCase().replace('_', ' ')}`
        });

        res.json({ mensaje: 'Prima pagada correctamente', poliza: actualizada });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo pagar la prima', detalle: error.message });
    }
};

// POST /api/seguros/:id/cancelar — Cancela la poliza (no requiere estar al dia con nada,
// no es una deuda)
exports.cancelarPoliza = async (req, res) => {
    const { id } = req.params;
    try {
        const poliza = await Seguro.getPolizaDetalle(id);
        if (!poliza) {
            return res.status(404).json({ error: 'No se encontro la poliza' });
        }
        if (poliza.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta poliza' });
        }
        if (poliza.estado === 'CERRADO') {
            return res.status(409).json({ error: 'Esta poliza ya esta cancelada' });
        }

        await Persona.cambiarEstadoCuenta(poliza.id_producto, 'CERRADO');
        res.json({ mensaje: 'Poliza cancelada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo cancelar la poliza', detalle: error.message });
    }
};
