const jwt = require('jsonwebtoken');

// Este middleware verifica que el request tenga un token JWT valido.
// Si no tiene token o es invalido, rechaza con 401.
// Si es valido, agrega el usuario al request para que el controller lo use.

const verificarToken = (req, res, next) => {
    // El token viene en el header: Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    const token = authHeader.split(' ')[1]; // Separamos "Bearer" del token

    if (!token) {
        return res.status(401).json({ error: 'Formato de token invalido. Usar: Bearer <token>' });
    }

    try {
        // jwt.verify decodifica y verifica la firma del token
        const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = usuarioDecodificado; // Lo adjuntamos al request
        next(); // Seguimos al controller
    } catch (error) {
        return res.status(401).json({ error: 'Token invalido o expirado.' });
    }
};

module.exports = verificarToken;
