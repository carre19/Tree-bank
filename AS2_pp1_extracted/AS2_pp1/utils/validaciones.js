// ============================================================
// utils/validaciones.js — VALIDADORES COMPARTIDOS
// Antes cada controller tenia su propia version de "es un monto valido",
// y todas dejaban pasar entradas raras: Infinity, 1e400, "100abc", [5].
// Con parseFloat("100abc") = 100 y Number([5]) = 5, un body malicioso
// terminaba en una query o en la API del Banco Central.
// Estas funciones son el unico lugar donde se decide que es valido.
// ============================================================

// Tope por operacion. No es una regla de negocio del banco, es un limite de
// cordura: cualquier cosa por encima es casi seguro un error o un abuso.
const MONTO_MAXIMO = 1_000_000_000; // mil millones

// Un monto de dinero valido: numero o string numerico, positivo, finito,
// con hasta 2 decimales y por debajo del tope.
// Rechaza a proposito: NaN, Infinity, negativos, notacion cientifica,
// texto con basura pegada ("100abc"), arrays, objetos, booleanos y null.
const validarMonto = (monto, { minimo = 0, incluirMinimo = false } = {}) => {
    if (typeof monto !== 'number' && typeof monto !== 'string') return false;
    if (typeof monto === 'number' && !Number.isFinite(monto)) return false;

    const texto = String(monto).trim();
    // Hasta 12 digitos enteros y hasta 2 decimales. Sin signos ni exponentes.
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(texto)) return false;

    const n = Number(texto);
    if (!Number.isFinite(n)) return false;
    if (incluirMinimo ? n < minimo : n <= minimo) return false;
    return n <= MONTO_MAXIMO;
};

// Convierte a numero un monto YA validado con validarMonto
const aMonto = (monto) => Number(String(monto).trim());

// DNI: entre 7 y 8 digitos, sin espacios ni letras
const validarDni = (dni) => typeof dni !== 'object' && /^\d{7,8}$/.test(String(dni).trim());

// Email con formato usuario@dominio.algo y un largo razonable
const validarEmail = (email) =>
    typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Texto libre (descripciones, nombres): string, sin caracteres de control,
// y dentro de un largo maximo para que no entre un body gigante por ahi.
const validarTexto = (valor, { min = 1, max = 255 } = {}) => {
    if (typeof valor !== 'string') return false;
    const t = valor.trim();
    if (t.length < min || t.length > max) return false;
    return !/[\u0000-\u001f\u007f]/.test(t);
};

// Entero dentro de un rango (cuotas, situacion crediticia, ids de ruta)
const validarEntero = (valor, { min, max } = {}) => {
    if (typeof valor !== 'number' && typeof valor !== 'string') return false;
    const texto = String(valor).trim();
    if (!/^\d{1,15}$/.test(texto)) return false;
    const n = Number(texto);
    if (!Number.isSafeInteger(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    return true;
};

module.exports = {
    MONTO_MAXIMO,
    validarMonto,
    aMonto,
    validarDni,
    validarEmail,
    validarTexto,
    validarEntero,
};
