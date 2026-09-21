// ============================================================
// controllers/recargaController.js — RECARGA DE CELULAR
// Operación directa (sin el paso de "consultar factura" que tienen los
// servicios): se elige operador, número y una denominación fija, y se
// debita al toque de la caja de ahorro en ARS.
// ============================================================

const Recarga = require('../models/recargaModel');
const Persona = require('../models/personaModel');
const db = require('../config/db');
const { validarMonto, aMonto } = require('../utils/validaciones');

// Número de celular argentino sin el 0 ni el 15 (ej: 1123456789): 10 dígitos
const validarNumeroCelular = (numero) => /^\d{10}$/.test(String(numero || '').trim());

// GET /api/recargas/operadores — Catálogo para que el frontend arme el formulario
exports.listarOperadores = (req, res) => {
    res.json({
        operadores: Object.entries(Recarga.OPERADORES).map(([key, datos]) => ({ key, ...datos })),
        montos: Recarga.MONTOS_PERMITIDOS,
    });
};

// POST /api/recargas — Recarga el celular, debitando de la caja en ARS
exports.recargar = async (req, res) => {
    const operador = String(req.body.operador || '').toUpperCase();
    const numero_celular = String(req.body.numero_celular || '').trim();
    const monto = aMonto(req.body.monto);

    if (!Recarga.OPERADORES[operador]) {
        return res.status(400).json({ error: `El operador debe ser uno de: ${Object.keys(Recarga.OPERADORES).join(', ')}` });
    }
    if (!validarNumeroCelular(numero_celular)) {
        return res.status(400).json({ error: 'El número de celular debe tener 10 dígitos, sin 0 ni 15 (ej: 1123456789)' });
    }
    if (!validarMonto(req.body.monto) || !Recarga.MONTOS_PERMITIDOS.includes(monto)) {
        return res.status(400).json({ error: `El monto debe ser uno de: ${Recarga.MONTOS_PERMITIDOS.map((m) => '$' + m).join(', ')}` });
    }

    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontró una cuenta en ARS para hacer la recarga' });
        }

        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (disponible < monto) {
            return res.status(400).json({ error: `Disponible insuficiente para la recarga (disponible: $ ${disponible.toFixed(2)})` });
        }

        const { empresa } = Recarga.OPERADORES[operador];

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const saldo_posterior = await Persona.descontarSaldo(cuenta.cbu, monto, client);
            const id_movimiento = await Persona.registrarMovimiento({
                id_cuenta: cuenta.id_cuenta,
                tipo_movimiento: 'RECARGA_CELULAR',
                monto,
                descripcion: `Recarga ${empresa} · ${numero_celular}`,
            }, client);
            await Recarga.registrarRecarga({
                id_cuenta: cuenta.id_cuenta,
                id_movimiento,
                operador,
                numero_celular,
                monto,
                saldo_posterior,
            }, client);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.status(201).json({ mensaje: `Recarga de $ ${monto} a ${empresa} realizada correctamente` });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo procesar la recarga', detalle: error.message });
    }
};
