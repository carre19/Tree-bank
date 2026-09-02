// ============================================================
// controllers/servicioController.js — PAGO DE SERVICIOS (agua, luz, gas)
// Flujo en dos pasos, como comprar/vender dolares: primero se "consulta"
// la factura (se simula un monto y un vencimiento), despues se paga esa
// factura puntual desde la caja de ahorro en ARS. No hay un producto ni
// una suscripcion: cada pago es una operacion independiente.
// ============================================================

const Servicio = require('../models/servicioModel');
const Persona = require('../models/personaModel');

// POST /api/servicios/consultar-factura — Simula la factura de un servicio
exports.consultarFactura = async (req, res) => {
    const tipo_servicio = (req.body.tipo_servicio || '').toUpperCase();
    const numero_cliente = (req.body.numero_cliente || '').trim();

    if (!Servicio.TIPOS_SERVICIO[tipo_servicio]) {
        return res.status(400).json({ error: `El servicio debe ser uno de: ${Object.keys(Servicio.TIPOS_SERVICIO).join(', ')}` });
    }
    if (numero_cliente.length < 3) {
        return res.status(400).json({ error: 'Ingresá tu número de cliente (mínimo 3 caracteres)' });
    }

    const { empresa } = Servicio.TIPOS_SERVICIO[tipo_servicio];
    const monto = Servicio.generarMontoFactura(tipo_servicio);
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 10);

    res.json({ tipo_servicio, empresa, numero_cliente, monto, vencimiento });
};

// POST /api/servicios/pagar — Paga la factura consultada, debitando de la caja en ARS
exports.pagarServicio = async (req, res) => {
    const tipo_servicio = (req.body.tipo_servicio || '').toUpperCase();
    const numero_cliente = (req.body.numero_cliente || '').trim();
    const monto = Number(req.body.monto);

    if (!Servicio.TIPOS_SERVICIO[tipo_servicio]) {
        return res.status(400).json({ error: `El servicio debe ser uno de: ${Object.keys(Servicio.TIPOS_SERVICIO).join(', ')}` });
    }
    if (numero_cliente.length < 3) {
        return res.status(400).json({ error: 'Falta el número de cliente' });
    }
    if (!monto || monto <= 0 || !Servicio.montoEnRango(tipo_servicio, monto)) {
        return res.status(400).json({ error: 'El monto de la factura no es válido. Volvé a consultarla e intentá de nuevo.' });
    }

    try {
        const cuenta = await Persona.getCuentaArsPorPersona(req.usuario.id);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontró una cuenta en ARS para pagar el servicio' });
        }

        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (disponible < monto) {
            return res.status(400).json({ error: `Disponible insuficiente para pagar la factura (disponible: $ ${disponible.toFixed(2)})` });
        }

        const { empresa, label } = Servicio.TIPOS_SERVICIO[tipo_servicio];

        await Persona.descontarSaldo(cuenta.cbu, monto);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'SERVICIO_PAGO',
            monto,
            descripcion: `Pago de ${label.toLowerCase()}: ${empresa} · Cliente ${numero_cliente}`
        });

        res.status(201).json({ mensaje: `Pago de ${label.toLowerCase()} realizado correctamente` });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo pagar el servicio', detalle: error.message });
    }
};
