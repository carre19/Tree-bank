// ============================================================
// controllers/authController.js — LÓGICA DE AUTENTICACIÓN
// Maneja el registro de contraseñas, login, perfil y cambio de clave.
// Es el "cerebro" de todo lo relacionado con usuarios y sesiones.
// ============================================================

// bcrypt es la librería para encriptar contraseñas de forma segura
// Nunca guardamos la contraseña en texto plano, siempre como "hash"
const bcrypt = require('bcrypt');

// jsonwebtoken crea y verifica los tokens JWT (las "credenciales" de sesión)
const jwt = require('jsonwebtoken');

// Importamos la conexión a Supabase para hacer consultas SQL
const db = require('../config/db');

// ---- Funciones de validación ----
// Expresiones regulares que verifican el formato de los datos antes de procesarlos

// Verifica que el email tenga formato usuario@dominio.algo
const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Verifica que el DNI tenga entre 7 y 8 dígitos numéricos
const validarDni = (dni) => /^\d{7,8}$/.test(String(dni));

// POST /api/auth/register — Crea una contraseña para una persona que ya existe en el sistema
// IMPORTANTE: primero hay que crear la persona con POST /api/personas,
// solo después se puede registrar su contraseña acá.
// Es tambien el primer paso self-service del cliente (el operador solo cargo nombre/DNI),
// asi que de paso completa sus datos de contacto: email, telefono, direccion y sexo.
exports.register = async (req, res) => {
    // Extraemos los datos del body del pedido
    const { dni, password, email, telefono, direccion, sexo, nombre, apellido } = req.body;

    // Validaciones básicas antes de hacer nada
    if (!dni || !password) {
        return res.status(400).json({ error: 'DNI y password son requeridos' });
    }
    if (!validarDni(dni)) {
        return res.status(400).json({ error: 'El DNI debe contener entre 7 y 8 digitos numericos' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La password debe tener al menos 6 caracteres' });
    }
    // El email pasa a ser obligatorio: hace falta para completar el perfil
    if (!email || !validarEmail(email)) {
        return res.status(400).json({ error: 'El email es requerido y debe tener un formato valido' });
    }
    if (!nombre || nombre.trim().length < 2) {
        return res.status(400).json({ error: 'El nombre es requerido y debe tener al menos 2 caracteres' });
    }
    if (!apellido || apellido.trim().length < 2) {
        return res.status(400).json({ error: 'El apellido es requerido y debe tener al menos 2 caracteres' });
    }
    if (!sexo) {
        return res.status(400).json({ error: 'El sexo es requerido' });
    }
    if (!direccion) {
        return res.status(400).json({ error: 'La direccion es requerida' });
    }
    if (!telefono) {
        return res.status(400).json({ error: 'El telefono es requerido' });
    }

    try {
        // Buscamos si existe una persona con ese DNI en nuestra base de datos
        const { rows } = await db.query('SELECT * FROM personas WHERE dni = $1', [dni]);
        if (rows.length === 0) {
            // Si no existe → no podemos crear la contraseña, primero hay que crear la persona
            return res.status(404).json({ error: 'No existe una persona con ese DNI. Primero registrala en /api/personas' });
        }

        const persona = rows[0];

        // Si ya tiene contraseña → no permitimos sobreescribirla por seguridad
        if (persona.password_hash) {
            return res.status(409).json({ error: 'Esta persona ya tiene una contrasena registrada' });
        }

        // Encriptamos la contraseña con bcrypt (el 10 es el "salt rounds" = nivel de seguridad)
        // bcrypt.hash convierte "mipassword" en algo como "$2b$10$XKqPv3mN..."
        // Ese hash es irreversible: nadie puede sacar la contraseña original desde el hash
        const password_hash = await bcrypt.hash(password, 10);

        // Guardamos el hash y todos los datos de identidad/contacto del registro.
        await db.query(
            `UPDATE personas SET
                password_hash = $1,
                email = $2,
                nombre = $3,
                apellido = $4,
                telefono = $5,
                direccion = $6,
                sexo = $7
             WHERE dni = $8`,
            [password_hash, email.trim(), nombre.trim(), apellido.trim(), telefono.trim(), direccion.trim(), sexo, dni]
        );

        res.status(201).json({ mensaje: 'Contrasena registrada correctamente. Ya podes hacer login.' });

    } catch (error) {
        res.status(500).json({ error: 'Error al registrar la contrasena', detalle: error.message });
    }
};

// POST /api/auth/login — Verifica las credenciales y devuelve un token JWT
// El token es lo que el frontend guarda y manda en cada pedido protegido
// Pide DNI + password. El email solo se usa en el registro.
exports.login = async (req, res) => {
    const { dni, password } = req.body;

    if (!dni || !password) {
        return res.status(400).json({ error: 'DNI y password son requeridos' });
    }

    try {
        // Buscamos la persona por DNI en Supabase
        const { rows } = await db.query('SELECT * FROM personas WHERE dni = $1', [dni]);
        if (rows.length === 0) {
            // Intencionalmente damos el mismo mensaje para DNI o password invalidos
            // (por seguridad: así el atacante no sabe cuál de los dos falló)
            return res.status(401).json({ error: 'DNI o password incorrectos' });
        }

        const persona = rows[0];

        // Si nunca se registró una contraseña → no puede hacer login todavía
        if (!persona.password_hash) {
            return res.status(401).json({ error: 'Esta persona aun no tiene contrasena. Usa /api/auth/register primero.' });
        }

        // bcrypt.compare compara la contraseña que escribió el usuario con el hash guardado
        // Internamente bcrypt hashea lo que escribió y lo compara → devuelve true o false
        // No devuelve la contraseña original (eso es imposible)
        const passwordValida = await bcrypt.compare(password, persona.password_hash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'DNI o password incorrectos' });
        }

        // Buscamos los roles de la persona (ej: ADMIN) para incluirlos en el token
        // Asi el middleware verificarAdmin puede saber quien es administrador sin
        // consultar la base de datos en cada pedido protegido
        const { rows: filasRoles } = await db.query(
            'SELECT r.nombre_rol FROM roles r JOIN roles_x_personas rp ON r.id_rol = rp.id_rol WHERE rp.id_persona = $1',
            [persona.id]
        );
        const roles = filasRoles.map(r => r.nombre_rol);
        const esAdmin = roles.includes('ADMIN');

        // Login exitoso → generamos el token JWT
        // jwt.sign crea un token con:
        //   - Los datos del usuario (id, dni, nombre, roles) → son los que después lee req.usuario
        //   - La clave secreta del .env (JWT_SECRET) → sirve para firmar y verificar
        //   - Expiración de 8 horas → después hay que volver a hacer login
        const token = jwt.sign(
            { id: persona.id, dni: persona.dni, nombre: persona.nombre, roles },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Devolvemos el token y los datos básicos del usuario
        // El frontend guarda este token en localStorage y lo manda en cada pedido
        res.json({
            mensaje: `Bienvenido, ${persona.nombre} ${persona.apellido}`,
            token,   // ← esto es lo más importante de esta respuesta
            usuario: {
                id: persona.id,
                nombre: persona.nombre,
                apellido: persona.apellido,
                dni: persona.dni,
                roles,
                esAdmin
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
            'SELECT id, nombre, apellido, dni, email, telefono, direccion, sexo, fecha_nac FROM personas WHERE id = $1',
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
            'SELECT id, nombre, apellido, dni, email, telefono, direccion, sexo, fecha_nac FROM personas WHERE id = $1',
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
    const { nombre, apellido, email, telefono, direccion, sexo } = req.body;

    // Validar al menos un campo para actualizar
    if (!nombre && !apellido && !email && !telefono && !direccion && !sexo) {
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
        if (sexo)      { campos.push(`sexo = $${idx++}`);      valores.push(sexo.trim()); }

        valores.push(req.usuario.id);

        const { rows } = await db.query(
            `UPDATE personas SET ${campos.join(', ')} WHERE id = $${idx} RETURNING id, nombre, apellido, dni, email, telefono, direccion, sexo`,
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
