// ============================================================
// controllers/bancoController.js — INFO DEL BANCO CENTRAL
// Acá están las funciones para consultar los bancos registrados
// en el sistema del Banco Central del profe.
// NO tiene lógica propia, solo redirige los pedidos a la API externa.
// ============================================================

// Cliente HTTP ya configurado con baseURL y headers (x-api-key, x-environment)
const centralBank = require('../services/centralBankClient');

// GET /api/bancos — Lista todos los bancos registrados en el sistema del profe
exports.listarBancos = async (req, res) => {
    try {
        const respuesta = await centralBank.get('/banks');
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        res.status(error.response?.status || 500).json({ error: 'No se pudo obtener la lista de bancos', detalle });
    }
};

// GET /api/bancos/:bankCode — Obtiene un banco por su código numérico
exports.obtenerBancoPorCodigo = async (req, res) => {
    const { bankCode } = req.params;
    try {
        const respuesta = await centralBank.get(`/banks/${bankCode}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo obtener el banco', detalle });
    }
};

// PUT /api/bancos/nombre — Cambia el nombre del banco en el Banco Central
exports.cambiarNombreBanco = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'El campo "name" es requerido' });
    }
    try {
        await centralBank.put('/banks/me', { name });
        res.json({ mensaje: `Nombre del banco actualizado a "${name}"` });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo cambiar el nombre del banco', detalle });
    }
};
