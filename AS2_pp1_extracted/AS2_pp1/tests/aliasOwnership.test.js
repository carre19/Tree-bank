// Regresion para el fix de seguridad: cambiar el alias de una cuenta (ARS o USD)
// tiene que exigir login Y que la cuenta le pertenezca al usuario del token.
// Antes de este fix, PUT /personas/:cbu/alias y PUT /cuentas/:cbu/alias no
// verificaban nada: cualquiera que supiera un CBU podia cambiarle el alias.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'clave-de-test';

jest.mock('../models/personaModel');
jest.mock('../services/centralBankClient', () => ({ put: jest.fn().mockResolvedValue({}) }));

const Persona = require('../models/personaModel');
const centralBank = require('../services/centralBankClient');
const { verificarToken } = require('../middleware/authMiddleware');
const personaController = require('../controllers/personaController');
const cuentaController = require('../controllers/cuentaController');

const construirApp = () => {
    const app = express();
    app.use(express.json());
    app.put('/personas/:cbu/alias', verificarToken, personaController.asignarAlias);
    app.put('/cuentas/:cbu/alias', verificarToken, cuentaController.asignarAlias);
    return app;
};

const tokenPara = (id) => jwt.sign({ id, dni: '12345678' }, process.env.JWT_SECRET);

describe('PUT /personas/:cbu/alias y /cuentas/:cbu/alias — ownership', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = construirApp();
    });

    test('sin token, se rechaza con 401 antes de tocar el modelo', async () => {
        const res = await request(app).put('/personas/CBU123/alias').send({ alias: 'mi.alias.nuevo' });
        expect(res.status).toBe(401);
        expect(Persona.getByCbu).not.toHaveBeenCalled();
    });

    test('con token pero de OTRO dueno, se rechaza con 403 y no llega a actualizar', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, cbu: 'CBU123' });

        const res = await request(app)
            .put('/personas/CBU123/alias')
            .set('Authorization', `Bearer ${tokenPara(999)}`)
            .send({ alias: 'mi.alias.nuevo' });

        expect(res.status).toBe(403);
        expect(Persona.actualizarAlias).not.toHaveBeenCalled();
        expect(centralBank.put).not.toHaveBeenCalled();
    });

    test('con token del dueno real, se actualiza correctamente (200)', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, cbu: 'CBU123' });
        Persona.actualizarAlias.mockResolvedValue();

        const res = await request(app)
            .put('/personas/CBU123/alias')
            .set('Authorization', `Bearer ${tokenPara(5)}`)
            .send({ alias: 'mi.alias.nuevo' });

        expect(res.status).toBe(200);
        expect(Persona.actualizarAlias).toHaveBeenCalledWith('CBU123', 'mi.alias.nuevo');
    });

    test('si el CBU no existe, devuelve 404 en vez de dejar pasar el cambio', async () => {
        Persona.getByCbu.mockResolvedValue(undefined);

        const res = await request(app)
            .put('/cuentas/CBU_INEXISTENTE/alias')
            .set('Authorization', `Bearer ${tokenPara(5)}`)
            .send({ alias: 'mi.alias.nuevo' });

        expect(res.status).toBe(404);
        expect(Persona.actualizarAlias).not.toHaveBeenCalled();
    });

    test('lo mismo aplica a /cuentas/:cbu/alias (cajas en USD)', async () => {
        Persona.getByCbu.mockResolvedValue({ id_persona: 5, cbu: 'CBU_USD' });

        const otroDueno = await request(app)
            .put('/cuentas/CBU_USD/alias')
            .set('Authorization', `Bearer ${tokenPara(999)}`)
            .send({ alias: 'mi.alias.usd' });
        expect(otroDueno.status).toBe(403);

        const mismoDueno = await request(app)
            .put('/cuentas/CBU_USD/alias')
            .set('Authorization', `Bearer ${tokenPara(5)}`)
            .send({ alias: 'mi.alias.usd' });
        expect(mismoDueno.status).toBe(200);
    });
});
