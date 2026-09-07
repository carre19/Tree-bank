// ============================================================
// controllers/inversionController.js — COMPRA/VENTA DE ACCIONES
// Acciones argentinas: se operan en ARS contra la caja en ARS.
// Acciones extranjeras: se operan en USD contra la caja en USD (la misma
// que usa Cambio) — hace falta tenerla abierta antes de invertir afuera.
// El precio siempre lo fija el servidor (mercadoService), nunca el body
// del pedido: asi nadie puede comprar/vender a un precio inventado.
// ============================================================

const Persona = require('../models/personaModel');
const Inversion = require('../models/inversionModel');
const { obtenerCotizaciones, buscarSimbolo, obtenerHistorico } = require('../services/mercadoService');
const { validarEntero } = require('../utils/validaciones');

const MERCADOS_VALIDOS = ['ACCION_AR', 'ACCION_EX'];
const MONEDA_POR_MERCADO = { ACCION_AR: 'ARS', ACCION_EX: 'USD' };

// GET /api/inversiones/cotizaciones/:mercado — Precios en vivo de un panel completo
exports.obtenerCotizacionesPanel = async (req, res) => {
    const mercado = String(req.params.mercado || '').toUpperCase();
    if (!MERCADOS_VALIDOS.includes(mercado)) {
        return res.status(400).json({ error: `El mercado debe ser uno de: ${MERCADOS_VALIDOS.join(', ')}` });
    }
    try {
        const resultado = await obtenerCotizaciones(mercado);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener las cotizaciones', detalle: error.message });
    }
};

// GET /api/inversiones/historico/:mercado/:simbolo?rango=1M|3M|6M|1A|MAX
// Serie de precios de cierre para graficar. Argentinas: data912.com tiene
// historico propio. Extranjeras: data912 no lo tiene, se usa el chart API
// publico de Yahoo Finance (ver mercadoService.js).
exports.obtenerHistoricoSimbolo = async (req, res) => {
    const mercado = String(req.params.mercado || '').toUpperCase();
    const simbolo = String(req.params.simbolo || '').trim().toUpperCase();
    const rango = String(req.query.rango || '1A').toUpperCase();

    if (!MERCADOS_VALIDOS.includes(mercado)) {
        return res.status(400).json({ error: `El mercado debe ser uno de: ${MERCADOS_VALIDOS.join(', ')}` });
    }
    if (!simbolo) {
        return res.status(400).json({ error: 'Falta el simbolo' });
    }

    try {
        const puntos = await obtenerHistorico(mercado, simbolo, rango);
        res.json({ simbolo, mercado, rango, puntos });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener el historico', detalle: error.message });
    }
};

// GET /api/inversiones/tenencias — Cartera de acciones del usuario logueado
exports.obtenerTenencias = async (req, res) => {
    try {
        const tenencias = await Inversion.getTenencias(req.usuario.id);
        // Le sumamos la cotizacion actual a cada tenencia para que el front
        // pueda mostrar la ganancia/perdida sin pedir de nuevo el panel entero
        const conCotizacion = await Promise.all(tenencias.map(async (t) => {
            const cot = await buscarSimbolo(t.mercado, t.simbolo);
            return { ...t, precio_actual: cot?.precio ?? null };
        }));
        res.json(conCotizacion);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener tus tenencias', detalle: error.message });
    }
};

// POST /api/inversiones/comprar — { mercado, simbolo, cantidad }
exports.comprar = async (req, res) => {
    const mercado = String(req.body.mercado || '').toUpperCase();
    const simbolo = String(req.body.simbolo || '').trim().toUpperCase();
    const cantidad = Number(req.body.cantidad);

    if (!MERCADOS_VALIDOS.includes(mercado)) {
        return res.status(400).json({ error: `El mercado debe ser uno de: ${MERCADOS_VALIDOS.join(', ')}` });
    }
    if (!validarEntero(req.body.cantidad, { min: 1, max: 1000000 })) {
        return res.status(400).json({ error: 'La cantidad debe ser un numero entero mayor a 0' });
    }
    if (!simbolo) {
        return res.status(400).json({ error: 'Falta el simbolo a comprar' });
    }

    try {
        const cotizacion = await buscarSimbolo(mercado, simbolo);
        if (!cotizacion || !cotizacion.precio) {
            return res.status(404).json({ error: `No se encontro cotizacion para ${simbolo}. Puede que no cotice hoy.` });
        }

        const moneda = MONEDA_POR_MERCADO[mercado];
        const cuenta = moneda === 'ARS'
            ? await Persona.getCuentaArsPorPersona(req.usuario.id)
            : await Persona.getCuentaPorPersonaYMoneda(req.usuario.id, 'USD');

        if (!cuenta) {
            return res.status(404).json({
                error: moneda === 'ARS'
                    ? 'No se encontro tu cuenta en ARS'
                    : 'Todavia no tenes una caja en USD. Abrila primero desde el inicio.'
            });
        }

        const costoTotal = Number((cotizacion.precio * cantidad).toFixed(2));
        const disponible = Number(cuenta.saldo) - Number(cuenta.reservado || 0);
        if (disponible < costoTotal) {
            return res.status(400).json({
                error: `Disponible insuficiente en ${moneda}. Necesitas ${moneda} ${costoTotal.toFixed(2)} (disponible: ${moneda} ${disponible.toFixed(2)})`
            });
        }

        await Persona.descontarSaldo(cuenta.cbu, costoTotal);
        await Inversion.comprar({ id_persona: req.usuario.id, mercado, simbolo, cantidad, precio: cotizacion.precio, moneda });
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'COMPRA_ACCION',
            monto: costoTotal,
            descripcion: `Compra de ${cantidad} ${simbolo} a ${moneda} ${cotizacion.precio}`,
        });

        res.status(201).json({
            mensaje: `Compraste ${cantidad} ${simbolo} por ${moneda} ${costoTotal.toFixed(2)}`,
            simbolo, cantidad, precio: cotizacion.precio, costoTotal, moneda,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo realizar la compra', detalle: error.message });
    }
};

// POST /api/inversiones/vender — { mercado, simbolo, cantidad }
exports.vender = async (req, res) => {
    const mercado = String(req.body.mercado || '').toUpperCase();
    const simbolo = String(req.body.simbolo || '').trim().toUpperCase();

    if (!MERCADOS_VALIDOS.includes(mercado)) {
        return res.status(400).json({ error: `El mercado debe ser uno de: ${MERCADOS_VALIDOS.join(', ')}` });
    }
    if (!validarEntero(req.body.cantidad, { min: 1, max: 1000000 })) {
        return res.status(400).json({ error: 'La cantidad debe ser un numero entero mayor a 0' });
    }
    const cantidad = Number(req.body.cantidad);

    try {
        const tenencia = await Inversion.getTenencia(req.usuario.id, mercado, simbolo);
        if (!tenencia || Number(tenencia.cantidad) < cantidad) {
            return res.status(400).json({
                error: `No tenes suficientes ${simbolo} para vender (tenes ${tenencia ? tenencia.cantidad : 0})`
            });
        }

        const cotizacion = await buscarSimbolo(mercado, simbolo);
        if (!cotizacion || !cotizacion.precio) {
            return res.status(404).json({ error: `No se encontro cotizacion para ${simbolo}. Puede que no cotice hoy.` });
        }

        const moneda = MONEDA_POR_MERCADO[mercado];
        const cuenta = moneda === 'ARS'
            ? await Persona.getCuentaArsPorPersona(req.usuario.id)
            : await Persona.getCuentaPorPersonaYMoneda(req.usuario.id, 'USD');
        if (!cuenta) {
            return res.status(404).json({ error: `No se encontro tu cuenta en ${moneda}` });
        }

        const totalRecibido = Number((cotizacion.precio * cantidad).toFixed(2));

        await Inversion.vender({ id_persona: req.usuario.id, mercado, simbolo, cantidad });
        await Persona.acreditarSaldo(cuenta.cbu, totalRecibido);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'VENTA_ACCION',
            monto: totalRecibido,
            descripcion: `Venta de ${cantidad} ${simbolo} a ${moneda} ${cotizacion.precio}`,
        });

        res.status(201).json({
            mensaje: `Vendiste ${cantidad} ${simbolo} por ${moneda} ${totalRecibido.toFixed(2)}`,
            simbolo, cantidad, precio: cotizacion.precio, totalRecibido, moneda,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo realizar la venta', detalle: error.message });
    }
};
