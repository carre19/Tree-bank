// ============================================================
// controllers/cambioController.js — COMPRA Y VENTA DE DÓLARES
// Cambia plata entre la caja en ARS y la caja en USD de la MISMA persona,
// a la cotizacion oficial del dolar (ver cotizacionService). No involucra
// al Banco Central del profe: es una operacion 100% interna del banco.
// ============================================================

const Persona = require('../models/personaModel');
const { obtenerCotizacionOficial } = require('../services/cotizacionService');

// GET /api/cambio/cotizacion — Cotizacion del dolar oficial vigente
exports.obtenerCotizacion = async (req, res) => {
    try {
        const cotizacion = await obtenerCotizacionOficial();
        res.json(cotizacion);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener la cotizacion', detalle: error.message });
    }
};

// POST /api/cambio — Compra o vende dolares para el usuario logueado
// operacion: 'COMPRA' (el cliente compra USD pagando en ARS) o 'VENTA' (el cliente
// vende USD y recibe ARS). "monto" siempre se expresa en USD.
exports.realizarCambio = async (req, res) => {
    const { operacion } = req.body;
    const montoUsd = Number(req.body.monto);

    if (!['COMPRA', 'VENTA'].includes(operacion)) {
        return res.status(400).json({ error: 'La operacion debe ser COMPRA o VENTA' });
    }
    if (!montoUsd || montoUsd <= 0) {
        return res.status(400).json({ error: 'El monto en USD debe ser un numero mayor a 0' });
    }

    try {
        const { compra, venta } = await obtenerCotizacionOficial();
        const cuentaArs = await Persona.getCuentaArsPorPersona(req.usuario.id);
        const cuentaUsd = await Persona.getCuentaPorPersonaYMoneda(req.usuario.id, 'USD');

        if (!cuentaArs) {
            return res.status(404).json({ error: 'No se encontro tu cuenta en ARS' });
        }
        if (!cuentaUsd) {
            return res.status(404).json({ error: 'Todavia no tenes una caja en USD. Abrila primero desde el inicio.' });
        }

        if (operacion === 'COMPRA') {
            // El cliente compra dolares: paga en ARS a la cotizacion de venta del banco
            const costoArs = Number((montoUsd * venta).toFixed(2));
            const disponibleArs = Number(cuentaArs.saldo) - Number(cuentaArs.reservado || 0);
            if (disponibleArs < costoArs) {
                return res.status(400).json({ error: `Saldo disponible insuficiente en ARS. Necesitas $ ${costoArs.toFixed(2)} (disponible: $ ${disponibleArs.toFixed(2)})` });
            }

            await Persona.descontarSaldo(cuentaArs.cbu, costoArs);
            await Persona.acreditarSaldo(cuentaUsd.cbu, montoUsd);
            await Persona.registrarMovimiento({
                id_cuenta: cuentaArs.id_cuenta, tipo_movimiento: 'CAMBIO_EGRESO',
                monto: costoArs, descripcion: `Compra de USD ${montoUsd} a $${venta}`
            });
            await Persona.registrarMovimiento({
                id_cuenta: cuentaUsd.id_cuenta, tipo_movimiento: 'CAMBIO_INGRESO',
                monto: montoUsd, descripcion: `Compra de USD a $${venta}`
            });

            return res.status(201).json({
                mensaje: `Compraste USD ${montoUsd} por $ ${costoArs.toFixed(2)}`,
                cotizacion: venta, montoArs: costoArs, montoUsd
            });
        }

        // VENTA: el cliente vende dolares: recibe ARS a la cotizacion de compra del banco
        const disponibleUsd = Number(cuentaUsd.saldo) - Number(cuentaUsd.reservado || 0);
        if (disponibleUsd < montoUsd) {
            return res.status(400).json({ error: `Saldo disponible insuficiente en USD (disponible: U$S ${disponibleUsd.toFixed(2)})` });
        }
        const recibeArs = Number((montoUsd * compra).toFixed(2));

        await Persona.descontarSaldo(cuentaUsd.cbu, montoUsd);
        await Persona.acreditarSaldo(cuentaArs.cbu, recibeArs);
        await Persona.registrarMovimiento({
            id_cuenta: cuentaUsd.id_cuenta, tipo_movimiento: 'CAMBIO_EGRESO',
            monto: montoUsd, descripcion: `Venta de USD a $${compra}`
        });
        await Persona.registrarMovimiento({
            id_cuenta: cuentaArs.id_cuenta, tipo_movimiento: 'CAMBIO_INGRESO',
            monto: recibeArs, descripcion: `Venta de USD ${montoUsd} a $${compra}`
        });

        return res.status(201).json({
            mensaje: `Vendiste USD ${montoUsd} por $ ${recibeArs.toFixed(2)}`,
            cotizacion: compra, montoArs: recibeArs, montoUsd
        });

    } catch (error) {
        res.status(500).json({ error: 'No se pudo realizar la operacion', detalle: error.message });
    }
};
