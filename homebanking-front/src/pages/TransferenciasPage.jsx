import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const esCbu = (v) => /^\d{22}$/.test(v.trim());

// El Banco Central puede devolver distintos formatos: parseamos defensivo
function parseDestinatario(data, entradaOriginal) {
  const d = data?.persona || data?.person || data || {};
  const nombre =
    d.nombre && d.apellido ? `${d.nombre} ${d.apellido}` :
    d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` :
    d.fullName || d.name || d.nombre || 'Destinatario verificado';
  const cbu = d.cbu || d.CBU || (esCbu(entradaOriginal) ? entradaOriginal.trim() : null);
  const banco = d.banco || d.bank || d.bankName || d.nombre_banco || null;
  return { nombre, cbu, alias: d.alias || null, banco };
}

const inicialesDe = (nombre) =>
  nombre.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

export default function TransferenciasPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [cbuOrigen, setCbuOrigen]     = useState('');
  const [saldoActual, setSaldoActual] = useState(null);

  // Vista: lista de contactos (estilo MP) o formulario
  const [vista, setVista] = useState('contactos');

  // Contactos
  const [contactos, setContactos]         = useState([]);
  const [cargandoContactos, setCargandoContactos] = useState(true);
  const [busqueda, setBusqueda]           = useState('');
  const [chip, setChip]                   = useState('todos');
  const [favoritos, setFavoritos]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('tb_favoritos') || '[]'); }
    catch { return []; }
  });

  // Formulario
  const [destino, setDestino]           = useState('');
  const [destinatario, setDestinatario] = useState(null);
  const [buscando, setBuscando]         = useState(false);
  const [monto, setMonto]               = useState('');
  const [descripcion, setDescripcion]   = useState('');
  const [confirmando, setConfirmando]   = useState(false);
  const [comprobante, setComprobante]   = useState(null);
  const [error, setError]               = useState('');
  const [enviando, setEnviando]         = useState(false);

  // Guarda siempre el ultimo valor de "destino" para poder comparar contra el
  // que tenia el campo cuando se disparo una verificacion async: si el usuario
  // edita el CBU/alias mientras la respuesta todavia esta en vuelo, esa
  // respuesta queda obsoleta y no debe pisar el destinatario ya verificado.
  const destinoRef = useRef(destino);
  useEffect(() => { destinoRef.current = destino; }, [destino]);

  // ── Cargar cuenta propia + contactos ──
  // Los "contactos" son solo la gente con la que ya hiciste una transferencia
  // (enviada o recibida), no todos los clientes del banco.
  useEffect(() => {
    const cargar = async () => {
      try {
        // Las transferencias salen siempre de la caja en ARS (si la persona tambien
        // tiene caja en USD, esta busqueda la ignora a proposito: no alcanza con
        // "el primer producto", hay que pedir puntualmente el que es CAJA_AHORRO + ARS)
        // /productos ya viene con cbu, saldo y moneda de cada cuenta propia
        const productos = await api.get(`/personas/${usuario.id}/productos`);
        const miCuenta = productos.data.find(
          p => p.tipo === 'CAJA_AHORRO' && p.moneda === 'ARS' && p.cbu
        );
        if (miCuenta) { setCbuOrigen(miCuenta.cbu); setSaldoActual(miCuenta.saldo); }

        const contactosRes = await api.get(`/personas/${usuario.id}/contactos`);
        setContactos(contactosRes.data.map(c => ({ nombre: c.nombre || c.cbu, cbu: c.cbu, alias: null })));
      } catch {
        setError('No se pudo conectar con el banco. Verificá que el backend esté corriendo.');
      } finally {
        setCargandoContactos(false);
      }
    };
    cargar();
  }, [usuario]);

  // ── Favoritos (localStorage) ──
  const toggleFavorito = (e, cbu) => {
    e.stopPropagation();
    setFavoritos(prev => {
      const nuevos = prev.includes(cbu) ? prev.filter(f => f !== cbu) : [...prev, cbu];
      localStorage.setItem('tb_favoritos', JSON.stringify(nuevos));
      return nuevos;
    });
  };

  const contactosFiltrados = contactos.filter(c => {
    const coincide = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.alias || '').toLowerCase().includes(busqueda.toLowerCase());
    const pasaChip = chip === 'todos' || favoritos.includes(c.cbu);
    return coincide && pasaChip;
  });

  // ── Elegir contacto → ir al formulario con destinatario verificado ──
  const elegirContacto = (c) => {
    setDestinatario({ nombre: c.nombre, cbu: c.cbu, alias: c.alias, banco: 'Tree Bank' });
    setDestino(c.cbu);
    setError('');
    setVista('form');
  };

  const nuevaCuenta = () => {
    setDestinatario(null);
    setDestino('');
    setError('');
    setVista('form');
  };

  // ── Verificación por CBU/alias (requisito 4.4) ──
  const handleDestinoChange = (v) => {
    setDestino(v);
    setDestinatario(null);
    setError('');
  };

  const verificarDestino = async () => {
    const entrada = destino.trim();
    setError('');

    if (!esCbu(entrada) && entrada.length < 3) {
      return setError('Ingresá un CBU de 22 dígitos o un alias (mínimo 3 caracteres)');
    }
    if (entrada === cbuOrigen) {
      return setError('No podés transferirte a tu propia cuenta');
    }

    setBuscando(true);

    try {
      const ruta = esCbu(entrada)
        ? `/personas/${entrada}/buscar`
        : `/personas/alias/${encodeURIComponent(entrada)}`;
      const res = await api.get(ruta);

      // Si el usuario ya cambió el campo mientras esta respuesta estaba en
      // vuelo, quedó obsoleta: no hay que completar el destinatario con datos
      // de un CBU/alias distinto al que está escrito ahora (podría terminar
      // confirmándose una transferencia a la cuenta vieja sin que se note).
      if (destinoRef.current.trim() !== entrada) return null;

      const dest = parseDestinatario(res.data, entrada);
      if (!dest.cbu) {
        setError('Se encontró el destinatario pero no su CBU. Probá con el CBU directamente.');
        return null;
      }
      setDestinatario(dest);
      return dest;
    } catch (err) {
      if (destinoRef.current.trim() !== entrada) return null;
      setError(err.response?.data?.error || 'No se encontró ese CBU/alias');
      return null;
    } finally {
      setBuscando(false);
    }
  };

  const handleContinuar = async (e) => {
    e.preventDefault();
    setError('');
    if (Number(monto) <= 0) return setError('El monto debe ser mayor a 0');
    if (saldoActual !== null && Number(monto) > Number(saldoActual)) return setError('Saldo insuficiente');

    let dest = destinatario;
    if (!dest) dest = await verificarDestino();
    if (dest) setConfirmando(true);
  };

  const handleConfirmar = async () => {
    setEnviando(true);
    setError('');

    try {
      const res = await api.post('/transferencias', {
        cbu_origen: cbuOrigen,
        cbu_destino: destinatario.cbu,
        monto: Number(monto),
        descripcion,
      });
      setComprobante({
        id: res.data.ticket?.transaccionId || res.data.ticket?._id || res.data.id || '—',
        fecha: new Date(),
        destinatario,
        monto: Number(monto),
        descripcion,
        cbuOrigen,
      });
      setSaldoActual(prev => Number(prev) - Number(monto));
      setConfirmando(false);
      setMonto(''); setDestino(''); setDescripcion(''); setDestinatario(null);
    } catch (err) {
      setConfirmando(false);
      setError(err.response?.data?.error || err.response?.data?.motivo || 'Transferencia rechazada');
    } finally {
      setEnviando(false);
    }
  };

  const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const fmtFecha = (d) =>
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <AppLayout>
      {/* ── Pestañas estilo MP ── */}
      <div className="tabs anim-up">
        <button className="tab active">Transferir</button>
        <button className="tab" onClick={() => navigate('/historial')}>Actividad</button>
      </div>

      {/* ════════ VISTA CONTACTOS ════════ */}
      {vista === 'contactos' && (
        <>
          <button className="row-card anim-up-1" onClick={nuevaCuenta}>
            <div className="row-card-icon"><Icon name="userPlus" size={21} /></div>
            <span className="row-card-label">A una nueva cuenta</span>
            <Icon name="chevronRight" size={19} className="chevron" />
          </button>

          <h3 className="section-title anim-up-2">Contactos</h3>

          <div className="search-wrap anim-up-2">
            <Icon name="search" size={17} />
            <input
              className="input"
              type="text"
              placeholder="Buscá por nombre o alias"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="chips anim-up-2">
            <button className={`chip${chip === 'todos' ? ' active' : ''}`} onClick={() => setChip('todos')}>
              Todos
            </button>
            <button className={`chip${chip === 'favoritos' ? ' active' : ''}`} onClick={() => setChip('favoritos')}>
              Favoritos
            </button>
          </div>

          {error && (
            <div className="alert alert-error">
              <Icon name="alert" size={16} /> {error}
            </div>
          )}

          {cargandoContactos && (
            <div className="loading-center">
              <div className="spinner" />
              Cargando contactos…
            </div>
          )}

          {!cargandoContactos && contactosFiltrados.length === 0 && (
            <div className="empty anim-up-2">
              <div className="empty-icon"><Icon name="user" size={26} /></div>
              <p>
                {chip === 'favoritos'
                  ? 'Todavía no marcaste favoritos (tocá la estrella)'
                  : contactos.length === 0
                    ? 'Todavía no transferiste con nadie. Usá "A una nueva cuenta" para tu primera transferencia.'
                    : 'No se encontraron contactos con ese nombre o alias'}
              </p>
            </div>
          )}

          <div className="contact-list anim-up-3">
            {contactosFiltrados.map((c) => (
              <button key={c.cbu} className="contact-item" onClick={() => elegirContacto(c)}>
                <div className="contact-avatar">{inicialesDe(c.nombre)}</div>
                <div className="contact-info">
                  <p className="contact-name">{c.nombre}</p>
                  <p className="contact-alias">{c.alias || c.cbu}</p>
                </div>
                <span
                  className={`star-btn${favoritos.includes(c.cbu) ? ' active' : ''}`}
                  onClick={(e) => toggleFavorito(e, c.cbu)}
                  title={favoritos.includes(c.cbu) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  role="button"
                >
                  <Icon name="star" size={17} />
                </span>
                <Icon name="chevronRight" size={19} className="chevron" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ════════ VISTA FORMULARIO ════════ */}
      {vista === 'form' && (
        <>
          <button className="btn-ghost anim-up" onClick={() => setVista('contactos')} style={{ marginBottom: 18 }}>
            <Icon name="arrowLeft" size={16} /> Contactos
          </button>

          {/* Cuenta de origen */}
          <div className="card anim-up-1" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="quick-action-icon" style={{ flexShrink: 0 }}>
              <Icon name="swap" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p className="info-row-label">Desde tu cuenta</p>
              <p style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>
                {cbuOrigen || 'Cargando…'}
              </p>
            </div>
            {saldoActual !== null && (
              <div style={{ textAlign: 'right' }}>
                <p className="info-row-label">Disponible</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--green-bright)' }}>
                  $ {fmt(saldoActual)}
                </p>
              </div>
            )}
          </div>

          {/* Formulario */}
          <div className="card anim-up-2">
            <form onSubmit={handleContinuar}>
              <div className="field">
                <label className="label">CBU o alias del destinatario</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="22 dígitos o alias (ej: maria.garcia.tb)"
                    value={destino}
                    onChange={(e) => handleDestinoChange(e.target.value)}
                    disabled={buscando}
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-outline-green"
                    onClick={verificarDestino}
                    disabled={buscando || !destino.trim()}
                    style={{ flexShrink: 0 }}
                  >
                    {buscando ? 'Buscando…' : 'Verificar'}
                  </button>
                </div>
              </div>

              {destinatario && (
                <div className="recipient-card">
                  <div className="avatar avatar-sm">{inicialesDe(destinatario.nombre)}</div>
                  <div style={{ minWidth: 0 }}>
                    <p className="recipient-name">Vas a transferir a {destinatario.nombre}</p>
                    <p className="recipient-detail">
                      {destinatario.banco ? `${destinatario.banco} · ` : ''}CBU {destinatario.cbu}
                      {destinatario.alias ? ` · ${destinatario.alias}` : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="field">
                <label className="label">Monto a transferir</label>
                <div className="amount-box">
                  <span className="amount-sign">$</span>
                  <input
                    className="amount-input"
                    type="number"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">
                  Descripción <span className="optional">(opcional)</span>
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ej: Pago alquiler"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <Icon name="alert" size={16} /> {error}
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={!cbuOrigen || buscando || enviando}>
                {buscando ? 'Verificando destinatario…' : 'Continuar'}
                {!buscando && <Icon name="send" size={16} />}
              </button>
            </form>
          </div>

          <div className="alert alert-info anim-up-3" style={{ marginTop: 18 }}>
            <Icon name="lock" size={16} />
            <span>
              Las transferencias interbancarias se procesan vía Banco Central.
              Pueden demorar hasta 15 minutos en acreditarse.
            </span>
          </div>
        </>
      )}

      {/* ── Modal de confirmación ── */}
      {confirmando && destinatario && (
        <div className="modal-overlay" onClick={() => !enviando && setConfirmando(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirmá la transferencia</h3>
            <p className="modal-sub">Revisá los datos antes de enviar. Esta operación no se puede deshacer.</p>

            <div className="receipt">
              <p className="receipt-amount">$ {fmt(monto)}</p>
              <div className="receipt-row"><span className="k">Para</span><span className="v">{destinatario.nombre}</span></div>
              <div className="receipt-row"><span className="k">CBU destino</span><span className="v">{destinatario.cbu}</span></div>
              {destinatario.alias && (
                <div className="receipt-row"><span className="k">Alias</span><span className="v">{destinatario.alias}</span></div>
              )}
              <div className="receipt-row"><span className="k">Desde</span><span className="v">{cbuOrigen}</span></div>
              {descripcion && (
                <div className="receipt-row"><span className="k">Descripción</span><span className="v">{descripcion}</span></div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmando(false)} disabled={enviando}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ flex: 1.4, width: 'auto' }} onClick={handleConfirmar} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de comprobante ── */}
      {comprobante && (
        <div className="modal-overlay" onClick={() => setComprobante(null)}>
          <div className="modal print-area" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-check">
              <Icon name="check" size={28} strokeWidth={3} />
            </div>
            <h3 className="modal-title" style={{ textAlign: 'center' }}>¡Transferencia exitosa!</h3>
            <p className="modal-sub" style={{ textAlign: 'center' }}>Comprobante de la operación</p>

            <div className="receipt">
              <p className="receipt-amount">$ {fmt(comprobante.monto)}</p>
              <div className="receipt-row"><span className="k">N° operación</span><span className="v">{comprobante.id}</span></div>
              <div className="receipt-row"><span className="k">Fecha</span><span className="v">{fmtFecha(comprobante.fecha)}</span></div>
              <div className="receipt-row"><span className="k">Para</span><span className="v">{comprobante.destinatario.nombre}</span></div>
              <div className="receipt-row"><span className="k">CBU destino</span><span className="v">{comprobante.destinatario.cbu}</span></div>
              <div className="receipt-row"><span className="k">Desde</span><span className="v">{comprobante.cbuOrigen}</span></div>
              {comprobante.descripcion && (
                <div className="receipt-row"><span className="k">Descripción</span><span className="v">{comprobante.descripcion}</span></div>
              )}
              <div className="receipt-row"><span className="k">Entidad</span><span className="v">Tree Bank</span></div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 12 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setComprobante(null)}>
                Cerrar
              </button>
              <button className="btn-primary" style={{ flex: 1.4, width: 'auto' }} onClick={() => window.print()}>
                Imprimir / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
