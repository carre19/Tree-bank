// ============================================================
// controllers/personaController.js — LÓGICA DE PERSONAS Y OPERACIONES
// Es el controller más importante del sistema.
// Maneja: crear clientes, transferencias, depósitos, movimientos.
// Muchas funciones hablan con el Banco Central del profe Y con Supabase.
// ============================================================

// Cliente HTTP ya configurado con baseURL y headers (x-api-key, x-environment)
const centralBank = require('../services/centralBankClient');

// Persona es el model: contiene las consultas SQL de cuentas/movimientos
const Persona = require('../models/personaModel');

// db se usa directamente en las validaciones de autorización
// (verificar que la cuenta le pertenece al usuario logueado)
const db = require('../config/db');

// ---- Funciones de validación ----
// Son mini-funciones que devuelven true/false y se usan antes de procesar cualquier dato

// Verifica formato de email: texto@texto.texto
const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Verifica que el DNI tenga entre 7 y 8 dígitos numéricos
const validarDni = (dni) => /^\d{7,8}$/.test(String(dni));

// Verifica que el monto sea un número positivo mayor a 0
const validarMonto = (monto) => {
    const n = parseFloat(monto);
    return !isNaN(n) && n > 0;
};

// POST /api/personas — Registra una persona en el Banco Central y en Supabase
// Este es el primer paso para crear un cliente nuevo en Tree Bank.
// Flujo: frontend manda nombre/apellido/dni → nosotros se lo mandamos al Banco Central
// → el Banco Central responde con CBU y alias → los guardamos en Supabase
exports.crearPersona = async (req, res) => {
    const { nombre, apellido, dni } = req.body;

    if (!nombre || !apellido || !dni) {
        return res.status(400).json({ error: 'Los campos nombre, apellido y dni son requeridos' });
    }
    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }
    if (nombre.trim().length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }

    try {
        const respuestaCentral = await centralBank.post('/persons', {
            nombre, apellido, dni
        });

        const { cbu, alias } = respuestaCentral.data;

        if (respuestaCentral.status === 200) {
            const cuentaExistente = await Persona.getByCbu(cbu);
            if (cuentaExistente) {
                return res.status(200).json({
                    mensaje: 'La persona ya estaba registrada. Datos sincronizados.',
                    cbu, alias, datos: cuentaExistente
                });
            }
            const nuevaCuenta = await Persona.createConCuenta({ nombre, apellido, dni, cbu, alias });
            return res.status(200).json({
                mensaje: 'Persona recuperada del Banco Central y sincronizada en BD local.',
                cbu, alias, datos: nuevaCuenta
            });
        }

        const nuevaCuenta = await Persona.createConCuenta({ nombre, apellido, dni, cbu, alias });
        res.status(201).json({
            mensaje: 'Cliente y cuenta registrados con exito',
            cbu, alias, datos: nuevaCuenta
        });

    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        res.status(500).json({ error: 'No se pudo completar el registro', detalle });
    }
};

// GET /api/personas/:cbu/buscar - Busca una persona por CBU en el Banco Central
exports.buscarPorCbu = async (req, res) => {
    const { cbu } = req.params;
    try {
        const respuesta = await centralBank.get(`/persons/${cbu}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se encontro la persona', detalle });
    }
};

// PUT /api/personas/:cbu/alias - Asigna o cambia el alias (requiere ser el dueno de la cuenta)
exports.asignarAlias = async (req, res) => {
    const { cbu } = req.params;
    const { alias } = req.body;
    if (!alias || alias.trim().length < 3) {
        return res.status(400).json({ error: 'El alias debe tener al menos 3 caracteres' });
    }
    try {
        const cuenta = await Persona.getByCbu(cbu);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro una cuenta con ese CBU' });
        }
        if (cuenta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para modificar el alias de esta cuenta' });
        }

        await centralBank.put(`/persons/${cbu}/alias`, { alias });
        await Persona.actualizarAlias(cbu, alias);
        res.json({ mensaje: 'Alias actualizado correctamente', cbu, alias });
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se pudo actualizar el alias', detalle });
    }
};

// GET /api/personas/alias/:alias - Busca una persona por alias
exports.buscarPorAlias = async (req, res) => {
    const { alias } = req.params;
    try {
        const respuesta = await centralBank.get(`/persons/alias/${alias}`);
        res.json(respuesta.data);
    } catch (error) {
        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 500;
        res.status(status).json({ error: 'No se encontro el alias', detalle });
    }
};

// POST /api/transferencias — Hace una transferencia a través del Banco Central
// Es la operación más compleja: requiere validar, autorizar, llamar al Banco Central,
// actualizar saldos y registrar movimientos en Supabase.
// Requiere token JWT (solo el dueño de la cuenta puede transferir desde ella).
exports.realizarTransferencia = async (req, res) => {
    const { cbu_origen, cbu_destino, monto, descripcion } = req.body;

    // Validaciones antes de procesar
    if (!cbu_origen || !cbu_destino || !monto) {
        return res.status(400).json({ error: 'Los campos cbu_origen, cbu_destino y monto son requeridos' });
    }
    if (!validarMonto(monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero positivo mayor a 0' });
    }
    if (cbu_origen === cbu_destino) {
        return res.status(400).json({ error: 'El CBU de origen y destino no pueden ser iguales' });
    }

    try {
        // Buscamos la cuenta origen en nuestra base de datos
        const cuentaOrigen = await Persona.getByCbu(cbu_origen);
        if (!cuentaOrigen) {
            return res.status(404).json({ error: 'El CBU de origen no pertenece a este banco' });
        }

        // AUTORIZACIÓN: verificamos que la cuenta le pertenece al usuario logueado
        // req.usuario.id viene del token JWT (lo puso el middleware verificarToken)
        // Si alguien intenta transferir desde la cuenta de otro → 403 Forbidden
        if (cuentaOrigen.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar con esta cuenta' });
        }

        // Si el administrador bloqueo o cerro la cuenta, no puede operar
        if (cuentaOrigen.estado !== 'ACTIVO') {
            return res.status(403).json({ error: `La cuenta esta ${cuentaOrigen.estado.toLowerCase()} y no puede operar. Contacta al banco.` });
        }

        // Verificación de saldo disponible (saldo - reservas) antes de llamar al Banco Central:
        // la plata que el usuario aparto en una reserva no se puede transferir sin liberarla antes
        const disponibleOrigen = parseFloat(cuentaOrigen.saldo) - parseFloat(cuentaOrigen.reservado || 0);
        if (disponibleOrigen < parseFloat(monto)) {
            return res.status(400).json({ error: `Saldo disponible insuficiente para realizar la transferencia (disponible: $ ${disponibleOrigen.toFixed(2)})` });
        }

        // Llamada al Banco Central del profe para que procese la transferencia
        // Mandamos: CBU origen, CBU destino, importe, y el saldo actual del origen
        const respuestaCentral = await centralBank.post('/transactions', {
            cbuOrigen: cbu_origen,
            cbuDestino: cbu_destino,
            importe: monto,
            saldoOrigen: cuentaOrigen.saldo
        });

        if (respuestaCentral.status === 201) {
            // El Banco Central nos devuelve el nombre de ambas puntas de la operacion:
            // lo guardamos como "contraparte" del movimiento (base de la lista de Contactos)
            const { nombreOrigen, nombreDestino } = respuestaCentral.data || {};

            // Transferencia APROBADA: descontar saldo y registrar movimientos
            await Persona.descontarSaldo(cbu_origen, monto);
            await Persona.registrarMovimiento({
                id_cuenta: cuentaOrigen.id_cuenta,
                tipo_movimiento: 'TRANSFERENCIA_EGRESO',
                monto,
                descripcion: descripcion || 'Transferencia enviada',
                cbu_contraparte: cbu_destino,
                nombre_contraparte: nombreDestino || null
            });

            // Si el destino tambien es de este banco, acreditar localmente
            const cuentaDestino = await Persona.getByCbu(cbu_destino);
            if (cuentaDestino) {
                await Persona.acreditarSaldo(cbu_destino, monto);
                await Persona.registrarMovimiento({
                    id_cuenta: cuentaDestino.id_cuenta,
                    tipo_movimiento: 'TRANSFERENCIA_INGRESO',
                    monto,
                    descripcion: descripcion || 'Transferencia recibida',
                    cbu_contraparte: cbu_origen,
                    nombre_contraparte: nombreOrigen || null
                });
            }

            return res.status(201).json({
                mensaje: 'Transferencia realizada con exito',
                ticket: respuestaCentral.data
            });
        }
    } catch (error) {
        // 422: Banco Central rechazo por saldo insuficiente — registrar el intento
        if (error.response?.status === 422) {
            try {
                await Persona.registrarMovimiento({
                    id_cuenta: (await Persona.getByCbu(cbu_origen))?.id_cuenta,
                    tipo_movimiento: 'TRANSFERENCIA_RECHAZADA',
                    monto,
                    descripcion: `Rechazada: saldo insuficiente (destino: ${cbu_destino})`
                });
            } catch (_) { /* si falla el registro no interrumpimos la respuesta */ }

            return res.status(422).json({
                error: 'Transferencia rechazada por saldo insuficiente',
                motivo: error.response.data
            });
        }

        const detalle = error.response ? error.response.data : error.message;
        const status = error.response?.status || 400;
        res.status(status).json({ error: 'La transferencia fue rechazada', motivo: detalle });
    }
};

// POST /api/depositos - Registra un deposito en efectivo en la propia cuenta
exports.realizarDeposito = async (req, res) => {
    const { cbu, monto, descripcion } = req.body;

    if (!cbu || !monto) {
        return res.status(400).json({ error: 'Los campos cbu y monto son requeridos' });
    }
    if (!validarMonto(monto)) {
        return res.status(400).json({ error: 'El monto debe ser un numero positivo mayor a 0' });
    }

    try {
        const cuenta = await Persona.getByCbu(cbu);
        if (!cuenta) {
            return res.status(404).json({ error: 'No se encontro ninguna cuenta con ese CBU' });
        }

        // Autorizar: solo el dueno de la cuenta puede depositar en ella
        if (cuenta.id_persona !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para operar con esta cuenta' });
        }

        // Si el administrador bloqueo o cerro la cuenta, no puede operar
        if (cuenta.estado !== 'ACTIVO') {
            return res.status(403).json({ error: `La cuenta esta ${cuenta.estado.toLowerCase()} y no puede operar. Contacta al banco.` });
        }

        const montoNum = parseFloat(monto);
        await Persona.acreditarSaldo(cbu, montoNum);
        await Persona.registrarMovimiento({
            id_cuenta: cuenta.id_cuenta,
            tipo_movimiento: 'DEPOSITO',
            monto: montoNum,
            descripcion: descripcion || 'Deposito en efectivo'
        });

        const saldoNuevo = parseFloat(cuenta.saldo) + montoNum;

        res.status(201).json({
            mensaje: 'Deposito realizado con exito',
            cbu,
            monto: montoNum,
            saldo_actualizado: saldoNuevo
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el deposito', detalle: error.message });
    }
};

// GET /api/movimientos/:idCuenta - Historial de movimientos (solo el dueno)
exports.obtenerMovimientos = async (req, res) => {
    try {
        const { idCuenta } = req.params;

        // Verificar que la cuenta pertenece al usuario autenticado
        const cuentaRes = await db.query(
            `SELECT cb.id_cuenta FROM cuentas_bancarias cb
             JOIN productos p ON cb.id_producto = p.id_producto
             WHERE cb.id_cuenta = $1 AND p.id_persona = $2`,
            [idCuenta, req.usuario.id]
        );
        if (cuentaRes.rows.length === 0) {
            return res.status(403).json({ error: 'No tenes permiso para ver estos movimientos' });
        }

        const movimientos = await Persona.getMovimientos(idCuenta);
        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener historial', detalle: error.message });
    }
};

// GET /api/personas - Lista todas las personas
exports.obtenerPersonas = async (req, res) => {
    try {
        const personas = await Persona.getAll();
        res.json(personas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/personas/:id/roles
exports.obtenerRoles = async (req, res) => {
    try {
        const roles = await Persona.getRoles(req.params.id);
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/personas/:id/contactos (requiere token - solo el propio usuario)
// Devuelve solo la gente con la que ya se hizo una transferencia (enviada o recibida),
// no todos los clientes del banco.
exports.obtenerContactos = async (req, res) => {
    try {
        const idSolicitado = parseInt(req.params.id);
        if (idSolicitado !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para ver los contactos de otro usuario' });
        }
        const contactos = await Persona.getContactos(idSolicitado);
        res.json(contactos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los contactos', detalle: error.message });
    }
};

// GET /api/personas/:id/productos (solo el propio usuario)
exports.obtenerProductos = async (req, res) => {
    try {
        const idSolicitado = parseInt(req.params.id);
        if (idSolicitado !== req.usuario.id) {
            return res.status(403).json({ error: 'No tenes permiso para ver los productos de otro usuario' });
        }
        const productos = await Persona.getProductos(idSolicitado);
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
