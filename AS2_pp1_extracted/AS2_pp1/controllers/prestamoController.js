// ============================================================
// controllers/prestamoController.js — SOLICITUD Y PAGO DE PRESTAMOS
// Antes de aprobar un prestamo, se consulta la Central de Deudores del
// Banco Central: si la persona tiene mala situacion crediticia (informada
// por CUALQUIER banco del sistema, no solo el nuestro), se rechaza.
// ============================================================

const centralBank = require('../services/centralBankClient');
const Prestamo = require('../models/prestamoModel');
const Persona = require('../models/personaModel');
const { validarMonto, aMonto } = require('../utils/validaciones');

const CUOTAS_VALIDAS = Object.keys(Prestamo.TASAS_POR_CUOTAS).map(Number); // [3, 6, 12, 24]
const SITUACION_LIMITE = 4; // 4 (riesgo alto) o 5 (irrecuperable) -> se rechaza

// POST /api/prestamos — Solicita un prestamo (requiere estar logueado)
exports.solicitarPrestamo = async (req, res) => {
    const monto = aMonto(req.body.monto);
    const cuotas = Number(req.body.cuotas);

    if (!validarMonto(req.body.monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }
    if (!CUOTAS_VALIDAS.includes(cuotas)) {
        return res.status(400).json({ error: `El plazo debe ser uno de: ${CUOTAS_VALIDAS.join(', ')} cuotas` });
    }

    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta en ARS para acreditar el prestamo' });
        }

        // Consultamos la Central de Deudores ANTES de aprobar. Un 404 significa
        // que la persona no tiene deudas informadas por ningun banco: se trata
        // como situacion 1 (normal), no como un rechazo.
        let situacion = 1;
        try {
            const respuestaCentral = await centralBank.get(`/central-deudores/${cuenta.dni}`);
            situacion = respuestaCentral.data?.situacion ?? 1;
        } catch (error) {
            if (error.response?.status !== 404) {
                const detalle = error.response ? error.response.data : error.message;
                return res.status(502).json({ error: 'No se pudo consultar la Central de Deudores', detalle });
            }
        }

        if (situacion >= SITUACION_LIMITE) {
            return res.status(403).json({
                error: `Prestamo rechazado: la Central de Deudores informa situacion ${situacion} (riesgo alto/irrecuperable).`,
                situacion
            });
        }

        const { tasa, monto_cuota, saldo_pendiente } = Prestamo.simular(monto, cuotas);

        const prestamo = await Prestamo.crearPrestamo({
            id_persona: req.usuario.id,
            monto,
            tasa_interes: tasa,
            cuotas_totales: cuotas,
            monto_cuota,
            saldo_pendiente,
            situacion_al_otorgar: situacion
        });

        // El dinero se acredita de inmediato en la cuenta en ARS del solicitante
        await Persona.acreditarSaldo(cuenta.cbu, monto);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'PRESTAMO_OTORGADO',
            monto,
            descripcion: `Prestamo otorgado en ${cuotas} cuotas`
        });

        res.status(201).json({
            mensaje: 'Prestamo aprobado y acreditado en tu cuenta',
            situacion_al_otorgar: situacion,
            prestamo
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo procesar la solicitud', detalle: error.message });
    }
};

// GET /api/prestamos — Lista los prestamos del usuario logueado
exports.listarMisPrestamos = async (req, res) => {
    try {
        const prestamos = await Prestamo.getPrestamosByPersona(req.usuario.id);
        res.json(prestamos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los prestamos', detalle: error.message });
    }
};

// POST /api/prestamos/:id/pagar-cuota — Paga la siguiente cuota del prestamo
exports.pagarCuota = async (req, res) => {
    const { id } = req.params;

    try {
        const prestamo = await Prestamo.getPrestamoDetalle(id);
        if (!prestamo) {
            return res.status(404).json({ error: 'No se encontro el prestamo' });
        }
        if (prestamo.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre este prestamo' });
        }
        if (prestamo.estado !== 'ACTIVO') {
            return res.status(409).json({ error: `Este prestamo esta ${prestamo.estado.toLowerCase()}, no se le pueden pagar cuotas` });
        }
        if (prestamo.cuotas_pagadas >= prestamo.cuotas_totales) {
            return res.status(409).json({ error: 'Ya se pagaron todas las cuotas de este prestamo' });
        }

        const cuenta = await Persona.getCuentaArsPorPersona(prestamo.id_persona);
        const disponible = cuenta ? Number(cuenta.saldo) - Number(cuenta.reservado || 0) : 0;
        if (!cuenta || disponible < Number(prestamo.monto_cuota)) {
            return res.status(400).json({ error: `Saldo disponible insuficiente para pagar la cuota (disponible: $ ${disponible.toFixed(2)})` });
        }

        await Persona.descontarSaldo(cuenta.cbu, prestamo.monto_cuota);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'PRESTAMO_CUOTA',
            monto: prestamo.monto_cuota,
            descripcion: `Cuota ${prestamo.cuotas_pagadas + 1}/${prestamo.cuotas_totales} del prestamo`
        });

        const actualizado = await Prestamo.registrarPagoCuota(id, prestamo.monto_cuota);

        // Si esta era la ultima cuota, el prestamo pasa a CERRADO
        if (actualizado.cuotas_pagadas >= actualizado.cuotas_totales) {
            await Persona.cambiarEstadoCuenta(prestamo.id_producto, 'CERRADO');
            actualizado.estado = 'CERRADO';
        } else {
            actualizado.estado = prestamo.estado;
        }

        res.json({ mensaje: 'Cuota pagada correctamente', prestamo: actualizado });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo pagar la cuota', detalle: error.message });
    }
};
