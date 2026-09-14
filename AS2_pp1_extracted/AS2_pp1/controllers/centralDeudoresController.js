// ============================================================
// controllers/centralDeudoresController.js — CENTRAL DE DEUDORES
// Informa y consulta la situación crediticia de un DNI en el sistema
// del Banco Central del profe. No tiene lógica propia ni tabla local:
// cada banco informa sus propias deudas y la consulta junta lo que
// informó cada uno, todo vive del lado del Banco Central.
// ============================================================

// Cliente HTTP ya configurado con baseURL y headers (x-api-key, x-environment)
const centralBank = require('../services/centralBankClient');

// Mismo validador de monto que usa el resto del backend (ver utils/validaciones.js):
// antes este archivo tenia su propia version con parseFloat, que dejaba pasar
// "100abc" (parseFloat lo lee como 100) e Infinity/"1e400" como validos, y ese
// valor sin sanitizar se reenviaba tal cual al Banco Central.
const { validarMonto: validarMontoCompartido, aMonto } = require('../utils/validaciones');

// Verifica que el DNI tenga entre 7 y 8 dígitos numéricos
const validarDni = (dni) => /^\d{7,8}$/.test(String(dni));

// Verifica que la situación crediticia sea un entero entre 1 y 5
const validarSituacion = (situacion) => Number.isInteger(situacion) && situacion >= 1 && situacion <= 5;

// Acá el monto puede ser 0 (una deuda ya saldada), a diferencia del resto de
// los endpoints donde 0 no tiene sentido — por eso incluirMinimo: true.
const validarMonto = (monto) => validarMontoCompartido(monto, { minimo: 0, incluirMinimo: true });

// POST /api/central-deudores — Informa (o actualiza) la deuda de un titular con este banco
// Requiere estar logueado como ADMIN: es una operación de back-office, no del cliente final.
exports.informarDeuda = async (req, res) => {
    const { dni, monto, situacion } = req.body;

    if (dni === undefined || monto === undefined || situacion === undefined) {
        return res.status(400).json({ error: 'Los campos dni, monto y situacion son requeridos' });
    }
    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }
    if (!validarMonto(monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero mayor o igual a 0' });
    }
    if (!validarSituacion(situacion)) {
        return res.status(400).json({ error: 'La situacion debe ser un numero entero entre 1 y 5' });
    }

    // A partir de aca se trabaja con el numero ya normalizado, nunca con el
    // valor crudo del body: evita reenviar algo como "100abc" al Banco Central
    const montoNum = aMonto(monto);

    try {
        const respuestaCentral = await centralBank.post('/central-deudores', { dni, monto: montoNum, situacion });
        const mensaje = respuestaCentral.status === 201
            ? 'Deuda informada por primera vez'
            : 'Deuda actualizada correctamente';
        res.status(respuestaCentral.status).json({ mensaje, dni, monto: montoNum, situacion, datos: respuestaCentral.data });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo informar la deuda', detalle });
    }
};

// GET /api/central-deudores/:dni — Consulta la situación crediticia de un titular
// (peor situación entre todas las entidades que informaron, con el detalle de cada una)
exports.consultarSituacion = async (req, res) => {
    const { dni } = req.params;

    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }

    try {
        const respuesta = await centralBank.get(`/central-deudores/${dni}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo obtener la situacion crediticia', detalle });
    }
};
