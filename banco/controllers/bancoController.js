const axios = require('axios');

const headers = () => ({
    'x-api-key': process.env.CENTRAL_BANK_API_KEY,
    'x-environment': process.env.X_ENVIRONMENT
});

// GET /api/bancos — Lista todos los bancos registrados en el sistema
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
