// ============================================================
// controllers/cuentaController.js — CAJAS DE AHORRO (ARS / USD)
// Abre y consulta cajas de ahorro en el Banco Central del profe.
// La caja en ARS ya existe desde POST /persons (ver personaController):
// pedirla acá solo devuelve el CBU que ya tiene. La caja en USD (o
// cualquier moneda distinta de ARS) sí se crea acá, con su propio
// CBU y alias, y requiere un producto + cuenta local nuevos porque
// Cuentas_Bancarias tiene un producto por cuenta (una persona con
// ARS y USD tiene dos productos CAJA_AHORRO).
// ============================================================

// Cliente HTTP ya configurado con baseURL y headers (x-api-key, x-environment)
const centralBank = require('../services/centralBankClient');

const Persona = require('../models/personaModel');

const MONEDAS_VALIDAS = ['ARS', 'USD'];

// Verifica que el DNI tenga entre 7 y 8 dígitos numéricos
const validarDni = (dni) => /^\d{7,8}$/.test(String(dni));

// POST /api/cuentas — Abre (o recupera) una caja de ahorro en la moneda pedida, PARA EL
// USUARIO LOGUEADO. El DNI sale del token JWT (no del body): así nadie puede abrir
// o consultar una caja en nombre de otra persona.
exports.abrirCuenta = async (req, res) => {
    const dni = req.usuario.dni;
    const { moneda } = req.body;

    if (!dni || !moneda) {
        return res.status(400).json({ error: 'El campo moneda es requerido' });
    }
    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }
    if (!MONEDAS_VALIDAS.includes(moneda)) {
        return res.status(400).json({ error: `La moneda debe ser una de: ${MONEDAS_VALIDAS.join(', ')}` });
    }

    try {
        const respuestaCentral = await centralBank.post('/accounts', { dni, moneda });
        const { cbu, alias } = respuestaCentral.data || {};
        const creada = respuestaCentral.status === 201;

        // ARS: la caja ya existia desde que se registro la persona, no hay nada que crear localmente
        if (moneda === 'ARS') {
            return res.status(respuestaCentral.status).json({
                mensaje: 'La cuenta en ARS ya existe',
                cbu, alias, moneda, datos: respuestaCentral.data
            });
        }

        // Monedas distintas de ARS: sincronizamos (o creamos) la cuenta local
        const persona = await Persona.getPersonaByDni(dni);
        if (!persona) {
            // El Banco Central la reconoce pero no tenemos a esa persona en la BD local:
            // devolvemos igual los datos del Banco Central, sin poder persistir localmente
            return res.status(respuestaCentral.status).json({
                mensaje: creada ? 'Cuenta creada en el Banco Central' : 'La cuenta ya existia en el Banco Central',
                cbu, alias, moneda, datos: respuestaCentral.data
            });
        }

        const cuentaLocal = await Persona.getCuentaPorPersonaYMoneda(persona.id, moneda);
        if (cuentaLocal) {
            return res.status(respuestaCentral.status).json({
                mensaje: 'La cuenta ya existia. Datos sincronizados.',
                cbu: cuentaLocal.cbu, alias: cuentaLocal.alias, moneda, datos: cuentaLocal
            });
        }

        const nuevaCuenta = await Persona.crearCuentaEnMoneda({ id_persona: persona.id, moneda, cbu, alias });
        return res.status(respuestaCentral.status).json({
            mensaje: creada ? 'Cuenta creada con exito' : 'Cuenta recuperada del Banco Central y sincronizada en BD local.',
            cbu, alias, moneda, datos: nuevaCuenta
        });

    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo abrir la cuenta', detalle });
    }
};

// GET /api/cuentas/:cbu — Busca una cuenta (moneda distinta de ARS) por CBU
exports.buscarPorCbu = async (req, res) => {
    const { cbu } = req.params;
    try {
        const respuesta = await centralBank.get(`/accounts/${cbu}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se encontro la cuenta', detalle });
    }
};

// PUT /api/cuentas/:cbu/alias — Asigna o cambia el alias de una cuenta (requiere ser el dueno)
exports.asignarAlias = async (req, res) => {
    const { cbu } = req.params;
    const { alias } = req.body;
    if (!alias || alias.trim().length < 3) {
        return res.status(400).json({ error: 'El alias debe tener al menos 3 caracteres' });
    }
    try {
        const cuenta = await Persona.getByCbu(cbu);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta con ese CBU' });
        }
        if (cuenta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para modificar el alias de esta cuenta' });
        }

        await centralBank.put(`/accounts/${cbu}/alias`, { alias });
        await Persona.actualizarAlias(cbu, alias);
        res.json({ mensaje: 'Alias actualizado correctamente', cbu, alias });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo actualizar el alias', detalle });
    }
};

// GET /api/cuentas/alias/:alias — Busca una cuenta por alias
exports.buscarPorAlias = async (req, res) => {
    const { alias } = req.params;
    try {
        const respuesta = await centralBank.get(`/accounts/alias/${alias}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se encontro el alias', detalle });
    }
};
