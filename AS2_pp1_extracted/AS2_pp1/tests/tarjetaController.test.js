// Prueba la emision de tarjetas (gate contra la Central de Deudores, igual que
// prestamos) y las operaciones basicas: comprar (consumir limite) y pagar el resumen.

const express = require('express');
const request = require('supertest');

jest.mock('../models/tarjetaModel');
jest.mock('../models/personaModel');
jest.mock('../services/centralBankClient', () => ({ get: jest.fn() }));

const Tarjeta = require('../models/tarjetaModel');
const Persona = require('../models/personaModel');
const centralBank = require('../services/centralBankClient');
const tarjetaController = require('../controllers/tarjetaController');

Tarjeta.MARCAS_VALIDAS = ['VISA', 'MASTERCARD'];

const construirApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.usuario = { id: 5, dni: '30111222' }; next(); });
    app.post('/tarjetas', tarjetaController.emitirTarjeta);
    app.post('/tarjetas/:id/compras', tarjetaController.realizarCompra);
    app.post('/tarjetas/:id/pagar-resumen', tarjetaController.pagarResumen);
    app.post('/tarjetas/:id/cerrar', tarjetaController.cerrarTarjeta);
    return app;
};

describe('POST /tarjetas — emitirTarjeta', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza una marca invalida con 400', async () => {
        const res = await request(app).post('/tarjetas').send({ marca: 'AMEX' });
        expect(res.status).toBe(400);
    });

    test('un 404 de la Central de Deudores se trata como situacion normal y se aprueba', async () => {
        centralBank.get.mockRejectedValue({ response: { status: 404 } });
        Tarjeta.crearTarjeta.mockResolvedValue({ id_tarjeta: 1, numero_tarjeta: '4556000000000000', limite_compra: 300000 });

        const res = await request(app).post('/tarjetas').send({});
        expect(res.status).toBe(201);
        expect(Tarjeta.crearTarjeta).toHaveBeenCalledWith({ id_persona: 5, marca: 'VISA', situacion_al_otorgar: 1 });
    });

    test('situacion 4 rechaza la emision con 403', async () => {
        centralBank.get.mockResolvedValue({ data: { situacion: 4 } });
        const res = await request(app).post('/tarjetas').send({});
        expect(res.status).toBe(403);
        expect(Tarjeta.crearTarjeta).not.toHaveBeenCalled();
    });
});

describe('POST /tarjetas/:id/compras — realizarCompra', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza un monto invalido con 400', async () => {
        const res = await request(app).post('/tarjetas/1/compras').send({ monto: 0 });
        expect(res.status).toBe(400);
    });

    test('rechaza si la tarjeta no es del usuario logueado (403)', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 999, estado: 'ACTIVO' });
        const res = await request(app).post('/tarjetas/1/compras').send({ monto: 100 });
        expect(res.status).toBe(403);
        expect(Tarjeta.registrarConsumo).not.toHaveBeenCalled();
    });

    test('rechaza la compra si supera el limite disponible (400)', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, estado: 'ACTIVO', limite_compra: 1000, saldo_consumido: 900 });
        Tarjeta.registrarConsumo.mockResolvedValue(undefined); // el UPDATE no matcheo ninguna fila

        const res = await request(app).post('/tarjetas/1/compras').send({ monto: 500 });
        expect(res.status).toBe(400);
        expect(Tarjeta.registrarMovimiento).not.toHaveBeenCalled();
    });

    test('registra la compra correctamente dentro del limite', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, estado: 'ACTIVO', limite_compra: 1000, saldo_consumido: 100 });
        Tarjeta.registrarConsumo.mockResolvedValue({ saldo_consumido: 300 });

        const res = await request(app).post('/tarjetas/1/compras').send({ monto: 200, descripcion: 'Super' });
        expect(res.status).toBe(201);
        expect(Tarjeta.registrarMovimiento).toHaveBeenCalledWith({
            id_tarjeta: '1', tipo_movimiento: 'TARJETA_COMPRA', monto: 200, descripcion: 'Super',
        });
    });
});

describe('POST /tarjetas/:id/pagar-resumen — pagarResumen', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza pagar mas de lo que se debe (400)', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, saldo_consumido: 100 });
        const res = await request(app).post('/tarjetas/1/pagar-resumen').send({ monto: 500 });
        expect(res.status).toBe(400);
        expect(Persona.descontarSaldo).not.toHaveBeenCalled();
    });

    test('rechaza si no hay saldo suficiente en la cuenta ARS (400)', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, saldo_consumido: 500 });
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 100 });

        const res = await request(app).post('/tarjetas/1/pagar-resumen').send({ monto: 300 });
        expect(res.status).toBe(400);
        expect(Tarjeta.registrarPagoResumen).not.toHaveBeenCalled();
    });

    test('paga correctamente y descuenta de la cuenta ARS', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, saldo_consumido: 500 });
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 1000 });
        Tarjeta.registrarPagoResumen.mockResolvedValue({ saldo_consumido: 200 });

        const res = await request(app).post('/tarjetas/1/pagar-resumen').send({ monto: 300 });
        expect(res.status).toBe(200);
        expect(Persona.descontarSaldo).toHaveBeenCalledWith('CBU_ARS', 300);
        expect(Tarjeta.registrarMovimiento).toHaveBeenCalledWith({
            id_tarjeta: '1', id_cuenta: 1, tipo_movimiento: 'TARJETA_PAGO', monto: 300, descripcion: 'Pago de resumen de tarjeta',
        });
    });
});

describe('POST /tarjetas/:id/cerrar — cerrarTarjeta', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('no permite cerrar con saldo pendiente', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, estado: 'ACTIVO', saldo_consumido: 50 });
        const res = await request(app).post('/tarjetas/1/cerrar');
        expect(res.status).toBe(409);
        expect(Tarjeta.cerrarTarjeta).not.toHaveBeenCalled();
    });

    test('cierra correctamente cuando el saldo es 0', async () => {
        Tarjeta.getTarjetaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, estado: 'ACTIVO', saldo_consumido: 0 });
        Tarjeta.cerrarTarjeta.mockResolvedValue({ id_producto: 1 });
        const res = await request(app).post('/tarjetas/1/cerrar');
        expect(res.status).toBe(200);
    });
});
