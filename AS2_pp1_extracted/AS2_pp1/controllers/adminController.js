// ============================================================
// controllers/adminController.js — PANEL DE ADMINISTRADOR
// Solo lo pueden usar personas con el rol ADMIN (ver middleware verificarAdmin).
// Permite ver todas las cuentas del banco y cambiar su estado
// (bloquear, reactivar o cerrar una cuenta).
// ============================================================

const Persona = require('../models/personaModel');

const ESTADOS_VALIDOS = ['ACTIVO', 'BLOQUEADO', 'CERRADO'];

// GET /api/admin/cuentas - Lista todas las cuentas del banco con su dueno
exports.listarCuentas = async (req, res) => {
    try {
        const cuentas = await Persona.getAllCuentasAdmin();
        res.json(cuentas);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar las cuentas', detalle: error.message });
    }
};

// PUT /api/admin/cuentas/:idProducto/estado - Bloquea, reactiva o cierra una cuenta
exports.cambiarEstadoCuenta = async (req, res) => {
    const { idProducto } = req.params;
    const { estado } = req.body;

    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` });
    }

    try {
        const actualizado = await Persona.cambiarEstadoCuenta(idProducto, estado);
        if (!actualizado) {
            return res.status(404).json({ error: 'No se encontro la cuenta indicada' });
        }
        res.json({ mensaje: `Cuenta actualizada a estado ${estado}`, id_producto: actualizado.id_producto, estado });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar el estado de la cuenta', detalle: error.message });
    }
};

// DELETE /api/admin/cuentas/:idProducto - Elimina una cuenta para siempre (cuenta + movimientos)
// Solo se permite si no tiene saldo pendiente ni tarjetas de credito activas (prestamos pendientes)
exports.eliminarCuenta = async (req, res) => {
    const { idProducto } = req.params;

    try {
        const info = await Persona.getCuentaParaCierre(idProducto);
        if (!info) {
            return res.status(404).json({ error: 'No se encontro la cuenta indicada' });
        }

        if (Number(info.saldo) !== 0) {
            return res.status(409).json({
                error: `La cuenta todavia tiene saldo ($ ${info.saldo}). Hay que vaciarla (transferencia o retiro) antes de eliminarla definitivamente.`
            });
        }

        if (info.tiene_prestamo_pendiente) {
            return res.status(409).json({
                error: 'La persona tiene una tarjeta de credito activa (prestamo pendiente). No se puede eliminar la cuenta hasta que se cierre o salde esa deuda.'
            });
        }

        const eliminado = await Persona.eliminarCuentaDefinitivo(idProducto);
        if (!eliminado) {
            return res.status(404).json({ error: 'No se encontro la cuenta indicada' });
        }

        res.json({ mensaje: 'Cuenta eliminada definitivamente', id_producto: Number(idProducto) });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la cuenta', detalle: error.message });
    }
};
