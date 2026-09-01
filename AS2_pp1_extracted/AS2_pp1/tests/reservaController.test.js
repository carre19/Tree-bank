// Reservas: apartar plata dentro de una cuenta sin moverla del saldo real.
// Lo importante a probar es que el "disponible" (saldo - reservas) se respeta
// al crear/agregar, y que no se puede liberar mas de lo que tiene una reserva.

const express = require('express');
const request = require('supertest');

jest.mock('../models/personaModel');

const Persona = require('../models/personaModel');
const reservaController = require('../controllers/reservaController');

const construirApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.usuario = { id: 5 }; next(); });
    app.get('/cuentas/:cbu/reservas', reservaController.listarReservas);
    app.post('/cuentas/:cbu/reservas', reservaController.crearReserva);
    app.post('/reservas/:id/agregar', reservaController.agregarMonto);
    app.post('/reservas/:id/liberar', reservaController.liberarMonto);
    app.delete('/reservas/:id', reservaController.eliminarReserva);
    return app;
};

describe('POST /cuentas/:cbu/reservas — crearReserva', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza si la cuenta no es del usuario logueado (403)', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 999, id_cuenta: 1, saldo: 1000, reservado: 0 });
        const res = await request(app).post('/cuentas/CBU1/reservas').send({ nombre: 'Vacaciones', monto: 100 });
        expect(res.status).toBe(403);
        expect(Persona.crearReserva).not.toHaveBeenCalled();
    });

    test('rechaza si el monto supera el disponible (saldo - reservado)', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, id_cuenta: 1, saldo: 1000, reservado: 800 });
        const res = await request(app).post('/cuentas/CBU1/reservas').send({ nombre: 'Vacaciones', monto: 300 });
        expect(res.status).toBe(400);
        expect(Persona.crearReserva).not.toHaveBeenCalled();
    });

    test('crea la reserva cuando hay disponible suficiente', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, id_cuenta: 1, saldo: 1000, reservado: 200 });
        Persona.crearReserva.mockResolvedValue({ id_reserva: 1, nombre: 'Vacaciones', monto: 300 });

        const res = await request(app).post('/cuentas/CBU1/reservas').send({ nombre: 'Vacaciones', monto: 300 });
        expect(res.status).toBe(201);
        expect(Persona.crearReserva).toHaveBeenCalledWith({ id_cuenta: 1, nombre: 'Vacaciones', monto: 300 });
    });
});

describe('GET /cuentas/:cbu/reservas — listarReservas', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('devuelve saldo, reservado, disponible y la lista', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, id_cuenta: 1, saldo: 1000, reservado: 300 });
        Persona.getReservasPorCuenta.mockResolvedValue([{ id_reserva: 1, nombre: 'Vacaciones', monto: 300 }]);

        const res = await request(app).get('/cuentas/CBU1/reservas');
        expect(res.status).toBe(200);
        expect(res.body.disponible).toBe(700);
        expect(res.body.reservas).toHaveLength(1);
    });
});

describe('POST /reservas/:id/liberar — liberarMonto', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('no permite liberar mas de lo que tiene la reserva', async () => {
        Persona.getReservaDetalle.mockResolvedValue({ id_reserva: 1, id_persona: 5, monto: 100, cbu: 'CBU1' });
        Persona.modificarMontoReserva.mockResolvedValue(undefined); // el WHERE monto+delta>=0 no matcheo

        const res = await request(app).post('/reservas/1/liberar').send({ monto: 500 });
        expect(res.status).toBe(400);
    });

    test('libera correctamente dentro del monto disponible en la reserva', async () => {
        Persona.getReservaDetalle.mockResolvedValue({ id_reserva: 1, id_persona: 5, monto: 300, cbu: 'CBU1' });
        Persona.modificarMontoReserva.mockResolvedValue({ id_reserva: 1, monto: 200 });

        const res = await request(app).post('/reservas/1/liberar').send({ monto: 100 });
        expect(res.status).toBe(200);
        expect(Persona.modificarMontoReserva).toHaveBeenCalledWith('1', -100);
    });

    test('rechaza si la reserva no es del usuario logueado', async () => {
        Persona.getReservaDetalle.mockResolvedValue({ id_reserva: 1, id_persona: 999, monto: 300 });
        const res = await request(app).post('/reservas/1/liberar').send({ monto: 100 });
        expect(res.status).toBe(403);
    });
});

describe('POST /reservas/:id/agregar — agregarMonto', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza si no hay disponible suficiente en la cuenta', async () => {
        Persona.getReservaDetalle.mockResolvedValue({ id_reserva: 1, id_persona: 5, monto: 100, cbu: 'CBU1' });
        Persona.getByCbu.mockResolvedValue({ saldo: 500, reservado: 450 }); // disponible = 50
        const res = await request(app).post('/reservas/1/agregar').send({ monto: 200 });
        expect(res.status).toBe(400);
        expect(Persona.modificarMontoReserva).not.toHaveBeenCalled();
    });
});

describe('DELETE /reservas/:id — eliminarReserva', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('elimina la reserva del dueno', async () => {
        Persona.getReservaDetalle.mockResolvedValue({ id_reserva: 1, id_persona: 5 });
        const res = await request(app).delete('/reservas/1');
        expect(res.status).toBe(200);
        expect(Persona.eliminarReserva).toHaveBeenCalledWith('1');
    });
});
