// ============================================================
// controllers/reservaController.js — RESERVAS DE PLATA DENTRO DE UNA CUENTA
// Una reserva no mueve el saldo real de la cuenta: solo aparta una parte para
// que no se cuente en el "disponible" (lo que de verdad se puede transferir,
// pagar cuotas/resumenes, comprar dolares, etc). Se libera cuando el usuario
// quiere volver a usar esa plata.
// ============================================================

const Persona = require('../models/personaModel');

// GET /api/cuentas/:cbu/reservas — Lista las reservas de una cuenta propia
exports.listarReservas = async (req, res) => {
    const { cbu } = req.params;
    try {
        const cuenta = await Persona.getByCbu(cbu);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta con ese CBU' });
        }
        if (cuenta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para ver las reservas de esta cuenta' });
        }

        const reservas = await Persona.getReservasPorCuenta(cuenta.id_cuenta);
        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        res.json({ saldo: cuenta.saldo, reservado: cuenta.reservado, disponible, reservas });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las reservas', detalle: error.message });
    }
};

// POST /api/cuentas/:cbu/reservas — Crea una reserva nueva ("Vacaciones", "Alquiler", etc.)
exports.crearReserva = async (req, res) => {
    const { cbu } = req.params;
    const nombre = (req.body.nombre || '').trim();
    const monto = Number(req.body.monto);

    if (!nombre || nombre.length < 2) {
        return res.status(400).json({ error: 'El nombre de la reserva debe tener al menos 2 caracteres' });
    }
    if (!monto || monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }

    try {
        const cuenta = await Persona.getByCbu(cbu);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta con ese CBU' });
        }
        if (cuenta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta cuenta' });
        }

        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (monto > disponible) {
            return res.status(400).json({ error: `No tenes suficiente disponible para reservar (disponible: $ ${disponible.toFixed(2)})` });
        }

        const reserva = await Persona.crearReserva({ id_cuenta: cuenta.id_cuenta, nombre, monto });
        res.status(201).json({ mensaje: 'Reserva creada correctamente', reserva });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo crear la reserva', detalle: error.message });
    }
};

// POST /api/reservas/:id/agregar — Suma mas plata a una reserva existente
exports.agregarMonto = async (req, res) => {
    const { id } = req.params;
    const monto = Number(req.body.monto);
    if (!monto || monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }

    try {
        const reserva = await Persona.getReservaDetalle(id);
        if (!reserva) {
            return res.status(404).json({ error: 'No se encontro la reserva' });
        }
        if (reserva.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta reserva' });
        }

        const cuenta = await Persona.getByCbu(reserva.cbu);
        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (monto > disponible) {
            return res.status(400).json({ error: `No tenes suficiente disponible (disponible: $ ${disponible.toFixed(2)})` });
        }

        const actualizada = await Persona.modificarMontoReserva(id, monto);
        res.json({ mensaje: 'Monto agregado correctamente', reserva: actualizada });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo agregar el monto', detalle: error.message });
    }
};

// POST /api/reservas/:id/liberar — Devuelve plata de la reserva al disponible (sin eliminarla)
exports.liberarMonto = async (req, res) => {
    const { id } = req.params;
    const monto = Number(req.body.monto);
    if (!monto || monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });
    }

    try {
        const reserva = await Persona.getReservaDetalle(id);
        if (!reserva) {
            return res.status(404).json({ error: 'No se encontro la reserva' });
        }
        if (reserva.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta reserva' });
        }

        const actualizada = await Persona.modificarMontoReserva(id, -monto);
        if (!actualizada) {
            return res.status(400).json({ error: `No podes liberar mas de lo que tiene la reserva ($ ${Number(reserva.monto).toFixed(2)})` });
        }
        res.json({ mensaje: 'Monto liberado correctamente', reserva: actualizada });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo liberar el monto', detalle: error.message });
    }
};

// DELETE /api/reservas/:id — Elimina la reserva por completo (libera toda la plata)
exports.eliminarReserva = async (req, res) => {
    const { id } = req.params;
    try {
        const reserva = await Persona.getReservaDetalle(id);
        if (!reserva) {
            return res.status(404).json({ error: 'No se encontro la reserva' });
        }
        if (reserva.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar sobre esta reserva' });
        }

        await Persona.eliminarReserva(id);
        res.json({ mensaje: 'Reserva eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar la reserva', detalle: error.message });
    }
};
