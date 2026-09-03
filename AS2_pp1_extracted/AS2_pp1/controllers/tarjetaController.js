// ============================================================
// controllers/tarjetaController.js — EMISION Y USO DE TARJETAS DE CREDITO
// Misma logica de aprobacion que los prestamos: se consulta la Central de
// Deudores antes de emitir la tarjeta, y el limite de compra depende de la
// situacion crediticia informada.
// ============================================================

const centralBank = require('../services/centralBankClient');
const Tarjeta = require('../models/tarjetaModel');
const Persona = require('../models/personaModel');
const { validarMonto, aMonto } = require('../utils/validaciones');

const SITUACION_LIMITE = 4; // 4 (riesgo alto) o 5 (irrecuperable) -> se rechaza

// POST /api/tarjetas — Emite una tarjeta de credito nueva para el usuario logueado
exports.emitirTarjeta = async (req, res) => {
    const marca = (req.body.marca || 'VISA').toUpperCase();
    if (!Tarjeta.MARCAS_VALIDAS.includes(marca)) {
        return res.status(400).json({ error: `La marca debe ser una de: ${Tarjeta.MARCAS_VALIDAS.join(', ')}` });
    }

    try {
        const yaTiene = await Tarjeta.tieneActivaDeMarca(req.usuario.id, marca);
        if (yaTiene) {
            return res.status(409).json({ error: `Ya tenes una tarjeta ${marca} activa. No podes tener mas de una del mismo tipo.` });
        }

        const dni = req.usuario.dni;

        let situacion = 1;
        try {
            const respuestaCentral = await centralBank.get(`/central-deudores/${dni}`);
            situacion = respuestaCentral.data?.situacion ?? 1;
        } catch (error) {
            if (error.response?.status !== 404) {
                const detalle = error.response ? error.response.data : error.message;
                return res.status(502).json({ error: 'No se pudo consultar la Central de Deudores', detalle });
            }
        }

        if (situacion >= SITUACION_LIMITE) {
            return res.status(403).json({
                error: `Tarjeta rechazada: la Central de Deudores informa situacion ${situacion} (riesgo alto/irrecuperable).`,
                situacion
            });
        }

        const tarjeta = await Tarjeta.crearTarjeta({ id_persona: req.usuario.id, marca, situacion_al_otorgar: situacion });

        res.status(201).json({
            mensaje: 'Tarjeta emitida correctamente',
            situacion_al_otorgar: situacion,
            tarjeta
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo emitir la tarjeta', detalle: error.message });
    }
};

// GET /api/tarjetas — Lista las tarjetas del usuario logueado
exports.listarMisTarjetas = async (req, res) => {
    try {
        const tarjetas = await Tarjeta.getTarjetasByPersona(req.usuario.id);
        res.json(tarjetas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las tarjetas', detalle: error.message });
    }
};

// POST /api/tarjetas/:id/compras — Registra un consumo (compra) con la tarjeta.
// No mueve saldo de ninguna cuenta: se acumula en saldo_consumido hasta que se pague el resumen.
exports.realizarCompra = async (req, res) => {
    const { id } = req.params;
    const monto = aMonto(req.body.monto);
    const descripcion = req.body.descripcion || 'Compra con tarjeta';

    if (!validarMonto(req.body.monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }

    try {
        const tarjeta = await Tarjeta.getTarjetaDetalle(id);
        if (!tarjeta) {
            return res.status(404).json({ error: 'No se encontro la tarjeta' });
        }
        if (tarjeta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta tarjeta' });
        }
        if (tarjeta.estado !== 'ACTIVO') {
            return res.status(409).json({ error: `Esta tarjeta esta ${tarjeta.estado.toLowerCase()}, no se pueden registrar compras` });
        }

        const actualizada = await Tarjeta.registrarConsumo(id, monto);
        if (!actualizada) {
            const disponible = Number(tarjeta.limite_compra) - Number(tarjeta.saldo_consumido);
            return res.status(400).json({ error: `Limite disponible insuficiente (disponible: $ ${disponible.toFixed(2)})` });
        }

        await Tarjeta.registrarMovimiento({
            id_tarjeta: id,
            tipo_movimiento: 'TARJETA_COMPRA',
            monto,
            descripcion
        });

        res.status(201).json({ mensaje: 'Compra registrada correctamente', tarjeta: actualizada });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo registrar la compra', detalle: error.message });
    }
};

// POST /api/tarjetas/:id/pagar-resumen — Paga (total o parcialmente) el saldo consumido,
// debitando de la caja de ahorro en ARS del titular.
exports.pagarResumen = async (req, res) => {
    const { id } = req.params;
    const monto = aMonto(req.body.monto);

    if (!validarMonto(req.body.monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }

    try {
        const tarjeta = await Tarjeta.getTarjetaDetalle(id);
        if (!tarjeta) {
            return res.status(404).json({ error: 'No se encontro la tarjeta' });
        }
        if (tarjeta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta tarjeta' });
        }
        if (Number(tarjeta.saldo_consumido) <= 0) {
            return res.status(409).json({ error: 'Esta tarjeta no tiene saldo pendiente para pagar' });
        }
        if (monto > Number(tarjeta.saldo_consumido)) {
            return res.status(400).json({ error: `El monto no puede superar el saldo del resumen ($ ${Number(tarjeta.saldo_consumido).toFixed(2)})` });
        }

        const cuenta = await Persona.getCuentaArsPorPersona(tarjeta.id_persona);
        const disponible = cuenta ? Number(cuenta.saldo) - Number(cuenta.reservado || 0) : 0;
        if (!cuenta || disponible < monto) {
            return res.status(400).json({ error: `Saldo disponible insuficiente en tu caja en ARS para pagar el resumen (disponible: $ ${disponible.toFixed(2)})` });
        }

        await Persona.descontarSaldo(cuenta.cbu, monto);
        const actualizada = await Tarjeta.registrarPagoResumen(id, monto);
        await Tarjeta.registrarMovimiento({
            id_tarjeta: id,
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'TARJETA_PAGO',
            monto,
            descripcion: 'Pago de resumen de tarjeta'
        });

        res.json({ mensaje: 'Pago registrado correctamente', tarjeta: actualizada });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo pagar el resumen', detalle: error.message });
    }
};

// GET /api/tarjetas/:id/movimientos — Historial de compras y pagos de una tarjeta propia
exports.obtenerMovimientos = async (req, res) => {
    const { id } = req.params;
    try {
        const tarjeta = await Tarjeta.getTarjetaDetalle(id);
        if (!tarjeta) {
            return res.status(404).json({ error: 'No se encontro la tarjeta' });
        }
        if (tarjeta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para ver esta tarjeta' });
        }
        const movimientos = await Tarjeta.getMovimientos(id);
        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los movimientos', detalle: error.message });
    }
};

// POST /api/tarjetas/:id/cerrar — Cierra la tarjeta (solo si no tiene saldo pendiente)
exports.cerrarTarjeta = async (req, res) => {
    const { id } = req.params;
    try {
        const tarjeta = await Tarjeta.getTarjetaDetalle(id);
        if (!tarjeta) {
            return res.status(404).json({ error: 'No se encontro la tarjeta' });
        }
        if (tarjeta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta tarjeta' });
        }
        if (tarjeta.estado === 'CERRADO') {
            return res.status(409).json({ error: 'Esta tarjeta ya esta cerrada' });
        }
        if (Number(tarjeta.saldo_consumido) > 0) {
            return res.status(409).json({ error: 'No se puede cerrar una tarjeta con saldo pendiente en el resumen' });
        }

        await Tarjeta.cerrarTarjeta(tarjeta.id_producto);
        res.json({ mensaje: 'Tarjeta cerrada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo cerrar la tarjeta', detalle: error.message });
    }
};
