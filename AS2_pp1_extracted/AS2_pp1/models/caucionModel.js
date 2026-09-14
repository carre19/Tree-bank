// ============================================================
// models/caucionModel.js — CAUCIONES COLOCADAS
// Una caucion bursatil real tiene una tasa que fluctua minuto a minuto en
// el mercado (BYMA la calcula en tiempo real via su indice de tasa de
// caucion), pero esa tasa NO tiene una API publica y gratuita como si la
// tienen las acciones: BYMA la vende como dato de mercado a las casas de
// bolsa. Por eso, igual que ya se hace con la tasa de los prestamos
// (TASAS_POR_CUOTAS en prestamoModel.js), se simula una tasa de referencia
// por plazo, del orden de las tasas reales de caucion en pesos.
//
// Las cauciones son un instrumento de rueda: solo se operan mientras el
// mercado esta abierto (dias habiles, 11 a 17hs Argentina). Fuera de ese
// horario la tasa es 0 y no se puede colocar ninguna, tal como en la vida
// real no hay caucion fuera de sesion.
// ============================================================

const db = require('../config/db');

// Todos los plazos que se pueden elegir: cada dia del 1 al 30, y despues
// saltos mas grandes hasta el año
const PLAZOS_VALIDOS = [
    ...Array.from({ length: 30 }, (_, i) => i + 1),
    40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300, 365,
];

// Curva de tasa nominal anual (%) segun el plazo: sube en forma logaritmica,
// arranca en 32% a 1 dia y llega a ~35% a los 30 dias (calibrada para eso),
// para despues seguir subiendo mas despacio hasta ~37% en el plazo mas largo
const TASA_BASE = 32;
const TASA_PENDIENTE = 3 / Math.log(30);
const tasaCurva = (dias) => Number((TASA_BASE + TASA_PENDIENTE * Math.log(dias)).toFixed(2));

// Horario de rueda de cauciones: dias habiles, 11:00 a 17:00 hora Argentina.
// Se calcula con Intl.DateTimeFormat contra esa zona horaria especifica para
// que no dependa de en que servidor/zona horaria este corriendo el backend.
const DIAS_HABILES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HORA_APERTURA = 11;
const HORA_CIERRE = 17;

const horarioArgentinaAhora = () => {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
    return { diaSemana: valor('weekday'), hora: Number(valor('hour')), minuto: Number(valor('minute')) };
};

const mercadoAbierto = () => {
    const { diaSemana, hora, minuto } = horarioArgentinaAhora();
    if (!DIAS_HABILES.includes(diaSemana)) return false;
    const minutosDelDia = hora * 60 + minuto;
    return minutosDelDia >= HORA_APERTURA * 60 && minutosDelDia < HORA_CIERRE * 60;
};

const Caucion = {

    PLAZOS_VALIDOS,
    tasaCurva,
    mercadoAbierto,
    HORA_APERTURA,
    HORA_CIERRE,

    // Interes simple: monto * tasa_anual/100 * plazo_dias/365.
    // Si el mercado esta cerrado la tasa es 0 (no se cobra ni se paga nada).
    simular: (monto, plazo_dias) => {
        const abierto = mercadoAbierto();
        const tasa_anual = abierto ? tasaCurva(plazo_dias) : 0;
        const interes = Number((monto * (tasa_anual / 100) * (plazo_dias / 365)).toFixed(2));
        const monto_a_cobrar = Number((monto + interes).toFixed(2));
        return { tasa_anual, interes, monto_a_cobrar, mercado_abierto: abierto };
    },

    crear: async ({ id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar }, client = db) => {
        const { rows } = await client.query(
            `INSERT INTO cauciones (id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar, fecha_vencimiento)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + make_interval(days => $4))
             RETURNING *`,
            [id_persona, id_cuenta, monto, plazo_dias, tasa_anual, monto_a_cobrar]
        );
        return rows[0];
    },

    getMisCauciones: async (id_persona) => {
        const { rows } = await db.query(
            `SELECT * FROM cauciones WHERE id_persona = $1 ORDER BY fecha_alta DESC`,
            [id_persona]
        );
        return rows;
    },

    // Cauciones ACTIVAS cuyo plazo ya se cumplio: candidatas a liquidar
    // (acreditar capital + interes y cerrar)
    getVencidas: async () => {
        const { rows } = await db.query(
            `SELECT * FROM cauciones WHERE estado = 'ACTIVA' AND fecha_vencimiento <= CURRENT_DATE`
        );
        return rows;
    },

    liquidar: async (id_caucion) => {
        const { rows } = await db.query(
            `UPDATE cauciones SET estado = 'LIQUIDADA' WHERE id_caucion = $1 AND estado = 'ACTIVA' RETURNING *`,
            [id_caucion]
        );
        return rows[0];
    },

};

module.exports = Caucion;
