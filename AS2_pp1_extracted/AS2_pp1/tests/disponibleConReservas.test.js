// Regresion: una reserva tiene que proteger la plata de verdad. Si el saldo
// alcanza pero una parte esta reservada, transferir por encima del disponible
// (saldo - reservas) se tiene que rechazar, no solo por saldo bruto.

const express = require('express');
const request = require('supertest');

jest.mock('../models/personaModel');
jest.mock('../services/centralBankClient', () => ({ post: jest.fn() }));
// realizarTransferencia ahora envuelve descontarSaldo/acreditarSaldo/registrarMovimiento
// en una transaccion (db.connect() directo desde el controller), asi que sin este mock
// el test abriria una conexion real a Postgres.
jest.mock('../config/db', () => {
    const mockClient = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }), release: jest.fn() };
    return { connect: jest.fn().mockResolvedValue(mockClient), query: jest.fn(), __mockClient: mockClient };
});

const Persona = require('../models/personaModel');
const centralBank = require('../services/centralBankClient');
const db = require('../config/db');
const personaController = require('../controllers/personaController');
const mockClient = db.__mockClient;

const construirApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.usuario = { id: 5 }; next(); });
    app.post('/transferencias', personaController.realizarTransferencia);
    return app;
};

describe('Transferencias respetan el disponible (saldo - reservas)', () => {
    let app;
    beforeEach(() => { jest.clearAllMocks(); app = construirApp(); });

    test('rechaza transferir mas del disponible aunque el saldo bruto alcance', async () => {
        // saldo 10000, pero 8000 estan reservados -> disponible real: 2000
        Persona.getByCbu.mockResolvedValue({
            id_cuenta: 1, id_persona: 5, cbu: 'CBU_ORIGEN', estado: 'ACTIVO', saldo: 10000, reservado: 8000,
        });

        const res = await request(app).post('/transferencias').send({
            cbu_origen: 'CBU_ORIGEN', cbu_destino: 'CBU_DESTINO', monto: 5000,
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/disponible/i);
        expect(centralBank.post).not.toHaveBeenCalled();
        expect(Persona.descontarSaldo).not.toHaveBeenCalled();
    });

    test('permite transferir dentro del disponible', async () => {
        Persona.getByCbu.mockImplementation((cbu) => {
            if (cbu === 'CBU_ORIGEN') {
                return Promise.resolve({ id_cuenta: 1, id_persona: 5, cbu: 'CBU_ORIGEN', estado: 'ACTIVO', saldo: 10000, reservado: 8000 });
            }
            return Promise.resolve(undefined); // destino de otro banco, no hace falta acreditar local
        });
        centralBank.post.mockResolvedValue({ status: 201, data: { nombreDestino: 'Otra Persona' } });

        const res = await request(app).post('/transferencias').send({
            cbu_origen: 'CBU_ORIGEN', cbu_destino: 'CBU_DESTINO', monto: 1500,
        });

        expect(res.status).toBe(201);
        // Ahora va dentro de una transaccion: recibe el client como tercer argumento
        expect(Persona.descontarSaldo).toHaveBeenCalledWith('CBU_ORIGEN', 1500, mockClient);
    });
});
