// ============================================================
// middleware/authMiddleware.js — GUARDIÁN DE RUTAS PROTEGIDAS
// Un middleware es una función que se ejecuta entre que llega el pedido
// y el controller. Si algo está mal, para el pedido y responde con error.
// Este middleware específicamente verifica que el usuario esté logueado.
// ============================================================

// jsonwebtoken es la librería para crear y verificar tokens JWT
const jwt = require('jsonwebtoken');

// verificarToken es la función que vamos a usar en las rutas protegidas
// Se llama así:  router.post('/ruta', verificarToken, controller.funcion)
//                                      ↑ este middleware se ejecuta primero
const verificarToken = (req, res, next) => {

    // El token viaja en el header "Authorization" del pedido HTTP
    // Formato esperado:  Authorization: Bearer eyJhbGci...
    const authHeader = req.headers['authorization'];

    // Si no hay header Authorization → el usuario no está logueado
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    // authHeader es "Bearer eyJhbGci..."
    // .split(' ')[1] separa por el espacio y toma el segundo elemento → solo el token
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Formato de token invalido. Usar: Bearer <token>' });
    }

    try {
        // jwt.verify hace dos cosas:
        // 1. Decodifica el token y extrae los datos del usuario (id, dni, nombre)
        // 2. Verifica que la firma sea válida usando JWT_SECRET del .env
        // Si el token fue modificado o venció → lanza un error
        const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);

        // Guardamos los datos del usuario en req.usuario
        // Así el controller puede saber quién está haciendo el pedido
        // Ejemplo: req.usuario.id → id de la persona logueada
        req.usuario = usuarioDecodificado;

        // next() significa "seguí al controller, todo está bien"
        next();
    } catch (error) {
        // Si el token expiró (8 horas) o fue alterado → rechazamos con 401
        return res.status(401).json({ error: 'Token invalido o expirado.' });
    }
};

module.exports = verificarToken;
