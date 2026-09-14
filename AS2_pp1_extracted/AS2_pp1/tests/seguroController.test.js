// Seguros: producto interno (sin gate de Central de Deudores, a diferencia de
// prestamos/tarjetas, porque no es una linea de credito). Lo importante a
// probar es que respeta el disponible (saldo - reservas) y el ownership.

const express = require('express');
const request = require('supertest');

jest.mock('../models/seguroModel');
jest.mock('../models/personaModel');
// contratarPoliza y pagarPrima ahora envuelven sus pasos en una transaccion
// (db.connect() directo desde el controller), asi que sin este mock el test
// abriria una conexion real a Postgres.
jest.mock('../config/db', () => {
    const mockClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }), release: jest.fn() };
    return { connect: jest.fn().mockResolvedValue(mockClient), query: jest.fn(), __mockClient: mockClient };
});

const Seguro = require('../models/seguroModel');
const Persona = require('../models/personaModel');
const db = require('../config/db');
const seguroController = require('../controllers/seguroController');
const mockClient = db.__mockClient;

Seguro.TIPOS_SEGURO = {
    VIDA: { cobertura: 5000000, prima_mensual: 2500 },
    HOGAR: { cobertura: 3000000, prima_mensual: 1800 },
    PROTECCION_COMPRAS: { cobertura: 500000, prima_mensual: 900 },
};

const construirApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.usuario = { id: 5, dni: '30111222' }; next(); });
    app.post('/seguros', seguroController.contratarPoliza);
    app.post('/seguros/:id/pagar-prima', seguroController.pagarPrima);
    app.post('/seguros/:id/cancelar', seguroController.cancelarPoliza);
    return app;
};

describe('POST /seguros — contratarPoliza', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza un tipo de seguro invalido (400)', async () => {
        const res = await request(app).post('/seguros').send({ tipo_seguro: 'MASCOTA' });
        expect(res.status).toBe(400);
        expect(Seguro.contratarPoliza).not.toHaveBeenCalled();
    });

    test('rechaza si el disponible no alcanza para la primera prima', async () => {
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 2000, reservado: 1000 });
        const res = await request(app).post('/seguros').send({ tipo_seguro: 'VIDA' }); // prima 2500, disponible 1000
        expect(res.status).toBe(400);
        expect(Seguro.contratarPoliza).not.toHaveBeenCalled();
    });

    test('contrata la poliza y descuenta la primera prima', async () => {
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 10000, reservado: 0 });
        Seguro.contratarPoliza.mockResolvedValue({ id_poliza: 1, tipo_seguro: 'HOGAR' });

        const res = await request(app).post('/seguros').send({ tipo_seguro: 'hogar' });
        expect(res.status).toBe(201);
        // Ahora va dentro de una transaccion: recibe el client como tercer argumento
        expect(Persona.descontarSaldo).toHaveBeenCalledWith('CBU_ARS', 1800, mockClient);
    });
});

describe('POST /seguros/:id/pagar-prima — pagarPrima', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza si la poliza no es del usuario logueado', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 999, estado: 'ACTIVO' });
        const res = await request(app).post('/seguros/1/pagar-prima');
        expect(res.status).toBe(403);
    });

    test('rechaza si la poliza esta cancelada', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 5, estado: 'CERRADO' });
        const res = await request(app).post('/seguros/1/pagar-prima');
        expect(res.status).toBe(409);
    });

    test('rechaza si no hay disponible suficiente para la prima', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 5, estado: 'ACTIVO', prima_mensual: 900 });
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 500, reservado: 0 });
        const res = await request(app).post('/seguros/1/pagar-prima');
        expect(res.status).toBe(400);
        expect(Seguro.pagarPrima).not.toHaveBeenCalled();
    });

    test('paga la prima correctamente', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 5, estado: 'ACTIVO', prima_mensual: 900, tipo_seguro: 'PROTECCION_COMPRAS' });
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', saldo: 5000, reservado: 0 });
        Seguro.pagarPrima.mockResolvedValue({ id_poliza: 1 });

        const res = await request(app).post('/seguros/1/pagar-prima');
        expect(res.status).toBe(200);
        // Ahora va dentro de una transaccion: recibe el client como tercer argumento
        expect(Persona.descontarSaldo).toHaveBeenCalledWith('CBU_ARS', 900, mockClient);
    });
});

describe('POST /seguros/:id/cancelar — cancelarPoliza', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('cancela una poliza activa sin restricciones de saldo', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, estado: 'ACTIVO' });
        const res = await request(app).post('/seguros/1/cancelar');
        expect(res.status).toBe(200);
        expect(Persona.cambiarEstadoCuenta).toHaveBeenCalledWith(1, 'CERRADO');
    });

    test('no permite cancelar una poliza ya cancelada', async () => {
        Seguro.getPolizaDetalle.mockResolvedValue({ id_persona: 5, id_producto: 1, estado: 'CERRADO' });
        const res = await request(app).post('/seguros/1/cancelar');
        expect(res.status).toBe(409);
    });
});
