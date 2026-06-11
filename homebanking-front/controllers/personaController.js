const axios = require('axios');
const Persona = require('../models/personaModel');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Genera un alias bancario a partir del nombre y apellido.
 * Formato: NOMBRE.APELLIDO.SUFIJO
 * Sufijos posibles: TREE | BANK | PESOS | CAJA | AR | CLICK
 * Si el alias ya existe en la base de datos se agrega un número aleatorio al final.
 */
function generarAlias(nombre, apellido) {
    const sufijos = ['TREE', 'BANK', 'PESOS', 'CAJA', 'AR', 'CLICK'];
    const n = nombre.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    const a = apellido.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    const suf = sufijos[Math.floor(Math.random() * sufijos.length)];
    return `${n}.${a}.${suf}`;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/personas
 * Crea una persona, le pide el CBU al Banco Central y genera su cuenta con alias.
 */
exports.crearPersona = async (req, res) => {
    const { nombre, apellido, dni, email, telefono, direccion, fecha_nac } = req.body;

    if (!nombre || !apellido || !dni) {
        return res.status(400).json({ error: 'Los campos nombre, apellido y dni son obligatorios.' });
    }

    try {
        // 1. Registrar en el Banco Central → nos devuelve el CBU
        const respuestaCentral = await axios.post(
            `${process.env.CENTRAL_BANK_URL}/persons`,
            { nombre, apellido, dni },
            {
                headers: {
                    'x-api-key': process.env.CENTRAL_BANK_API_KEY,
                    'x-environment': process.env.X_ENVIRONMENT
                }
            }
        );

        const cbu = respuestaCentral.data.cbu;

        // 2. Generar alias único (reintento si ya existe)
        let alias = generarAlias(nombre, apellido);
        const aliasExiste = await Persona.existeAlias(alias);
        if (aliasExiste) {
            const sufijo = Math.floor(Math.random() * 900 + 100); // 100–999
            alias = `${alias}.${sufijo}`;
        }

        // 3. Crear persona + producto + cuenta en nuestra BD (transacción)
        const nuevaCuenta = await Persona.createConCuenta({
            nombre,
            apellido,
            dni,
            email: email || null,
            telefono: telefono || null,
            direccion: direccion || null,
            fecha_nac: fecha_nac || null,
            cbu,
            alias
        });

        res.status(201).json({
            mensaje: 'Cliente y cuenta registrados con éxito.',
            cbu,
            alias,
            datos: nuevaCuenta
        });

    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        res.status(500).json({ error: 'No se pudo completar el registro.', detalle });
    }
};

/**
 * POST /api/personas/transferir
 * Valida saldo local, consulta al Banco Central y registra los movimientos.
 */
exports.realizarTransferencia = async (req, res) => {
    const { cbu_origen, cbu_destino, monto, descripcion } = req.body;

    if (!cbu_origen || !cbu_destino || !monto) {
        return res.status(400).json({ error: 'Faltan campos: cbu_origen, cbu_destino, monto.' });
    }
    
    const importe = parseFloat(monto);
    if (importe <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
    }

    try {
        // 1. Verificar que el CBU origen pertenece a este banco
        const cuentaOrigen = await Persona.buscarPorCbu(cbu_origen);
        if (!cuentaOrigen) {
            return res.status(404).json({ error: 'El CBU de origen no pertenece a este banco.' });
        }

        const saldoOrigen = parseFloat(cuentaOrigen.saldo);

        // 2. Verificar saldo suficiente localmente
        if (saldoOrigen < importe) {
            return res.status(400).json({ error: 'Saldo insuficiente para realizar la transferencia.' });
        }

        // 3. Enviar al Banco Central para autorización
        const respuestaCentral = await axios.post(
            `${process.env.CENTRAL_BANK_URL}/transactions`,
            {
                cbuOrigen: cbu_origen,
                cbuDestino: cbu_destino,
                importe: importe,
                saldoOrigen: saldoOrigen
            },
            {
                headers: {
                    'x-api-key': process.env.CENTRAL_BANK_API_KEY,
                    'x-environment': process.env.X_ENVIRONMENT
                }
            }
        );

        if (respuestaCentral.status === 201) {
            // 4. Actualizar saldo local de la cuenta origen (restar)
            await Persona.actualizarSaldo(cuentaOrigen.id_cuenta, saldoOrigen - importe);

            // 5. Registrar movimiento de egreso en la cuenta origen (formato corregido)
            await Persona.registrarMovimiento(
                cuentaOrigen.id_cuenta,
                'TRANSFERENCIA_EGRESO',
                importe,
                descripcion || 'Transferencia enviada'
            );

            // 6. Si el destino también es de este banco, registrar ingreso y sumar saldo
            const cuentaDestino = await Persona.buscarPorCbu(cbu_destino);
            if (cuentaDestino) {
                const saldoDestino = parseFloat(cuentaDestino.saldo);
                await Persona.actualizarSaldo(cuentaDestino.id_cuenta, saldoDestino + importe);

                await Persona.registrarMovimiento(
                    cuentaDestino.id_cuenta,
                    'TRANSFERENCIA_INGRESO',
                    importe,
                    descripcion || 'Transferencia recibida'
                );
            }

            res.status(201).json({
                mensaje: 'Transferencia realizada con éxito.',
                ticket: respuestaCentral.data
            });
        }

    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        res.status(400).json({ error: 'La transferencia fue rechazada.', motivo: detalle });
    }
};

/**
 * GET /api/cuentas/:idCuenta/movimientos
 * Devuelve el historial de movimientos de una cuenta.
 */
exports.obtenerMovimientos = async (req, res) => {
    try {
        const { idCuenta } = req.params;
        const movimientos = await Persona.getMovimientos(idCuenta);
        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener historial.', detalle: error.message });
    }
};

/**
 * GET /api/personas
 * Devuelve todas las personas con sus productos, saldos y límites.
 */
exports.obtenerPersonas = async (req, res) => {
    try {
        const personas = await Persona.getAll();
        res.json(personas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/personas/:id/roles
 */
exports.obtenerRoles = async (req, res) => {
    try {
        const roles = await Persona.getRoles(req.params.id);
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/personas/:id/productos
 */
exports.obtenerProductos = async (req, res) => {
    try {
        const productos = await Persona.getProductos(req.params.id);
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};