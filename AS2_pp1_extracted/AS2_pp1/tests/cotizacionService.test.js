// cotizacionService tiene una cadena de 3 fuentes (Banco Central -> DolarAPI -> fallback fijo)
// con una cache en memoria a nivel de modulo. Usamos jest.resetModules() en cada test para
// arrancar con la cache vacia y poder mockear axios/centralBankClient de forma distinta.

const CENTRAL_BANK_PATH = require.resolve('../services/centralBankClient');
const AXIOS_PATH = require.resolve('axios');

const cargarServicioCon = ({ centralBankGet, axiosGet }) => {
    jest.resetModules();
    jest.doMock(CENTRAL_BANK_PATH, () => ({ get: centralBankGet }));
    jest.doMock(AXIOS_PATH, () => ({ get: axiosGet }));
    return require('../services/cotizacionService');
};

describe('cotizacionService.obtenerCotizacionOficial', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV, COTIZACION_USD_FALLBACK_COMPRA: '1000', COTIZACION_USD_FALLBACK_VENTA: '1050' };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test('usa la cotizacion del Banco Central cuando la expone', async () => {
        const { obtenerCotizacionOficial } = cargarServicioCon({
            centralBankGet: jest.fn().mockResolvedValue({ data: { compra: 1100, venta: 1150 } }),
            axiosGet: jest.fn(),
        });

        const resultado = await obtenerCotizacionOficial();
        expect(resultado).toEqual({ compra: 1100, venta: 1150, fuente: 'Banco Central' });
    });

    test('si el Banco Central no la expone, usa DolarAPI', async () => {
        const { obtenerCotizacionOficial } = cargarServicioCon({
            centralBankGet: jest.fn().mockRejectedValue(new Error('404')),
            axiosGet: jest.fn().mockResolvedValue({ data: { compra: 900, venta: 950 } }),
        });

        const resultado = await obtenerCotizacionOficial();
        expect(resultado).toEqual({ compra: 900, venta: 950, fuente: 'DolarAPI (oficial)' });
    });

    test('si ambas fuentes fallan, usa el valor fijo de .env', async () => {
        const { obtenerCotizacionOficial } = cargarServicioCon({
            centralBankGet: jest.fn().mockRejectedValue(new Error('caido')),
            axiosGet: jest.fn().mockRejectedValue(new Error('sin internet')),
        });

        const resultado = await obtenerCotizacionOficial();
        expect(resultado).toEqual({ compra: 1000, venta: 1050, fuente: 'valor fijo (.env, sin conexion a APIs externas)' });
    });

    test('cachea el resultado: una segunda llamada inmediata no vuelve a pedir a las APIs', async () => {
        const centralBankGet = jest.fn().mockResolvedValue({ data: { compra: 1100, venta: 1150 } });
        const { obtenerCotizacionOficial } = cargarServicioCon({ centralBankGet, axiosGet: jest.fn() });

        await obtenerCotizacionOficial();
        await obtenerCotizacionOficial();

        expect(centralBankGet).toHaveBeenCalledTimes(1);
    });
});
