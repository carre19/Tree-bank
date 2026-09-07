// ============================================================
// services/notificacionService.js — AVISOS DE REPORTES NUEVOS
// El proyecto no tiene un servicio de correo configurado (ver el comentario
// en authController.js sobre olvide-password), asi que en vez de eso se
// admite un webhook generico: si REPORTES_WEBHOOK_URL esta seteada en el
// .env, cada reporte nuevo le manda un aviso (compatible con Discord y
// Slack, que aceptan un POST con {content} o {text} respectivamente).
//
// Sin esa variable configurada, no hace nada: el reporte se guarda igual
// en la base y el equipo lo ve entrando al panel de administrador.
// ============================================================

const axios = require('axios');

const avisarReporteNuevo = async (reporte) => {
    const url = process.env.REPORTES_WEBHOOK_URL;
    if (!url) return;

    const texto = `⚠️ Nuevo reporte en Tree Bank (#${reporte.id})\n` +
        `Página: ${reporte.pagina || 'sin especificar'}\n` +
        `${reporte.descripcion}`;

    try {
        // Se manda { content, text } a la vez para no tener que saber de
        // antemano si el webhook es de Discord o de Slack
        await axios.post(url, { content: texto, text: texto }, { timeout: 5000 });
    } catch (error) {
        // Un webhook caido no puede tumbar el guardado del reporte: solo se loguea
        console.error('No se pudo avisar el reporte por webhook:', error.message);
    }
};

module.exports = { avisarReporteNuevo };
