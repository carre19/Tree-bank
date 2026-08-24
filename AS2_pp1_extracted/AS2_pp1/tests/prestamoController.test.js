// Prueba la logica de negocio mas importante de prestamos: valida entrada y,
// sobre todo, el "gate" contra la Central de Deudores antes de aprobar.

const express = require('express');
const request = require('supertest');

jest.mock('../models/prestamoModel');
jest.mock('../models/personaModel');
jest.mock('../services/centralBankClient', () => ({ get: jest.fn() }));

const Prestamo = require('../models/prestamoModel');
const Persona = require('../models/personaModel');
const centralBank = require('../services/centralBankClient');
const prestamoController = require('../controllers/prestamoController');

Prestamo.TASAS_POR_CUOTAS = { 3: 8, 6: 15, 12: 28, 24: 45 };
Prestamo.simular = jest.fn((monto, cuotas) => ({
    tasa: Prestamo.TASAS_POR_CUOTAS[cuotas],
    monto_cuota: monto / cuotas,
    saldo_pendiente: monto,
}));

const construirApp = () => {
    const app = express();
    app.use(express.json());
    // El usuario ya viene autenticado (simulamos lo que pondria verificarToken)
    app.use((req, res, next) => { req.usuario = { id: 5, dni: '30111222' }; next(); });
    app.post('/prestamos', prestamoController.solicitarPrestamo);
    return app;
};

describe('POST /prestamos — solicitarPrestamo', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = construirApp();
        Persona.getCuentaArsPorPersona.mockResolvedValue({ id_cuenta: 1, cbu: 'CBU_ARS', dni: '30111222' });
        Prestamo.crearPrestamo.mockResolvedValue({ id_prestamo: 1 });
        Persona.acreditarSaldo.mockResolvedValue();
        Persona.registrarMovimiento.mockResolvedValue();
    });

    test('rechaza un monto invalido con 400', async () => {
        const res = await request(app).post('/prestamos').send({ monto: 0, cuotas: 6 });
        expect(res.status).toBe(400);
        expect(centralBank.get).not.toHaveBeenCalled();
    });

    test('rechaza un plazo no soportado con 400', async () => {
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 5 });
        expect(res.status).toBe(400);
    });

    test('si no tiene cuenta en ARS, devuelve 404', async () => {
        Persona.getCuentaArsPorPersona.mockResolvedValue(undefined);
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(404);
    });

    test('un 404 de la Central de Deudores se trata como situacion normal y se aprueba', async () => {
        centralBank.get.mockRejectedValue({ response: { status: 404 } });
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(201);
        expect(res.body.situacion_al_otorgar).toBe(1);
        expect(Persona.acreditarSaldo).toHaveBeenCalledWith('CBU_ARS', 1000);
    });

    test('situacion 4 (riesgo alto) rechaza el prestamo con 403 y no acredita nada', async () => {
        centralBank.get.mockResolvedValue({ data: { situacion: 4 } });
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(403);
        expect(Prestamo.crearPrestamo).not.toHaveBeenCalled();
        expect(Persona.acreditarSaldo).not.toHaveBeenCalled();
    });

    test('situacion 5 (irrecuperable) tambien rechaza', async () => {
        centralBank.get.mockResolvedValue({ data: { situacion: 5 } });
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(403);
    });

    test('situacion 2 (normal, con alguna observacion menor) se aprueba', async () => {
        centralBank.get.mockResolvedValue({ data: { situacion: 2 } });
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(201);
        expect(res.body.situacion_al_otorgar).toBe(2);
    });

    test('un error real (no 404) al consultar la Central de Deudores devuelve 502, no se aprueba a ciegas', async () => {
        centralBank.get.mockRejectedValue({ response: { status: 500, data: { error: 'caido' } } });
        const res = await request(app).post('/prestamos').send({ monto: 1000, cuotas: 6 });
        expect(res.status).toBe(502);
        expect(Prestamo.crearPrestamo).not.toHaveBeenCalled();
    });
});
