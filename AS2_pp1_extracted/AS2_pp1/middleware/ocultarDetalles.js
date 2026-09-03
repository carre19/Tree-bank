// ============================================================
// middleware/ocultarDetalles.js — NO FILTRAR ERRORES INTERNOS
// Muchos controllers responden { error, detalle: error.message } cuando algo
// explota. En desarrollo eso es comodo, pero en produccion le muestra al
// cliente mensajes crudos de Postgres o del Banco Central: nombres de tablas,
// columnas, constraints y rutas internas. Todo eso le sirve a un atacante
// para mapear el sistema.
//
// En vez de tocar los ~40 lugares donde se arma esa respuesta, se intercepta
// res.json una sola vez y se limpia lo que sale, solo en respuestas 5xx
// (los 4xx llevan mensajes pensados para el usuario y se dejan intactos).
// ============================================================

const esProduccion = () => process.env.NODE_ENV === 'production';

const ocultarDetalles = (req, res, next) => {
    const jsonOriginal = res.json.bind(res);

    res.json = (cuerpo) => {
        if (esProduccion() && res.statusCode >= 500 && cuerpo && typeof cuerpo === 'object') {
            // El mensaje real queda en el log del servidor. No se manda al cliente:
            // en varios controllers el propio campo "error" ya es error.message crudo,
            // asi que tampoco se puede reenviar tal cual.
            console.error(`[${req.method} ${req.originalUrl}] error interno:`, {
                error: cuerpo.error,
                detalle: cuerpo.detalle
            });
            return jsonOriginal({ error: 'Error interno del servidor' });
        }
        return jsonOriginal(cuerpo);
    };

    next();
};

module.exports = { ocultarDetalles };
