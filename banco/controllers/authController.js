const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validarDni = (dni) => /^\d{7,8}$/.test(String(dni));

// POST /api/auth/register
exports.register = async (req, res) => {
    const { dni, password } = req.body;

    if (!dni || !password) {
        return res.status(400).json({ error: 'DNI y password son requeridos' });
    }
    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La password debe tener al menos 6 caracteres' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM personas WHERE dni = $1', [dni]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No existe una persona con ese DNI. Primero registrala en /api/personas' });
        }

        const persona = rows[0];

        if (persona.password_hash) {
            return res.status(409).json({ error: 'Esta persona ya tiene una contrasena registrada' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        await db.query('UPDATE personas SET password_hash = $1 WHERE dni = $2', [password_hash, dni]);

        res.status(201).json({ mensaje: 'Contrasena registrada correctamente. Ya podes hacer login.' });

    } catch (error) {
        res.status(500).json({ error: 'Error al registrar la contrasena', detalle: error.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    const { dni, password } = req.body;

    if (!dni || !password) {
        return res.status(400).json({ error: 'DNI y password son requeridos' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM personas WHERE dni = $1', [dni]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'DNI o password incorrectos' });
        }

        const persona = rows[0];

        if (!persona.password_hash) {
            return res.status(401).json({ error: 'Esta persona aun no tiene contrasena. Usa /api/auth/register primero.' });
        }

        const passwordValida = await bcrypt.compare(password, persona.password_hash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'DNI o password incorrectos' });
        }

        const token = jwt.sign(
            { id: persona.id, dni: persona.dni, nombre: persona.nombre },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: `Bienvenido, ${persona.nombre} ${persona.apellido}`,
            token,
            usuario: {
                id: persona.id,
                nombre: persona.nombre,
                apellido: persona.apellido,
                dni: persona.dni
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Error en el login', detalle: error.message });
    }
};

// GET /api/auth/me - Datos del usuario logueado
exports.me = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, nombre, apellido, dni, email, telefono, direccion, fecha_nac FROM personas WHERE id = $1',
            [req.usuario.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/auth/perfil - Perfil completo del usuario logueado
exports.getPerfil = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, nombre, apellido, dni, email, telefono, direccion, fecha_nac FROM personas WHERE id = $1',
            [req.usuario.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el perfil', detalle: error.message });
    }
};

// PUT /api/auth/perfil - Actualiza datos personales del usuario logueado
exports.updatePerfil = async (req, res) => {
    const { nombre, apellido, email, telefono, direccion } = req.body;

    // Validar al menos un campo para actualizar
    if (!nombre && !apellido && !email && !telefono && !direccion) {
        return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    // Validar email si se envia
    if (email && !validarEmail(email)) {
        return res.status(400).json({ error: 'El formato del email no es valido (ejemplo: usuario@mail.com)' });
    }

    // Validar nombre y apellido si se envian
    if (nombre && nombre.trim().length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }
    if (apellido && apellido.trim().length < 2) {
        return res.status(400).json({ error: 'El apellido debe tener al menos 2 caracteres' });
    }

    try {
        // Construir query dinamica solo con los campos enviados
        const campos = [];
        const valores = [];
        let idx = 1;

        if (nombre)    { campos.push(`nombre = $${idx++}`);    valores.push(nombre.trim()); }
        if (apellido)  { campos.push(`apellido = $${idx++}`);  valores.push(apellido.trim()); }
        if (email)     { campos.push(`email = $${idx++}`);     valores.push(email.trim()); }
        if (telefono)  { campos.push(`telefono = $${idx++}`);  valores.push(telefono.trim()); }
        if (direccion) { campos.push(`direccion = $${idx++}`); valores.push(direccion.trim()); }

        valores.push(req.usuario.id);

        const { rows } = await db.query(
            `UPDATE personas SET ${campos.join(', ')} WHERE id = $${idx} RETURNING id, nombre, apellido, dni, email, telefono, direccion`,
            valores
        );

        res.json({
            mensaje: 'Perfil actualizado correctamente',
            perfil: rows[0]
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el perfil', detalle: error.message });
    }
};

// PUT /api/auth/cambiar-password - Cambia la password del usuario logueado
exports.cambiarPassword = async (req, res) => {
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
        return res.status(400).json({ error: 'Debes enviar password_actual y password_nueva' });
    }
    if (password_nueva.length < 6) {
        return res.status(400).json({ error: 'La nueva password debe tener al menos 6 caracteres' });
    }

    try {
        const { rows } = await db.query('SELECT password_hash FROM personas WHERE id = $1', [req.usuario.id]);
        const persona = rows[0];

        const esValida = await bcrypt.compare(password_actual, persona.password_hash);
        if (!esValida) {
            return res.status(401).json({ error: 'La password actual es incorrecta' });
        }

        const nuevo_hash = await bcrypt.hash(password_nueva, 10);
        await db.query('UPDATE personas SET password_hash = $1 WHERE id = $2', [nuevo_hash, req.usuario.id]);

        res.json({ mensaje: 'Password cambiada correctamente' });

    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar la password', detalle: error.message });
    }
};
