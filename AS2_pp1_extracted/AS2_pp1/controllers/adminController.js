// ============================================================
// controllers/adminController.js — PANEL DE ADMINISTRADOR
// Solo lo pueden usar personas con el rol ADMIN (ver middleware verificarAdmin).
// Permite ver todas las cuentas del banco y cambiar su estado
// (bloquear, reactivar o cerrar una cuenta).
// ============================================================

const Persona = require('../models/personaModel');
const Prestamo = require('../models/prestamoModel');
const Tarjeta = require('../models/tarjetaModel');
const Seguro = require('../models/seguroModel');
const { reportarMora } = require('../services/moraService');

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

// GET /api/admin/prestamos - Lista todos los prestamos del banco
exports.listarPrestamos = async (req, res) => {
    try {
        const prestamos = await Prestamo.getAllPrestamosAdmin();
        res.json(prestamos);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar los prestamos', detalle: error.message });
    }
};

// PUT /api/admin/prestamos/:idPrestamo/mora - Marca un prestamo como en mora
// y lo informa a la Central de Deudores (situacion 4: riesgo alto de insolvencia).
// A partir de ahi, CUALQUIER banco del sistema va a ver esta deuda si consulta
// la situacion crediticia de esta persona (por ejemplo, al evaluar otro prestamo).
exports.marcarPrestamoEnMora = async (req, res) => {
    const { idPrestamo } = req.params;

    try {
        const prestamo = await Prestamo.getPrestamoDetalle(idPrestamo);
        if (!prestamo) {
            return res.status(404).json({ error: 'No se encontro el prestamo indicado' });
        }

        try {
            await reportarMora(prestamo);
        } catch (error) {
            if (error.codigo === 'ESTADO_INVALIDO') {
                return res.status(409).json({ error: error.message });
            }
            throw error;
        }

        res.json({
            mensaje: `Prestamo marcado en mora e informado a la Central de Deudores (situacion 4)`,
            id_prestamo: Number(idPrestamo),
            dni: prestamo.dni,
            saldo_pendiente: prestamo.saldo_pendiente
        });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        res.status(500).json({ error: 'No se pudo marcar el prestamo en mora', detalle });
    }
};

// GET /api/admin/tarjetas - Lista todas las tarjetas de credito del banco
exports.listarTarjetas = async (req, res) => {
    try {
        const tarjetas = await Tarjeta.getAllTarjetasAdmin();
        res.json(tarjetas);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar las tarjetas', detalle: error.message });
    }
};

// GET /api/admin/seguros - Lista todas las polizas del banco
exports.listarSeguros = async (req, res) => {
    try {
        const polizas = await Seguro.getAllPolizasAdmin();
        res.json(polizas);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar las polizas', detalle: error.message });
    }
};
