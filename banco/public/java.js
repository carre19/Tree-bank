// ── Configuración ────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

// ── Navegación ────────────────────────────────────────────────────────────────

function goTo(btn, pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    btn.classList.add('active');
    if (pageName === 'clientes') cargarClientes();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo + ' show';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Alias ─────────────────────────────────────────────────────────────────────

const SUFIJOS = ['TREE', 'BANK', 'PESOS', 'CAJA', 'AR', 'CLICK'];

/**
 * Genera un alias bancario a partir de nombre y apellido.
 * Elimina tildes y caracteres no alfabéticos, convierte a mayúsculas.
 * Ej: "Juan" + "Pérez" → "JUAN.PEREZ.BANK"
 */
function generarAlias(nombre, apellido) {
    const limpiar = (str) => str
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z]/g, '');

    const n = limpiar(nombre);
    const a = limpiar(apellido);
    if (!n || !a) return '';

    const suf = SUFIJOS[Math.floor(Math.random() * SUFIJOS.length)];
    return `${n}.${a}.${suf}`;
}

let aliasActual = '';

function actualizarAlias() {
    const nombre   = document.getElementById('nc-nombre').value;
    const apellido = document.getElementById('nc-apellido').value;
    const preview  = document.getElementById('alias-preview');

    if (nombre && apellido) {
        aliasActual = generarAlias(nombre, apellido);
        preview.innerHTML = aliasActual;
    } else {
        aliasActual = '';
        preview.innerHTML = '<span class="alias-hint">Completá nombre y apellido para ver el alias...</span>';
    }
}

// ── Clientes ──────────────────────────────────────────────────────────────────

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Cargando...</td></tr>';

    try {
        const personas = await fetch(`${API}/personas`).then(r => r.json());

        if (!personas.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Sin clientes registrados.</td></tr>';
            return;
        }

        // Stats
        const unicos  = [...new Map(personas.map(p => [p.id, p])).values()];
        let totalSaldo = 0;
        let totalCuentas = 0;

        personas.forEach(p => {
            // Evaluamos si tiene saldo (tiene una cuenta activa)
            if (p.saldo !== null && p.saldo !== undefined) {
                totalSaldo += parseFloat(p.saldo);
                totalCuentas++;
            }
        });

        document.getElementById('stat-clientes').textContent = unicos.length;
        document.getElementById('stat-cuentas').textContent  = totalCuentas;
        document.getElementById('stat-saldo').innerHTML =
            `$${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })} <span>ARS</span>`;

        // Filas de tabla
        tbody.innerHTML = personas.map(p => {
            const saldo = parseFloat(p.saldo) || 0;
            const saldoStr = p.saldo !== null
                ? `$${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : '—';

            // CORRECCIÓN: Si el cliente tiene un CBU asignado, mostramos el badge de CA (Caja de Ahorro)
            let tipoBadge = '—';
            if (p.cbu) tipoBadge = '<span class="badge badge-ca">CA</span>';
            // Dejamos tu lógica original por si a futuro la API empieza a devolver el string 'producto'
            if (p.producto === 'CAJA_AHORRO')     tipoBadge = '<span class="badge badge-ca">CA</span>';
            if (p.producto === 'CUENTA_CORRIENTE') tipoBadge = '<span class="badge badge-cc">CC</span>';
            if (p.producto === 'TARJETA_CREDITO')  tipoBadge = '<span class="badge badge-tc">TC</span>';

            const cbuVal   = p.cbu   || '—';
            const aliasVal = p.alias || '—';

            return `<tr>
                <td>
                    <strong>${p.nombre} ${p.apellido}</strong>
                </td>
                <td class="mono-val">${p.dni}</td>
                <td>
                    <span class="mono-accent">${cbuVal}</span>
                    ${p.cbu ? `<button class="copy-btn" onclick="copiar('${p.cbu}')">copiar</button>` : ''}
                </td>
                <td class="mono-accent">${aliasVal}</td>
                <td>${tipoBadge}</td>
                <td class="mono-val">${saldoStr}</td>
                <td><span class="badge badge-active">● activo</span></td>
            </tr>`;
        }).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Error al conectar con la API. ¿Está corriendo el servidor?</td></tr>';
    }
}

// ── Nuevo cliente ─────────────────────────────────────────────────────────────

async function crearCliente() {
    const nombre   = document.getElementById('nc-nombre').value.trim();
    const apellido = document.getElementById('nc-apellido').value.trim();
    const dni      = document.getElementById('nc-dni').value.trim();
    const email    = document.getElementById('nc-email').value.trim();
    const telefono = document.getElementById('nc-tel').value.trim();

    if (!nombre || !apellido || !dni) {
        toast('Completá nombre, apellido y DNI.', 'error');
        return;
    }

    const btn = document.getElementById('btn-crear');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Registrando...';

    try {
        const body = { nombre, apellido, dni };
        if (email)    body.email    = email;
        if (telefono) body.telefono = telefono;

        const res  = await fetch(`${API}/personas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.detalle || data.error || 'Error desconocido.');

        // CORRECCIÓN: Leemos el alias real (definitivo) directo desde la respuesta del servidor
        toast(`✓ Cliente creado — Alias: ${data.alias}`);
        limpiarForm();

        // Redirigir a clientes después de 1.5s
        setTimeout(() => {
            document.querySelector('[data-page="clientes"]').click();
        }, 1500);

    } catch (e) {
        toast('Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar cliente';
    }
}

function limpiarForm() {
    ['nc-nombre', 'nc-apellido', 'nc-dni', 'nc-email', 'nc-tel'].forEach(id => {
        document.getElementById(id).value = '';
    });
    aliasActual = '';
    document.getElementById('alias-preview').innerHTML =
        '<span class="alias-hint">Completá nombre y apellido para ver el alias...</span>';
}

// ── Transferencias ────────────────────────────────────────────────────────────

/**
 * Busca localmente si el CBU pertenece a una cuenta de este banco
 * y muestra el saldo disponible como ayuda visual.
 */
async function buscarCuentaLocal(cbu, infoId) {
    const info = document.getElementById(infoId);
    if (!cbu || cbu.length < 22) { info.textContent = ''; return; }

    try {
        const cuentas = await fetch(`${API}/tablas/cuentas_bancarias`).then(r => r.json());
        const cuenta  = cuentas.find(c => c.cbu === cbu);

        if (cuenta) {
            const saldo = parseFloat(cuenta.saldo).toLocaleString('es-AR', { minimumFractionDigits: 2 });
            info.innerHTML = `<span style="color:var(--success)">✓ Cuenta interna — Saldo disponible: $${saldo}</span>`;
        } else {
            info.innerHTML = `<span style="color:var(--muted)">CBU externo (el Banco Central lo validará)</span>`;
        }
    } catch (e) {
        info.textContent = '';
    }
}

async function realizarTransferencia() {
    const cbu_origen  = document.getElementById('tr-origen').value.trim();
    const cbu_destino = document.getElementById('tr-destino').value.trim();
    const monto       = parseFloat(document.getElementById('tr-monto').value);
    const descripcion = document.getElementById('tr-desc').value.trim();

    if (!cbu_origen || !cbu_destino) {
        toast('Ingresá el CBU de origen y destino.', 'error');
        return;
    }
    if (!monto || monto <= 0) {
        toast('El monto debe ser mayor a $0.', 'error');
        return;
    }
    if (cbu_origen === cbu_destino) {
        toast('El CBU de origen y destino no pueden ser iguales.', 'error');
        return;
    }

    try {
        const res  = await fetch(`${API}/transferencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cbu_origen, cbu_destino, monto, descripcion })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(JSON.stringify(data.motivo || data.error));

        const montoStr = monto.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        const resultBox = document.getElementById('tr-result');
        resultBox.className = 'result-box show';
        resultBox.innerHTML = `
            <div style="color:var(--success);margin-bottom:14px;font-size:13px">
                ✓ Transferencia autorizada por el Banco Central
            </div>
            <div class="result-row">
                <span class="rl">CBU origen</span>
                <span class="rv mono-val">${cbu_origen}</span>
            </div>
            <div class="result-row">
                <span class="rl">CBU destino</span>
                <span class="rv mono-val">${cbu_destino}</span>
            </div>
            ${descripcion ? `<div class="result-row"><span class="rl">Descripción</span><span class="rv" style="color:var(--muted)">${descripcion}</span></div>` : ''}
            <div class="result-row total">
                <span class="rl">Monto transferido</span>
                <span class="rv">$${montoStr}</span>
            </div>
        `;
        toast('Transferencia realizada con éxito.');

    } catch (e) {
        toast('Transferencia rechazada: ' + e.message, 'error');
        document.getElementById('tr-result').className = 'result-box';
    }
}

// ── Movimientos ───────────────────────────────────────────────────────────────

async function cargarMovimientos() {
    const id = document.getElementById('mov-id').value;
    if (!id) { toast('Ingresá un ID de cuenta.', 'error'); return; }

    try {
        const res  = await fetch(`${API}/movimientos/${id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        const tabla = document.getElementById('mov-tabla');
        const tbody = document.getElementById('tbody-movimientos');
        tabla.style.display = 'block';

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Sin movimientos registrados para esta cuenta.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(m => {
            const esIngreso = m.tipo_movimiento.includes('INGRESO') || m.tipo_movimiento.includes('DEPOSITO');
            const signo     = esIngreso ? '+' : '-';
            const cls       = esIngreso ? 'mov-in' : 'mov-out';
            const fecha     = new Date(m.fecha).toLocaleString('es-AR', {
                day:    '2-digit',
                month:  '2-digit',
                year:   'numeric',
                hour:   '2-digit',
                minute: '2-digit'
            });
            const monto = parseFloat(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 });
            const tipo  = m.tipo_movimiento.replace(/_/g, ' ');

            return `<tr>
                <td class="mono-val" style="font-size:12px">${fecha}</td>
                <td><span class="mov-pill ${cls}">${tipo}</span></td>
                <td class="mono-val" style="color:${esIngreso ? 'var(--success)' : 'var(--danger)'}">
                    ${signo} $${monto}
                </td>
                <td style="color:var(--muted);font-size:12px">${m.descripcion || '—'}</td>
            </tr>`;
        }).join('');

    } catch (e) {
        toast('Error al cargar movimientos: ' + e.message, 'error');
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function copiar(texto) {
    navigator.clipboard.writeText(texto)
        .then(() => toast('CBU copiado al portapapeles.'))
        .catch(() => toast('No se pudo copiar.', 'error'));
}

// ── Inicio ────────────────────────────────────────────────────────────────────

cargarClientes();   