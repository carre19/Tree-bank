const Prestamo = require('../models/prestamoModel');

describe('Prestamo.simular', () => {
    test('aplica la tasa correcta segun el plazo', () => {
        expect(Prestamo.simular(1000, 3).tasa).toBe(8);
        expect(Prestamo.simular(1000, 6).tasa).toBe(15);
        expect(Prestamo.simular(1000, 12).tasa).toBe(28);
        expect(Prestamo.simular(1000, 24).tasa).toBe(45);
    });

    test('calcula el saldo total con el interes aplicado', () => {
        const { saldo_pendiente } = Prestamo.simular(1000, 3); // 8%
        expect(saldo_pendiente).toBeCloseTo(1080, 2);
    });

    test('la cuota mensual es el saldo total dividido en partes iguales', () => {
        const { monto_cuota, saldo_pendiente } = Prestamo.simular(1200, 6); // 15%
        expect(saldo_pendiente).toBeCloseTo(1380, 2);
        expect(monto_cuota).toBeCloseTo(230, 2);
        expect(monto_cuota * 6).toBeCloseTo(saldo_pendiente, 2);
    });

    test('un plazo no soportado devuelve tasa undefined (el controller lo valida antes)', () => {
        const { tasa, monto_cuota } = Prestamo.simular(1000, 5);
        expect(tasa).toBeUndefined();
        expect(Number.isNaN(monto_cuota)).toBe(true);
    });
});
