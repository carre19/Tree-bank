// ============================================================
// controllers/bancoController.js — INFO DEL BANCO CENTRAL
// Acá están las funciones para consultar los bancos registrados
// en el sistema del Banco Central del profe.
// NO tiene lógica propia, solo redirige los pedidos a la API externa.
// ============================================================

// axios es el cliente HTTP para hacer pedidos a la API del Banco Central
const axios = require('axios');

// headers() es una función que devuelve los encabezados que requiere la API del profe
// x-api-key: es la clave de autenticación de tu banco
// x-environment: "test" para modo de prueba (no mueve plata real)
const headers = () => ({
    'x-api-key': process.env.CENTRAL_BANK_API_KEY,
    'x-environment': process.env.X_ENVIRONMENT
});

// GET /api/bancos — Lista todos los bancos registrados en el sistema del profe
exports.listarBancos = async (req, res) => {
    try {
        const respuesta = await axios.get(`${process.env.CENTRAL_BANK_URL}/banks`, {
            headers: headers()
        });
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
        const respuesta = await axios.get(`${process.env.CENTRAL_BANK_URL}/banks/${bankCode}`, {
            headers: headers()
        });
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
        await axios.put(`${process.env.CENTRAL_BANK_URL}/banks/me`, { name }, {
            headers: headers()
        });
        res.json({ mensaje: `Nombre del banco actualizado a "${name}"` });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo cambiar el nombre del banco', detalle });
    }
};
