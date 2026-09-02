// ============================================================
// models/servicioModel.js — CATÁLOGO DE SERVICIOS (agua, luz, gas)
// A diferencia de tarjetas/seguros, pagar un servicio no crea un producto
// propio: es una operación puntual (como una compra o una transferencia),
// asi que no hace falta una tabla nueva. El "estado" de la factura (monto,
// vencimiento) se simula al vuelo, y lo unico que queda registrado es el
// movimiento en la cuenta, igual que cualquier otro pago.
// ============================================================

const crypto = require('crypto');

// Rango de monto simulado por servicio: alcanza para que la factura se
// sienta real sin necesitar un sistema de facturacion de verdad.
const TIPOS_SERVICIO = {
    AGUA: { empresa: 'Aguas del Plata',  label: 'Agua', montoMin: 2500,  montoMax: 6000 },
    LUZ:  { empresa: 'Edenor',           label: 'Luz',  montoMin: 5000,  montoMax: 14000 },
    GAS:  { empresa: 'Metrogas',         label: 'Gas',  montoMin: 3500,  montoMax: 9000 },
};

const Servicio = {

    TIPOS_SERVICIO,

    // Genera un monto de factura pseudo-aleatorio dentro del rango del servicio,
    // con dos decimales (como cualquier importe en pesos)
    generarMontoFactura: (tipo_servicio) => {
        const { montoMin, montoMax } = TIPOS_SERVICIO[tipo_servicio];
        const centavos = crypto.randomInt(montoMin * 100, montoMax * 100 + 1);
        return Math.round(centavos) / 100;
    },

    // Valida que un monto (el que el usuario esta por pagar) sea compatible con
    // el rango del servicio, para no confiar ciegamente en lo que llega del front
    montoEnRango: (tipo_servicio, monto) => {
        const { montoMin, montoMax } = TIPOS_SERVICIO[tipo_servicio];
        return monto >= montoMin && monto <= montoMax;
    },

};

module.exports = Servicio;
