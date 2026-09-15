// ============================================================
// controllers/prestamoController.js — SOLICITUD Y PAGO DE PRESTAMOS
// Antes de aprobar un prestamo, se consulta la Central de Deudores del
// Banco Central: si la persona tiene mala situacion crediticia (informada
// por CUALQUIER banco del sistema, no solo el nuestro), se rechaza.
// ============================================================

const centralBank = require('../services/centralBankClient');
const Prestamo = require('../models/prestamoModel');
const Persona = require('../models/personaModel');
const db = require('../config/db');
const { validarMonto, aMonto } = require('../utils/validaciones');

const CUOTAS_VALIDAS = Object.keys(Prestamo.TASAS_POR_CUOTAS).map(Number); // [3, 6, 12, 24]
const SITUACION_LIMITE = 4; // 4 (riesgo alto) o 5 (irrecuperable) -> se rechaza

// Cuanto se le puede prestar a alguien depende de lo que esa persona
// efectivamente movió por el banco, no de un monto fijo igual para todos:
// PISO_PRESTAMO es lo minimo que se le presta a cualquiera (incluso a una
// cuenta recien abierta, sin ningun deposito todavia) y MULTIPLO_CAPACIDAD
// multiplica lo que depositó o recibió históricamente (ver
// Persona.getTotalIngresadoReal). Sin este limite, una cuenta con $2 podia
// pedir un prestamo de mil millones con solo pasar el chequeo de la Central
// de Deudores.
const PISO_PRESTAMO = 5000;
const MULTIPLO_CAPACIDAD = 3;

// Calcula cuanto se le puede prestar en total a una persona y cuanto le
// queda disponible hoy, descontando lo que ya debe de prestamos activos.
// Lo usan tanto GET /prestamos/limite (para mostrarlo antes de pedir) como
// solicitarPrestamo (para validar la solicitud).
const calcularLimite = async (id_persona, cuenta) => {
    const [capacidad, deudaActiva] = await Promise.all([
        Persona.getTotalIngresadoReal(cuenta.id_cuenta),
        Prestamo.getDeudaActivaTotal(id_persona),
    ]);
    const limitePrestable = PISO_PRESTAMO + capacidad * MULTIPLO_CAPACIDAD;
    const disponibleParaPedir = Math.max(0, limitePrestable - deudaActiva);
    return { limitePrestable, deudaActiva, disponibleParaPedir };
};

// GET /api/prestamos/limite — Cuanto puede pedir de prestamo el usuario logueado
// hoy, segun su movimiento real en el banco y lo que ya debe de otros prestamos
// activos. El frontend lo usa para mostrar el maximo antes de que arme la
// solicitud, y para bloquear el formulario si ya no le queda margen.
exports.obtenerLimite = async (req, res) => {
    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta en ARS para acreditar el prestamo' });
        }
        const { limitePrestable, deudaActiva, disponibleParaPedir } = await calcularLimite(req.usuario.id, cuenta);
        res.json({
            limite_prestable: limitePrestable,
            deuda_activa: deudaActiva,
            disponible_para_pedir: disponibleParaPedir,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo calcular el limite de prestamo', detalle: error.message });
    }
};

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

        const { tasa, monto_cuota, saldo_pendiente } = Prestamo.simular(monto, cuotas);

        // El prestamo que se esta pidiendo, SUMADO a lo que ya debe de otros prestamos
        // activos, no puede superar lo que la cuenta puede respaldar segun lo que
        // efectivamente ingreso (ver PISO_PRESTAMO/MULTIPLO_CAPACIDAD mas arriba).
        const deudaNueva = saldo_pendiente;
        const { limitePrestable, deudaActiva } = await calcularLimite(req.usuario.id, cuenta);
        if (deudaActiva + deudaNueva > limitePrestable) {
            const disponibleParaPedir = Math.max(0, limitePrestable - deudaActiva);
            return res.status(400).json({
                error: `Este prestamo (con intereses, $ ${deudaNueva.toFixed(2)}) supera lo que se te puede prestar según tu movimiento real en el banco. ` +
                    `Podés pedir hasta $ ${disponibleParaPedir.toFixed(2)} más (límite total: $ ${limitePrestable.toFixed(2)}, calculado sobre lo que depositaste o recibiste).`,
                limite_prestable: limitePrestable,
                deuda_activa: deudaActiva,
                disponible_para_pedir: disponibleParaPedir,
            });
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

        // Crear el prestamo y acreditar el monto van en UNA transaccion: sin esto,
        // si la acreditacion fallaba despues de que el prestamo ya quedara confirmado,
        // el cliente terminaba debiendo una plata que nunca llego a cobrar.
        const client = await db.connect();
        let prestamo;
        try {
            await client.query('BEGIN');

            prestamo = await Prestamo.crearPrestamo({
                id_persona: req.usuario.id,
                monto,
                tasa_interes: tasa,
                cuotas_totales: cuotas,
                monto_cuota,
                saldo_pendiente,
                situacion_al_otorgar: situacion
            }, client);

            // El dinero se acredita de inmediato en la cuenta en ARS del solicitante
            await Persona.acreditarSaldo(cuenta.cbu, monto, client);
            await Persona.registrarMovimiento({
                id_cuenta: cuenta.id_cuenta,
                tipo_movimiento: 'PRESTAMO_OTORGADO',
                monto,
                descripcion: `Prestamo otorgado en ${cuotas} cuotas`
            }, client);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

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

        // Cobrar la cuota y actualizar el prestamo (y cerrarlo si era la ultima) van en
        // una sola transaccion: sin esto, si el UPDATE del prestamo fallaba despues de
        // haber descontado el saldo, se le cobraba la cuota al cliente sin que quedara
        // reflejada en cuotas_pagadas/saldo_pendiente.
        const client = await db.connect();
        let actualizado;
        try {
            await client.query('BEGIN');

            await Persona.descontarSaldo(cuenta.cbu, prestamo.monto_cuota, client);
            await Persona.registrarMovimiento({
                id_cuenta: cuenta.id_cuenta,
                tipo_movimiento: 'PRESTAMO_CUOTA',
                monto: prestamo.monto_cuota,
                descripcion: `Cuota ${prestamo.cuotas_pagadas + 1}/${prestamo.cuotas_totales} del prestamo`
            }, client);

            actualizado = await Prestamo.registrarPagoCuota(id, prestamo.monto_cuota, client);

            // Si esta era la ultima cuota, el prestamo pasa a CERRADO
            if (actualizado.cuotas_pagadas >= actualizado.cuotas_totales) {
                await Persona.cambiarEstadoCuenta(prestamo.id_producto, 'CERRADO', client);
                actualizado.estado = 'CERRADO';
            } else {
                actualizado.estado = prestamo.estado;
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ mensaje: 'Cuota pagada correctamente', prestamo: actualizado });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo pagar la cuota', detalle: error.message });
    }
};
