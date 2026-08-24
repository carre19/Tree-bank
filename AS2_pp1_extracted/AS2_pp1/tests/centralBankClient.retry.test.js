// Prueba el reintento automatico ante 429 (rate limit) contra un servidor HTTP
// local de juguete, para no depender de la API real del Banco Central ni de mocks
// de axios que no ejercitarian los interceptors de verdad.

const http = require('http');

const CENTRAL_BANK_CLIENT_PATH = require.resolve('../services/centralBankClient');

const levantarServidor = (respuestas) => new Promise((resolve) => {
    let llamada = 0;
    const server = http.createServer((req, res) => {
        const codigo = respuestas[Math.min(llamada, respuestas.length - 1)];
        llamada++;
        if (codigo === 429) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, getLlamadas: () => llamada }));
});

describe('centralBankClient — reintento ante 429', () => {
    const OLD_ENV = process.env;
    let server;

    afterEach((done) => {
        process.env = OLD_ENV;
        jest.resetModules();
        if (server) server.close(done); else done();
    });

    test('reintenta y termina devolviendo la respuesta exitosa (429, 429, 200)', async () => {
        const info = await levantarServidor([429, 429, 200]);
        server = info.server;
        const { port } = server.address();

        jest.resetModules();
        process.env = { ...OLD_ENV, CENTRAL_BANK_URL: `http://127.0.0.1:${port}`, CENTRAL_BANK_API_KEY: 'x', X_ENVIRONMENT: 'test' };
        const centralBank = require(CENTRAL_BANK_CLIENT_PATH);

        const respuesta = await centralBank.get('/algo');
        expect(respuesta.status).toBe(200);
        expect(respuesta.data).toEqual({ ok: true });
        expect(info.getLlamadas()).toBe(3);
    });

    test('si sigue devolviendo 429 despues de los reintentos, se rechaza con el error original', async () => {
        const info = await levantarServidor([429, 429, 429, 429, 429]);
        server = info.server;
        const { port } = server.address();

        jest.resetModules();
        process.env = { ...OLD_ENV, CENTRAL_BANK_URL: `http://127.0.0.1:${port}`, CENTRAL_BANK_API_KEY: 'x', X_ENVIRONMENT: 'test' };
        const centralBank = require(CENTRAL_BANK_CLIENT_PATH);

        await expect(centralBank.get('/algo')).rejects.toMatchObject({
            response: { status: 429 },
        });
        // 1 intento original + 2 reintentos = 3 llamadas, no un loop infinito
        expect(info.getLlamadas()).toBe(3);
    });

    test('un error que no es 429 (ej. 500) no se reintenta', async () => {
        server = http.createServer((req, res) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'boom' }));
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();

        jest.resetModules();
        process.env = { ...OLD_ENV, CENTRAL_BANK_URL: `http://127.0.0.1:${port}`, CENTRAL_BANK_API_KEY: 'x', X_ENVIRONMENT: 'test' };
        const centralBank = require(CENTRAL_BANK_CLIENT_PATH);

        await expect(centralBank.get('/algo')).rejects.toMatchObject({ response: { status: 500 } });
    });
});
