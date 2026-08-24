// ============================================================
// services/moraService.js — REPORTE DE MORA A LA CENTRAL DE DEUDORES
// Logica compartida entre el boton manual del admin (adminController) y el
// chequeo automatico diario (ver app.js) que busca prestamos vencidos hace
// mas de X dias y los reporta solo.
// ============================================================

const centralBank = require('./centralBankClient');
const Persona = require('../models/personaModel');
const Prestamo = require('../models/prestamoModel');

const DIAS_GRACIA_MORA_AUTOMATICA = 10;

// Reporta un prestamo puntual a la Central de Deudores (situacion 4: riesgo alto)
// y bloquea la cuenta/producto asociado. Lanza si el prestamo no esta ACTIVO.
const reportarMora = async (prestamo) => {
    if (prestamo.estado !== 'ACTIVO') {
        const err = new Error(`Este prestamo ya esta ${prestamo.estado.toLowerCase()}`);
        err.codigo = 'ESTADO_INVALIDO';
        throw err;
    }

    await centralBank.post('/central-deudores', {
        dni: prestamo.dni,
        monto: prestamo.saldo_pendiente,
        situacion: 4
    });

    await Persona.cambiarEstadoCuenta(prestamo.id_producto, 'BLOQUEADO');
};

// Busca prestamos vencidos hace mas de DIAS_GRACIA_MORA_AUTOMATICA dias y los
// reporta uno por uno. Un fallo en un prestamo no interrumpe a los demas.
const ejecutarVerificacionMoraAutomatica = async () => {
    const vencidos = await Prestamo.getPrestamosVencidos(DIAS_GRACIA_MORA_AUTOMATICA);
    let reportados = 0;
    for (const prestamo of vencidos) {
        try {
            await reportarMora({ ...prestamo, estado: 'ACTIVO' });
            reportados++;
            console.log(`⚠️  Prestamo #${prestamo.id_prestamo} (DNI ${prestamo.dni}) reportado en mora automaticamente`);
        } catch (error) {
            const detalle = error.response ? error.response.data : error.message;
            console.error(`No se pudo reportar en mora el prestamo #${prestamo.id_prestamo}:`, detalle);
        }
    }
    return { candidatos: vencidos.length, reportados };
};

module.exports = { reportarMora, ejecutarVerificacionMoraAutomatica, DIAS_GRACIA_MORA_AUTOMATICA };
