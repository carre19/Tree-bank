import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

// Solo lo que no está ya en el sidebar/bottom nav (Inicio, Transferir,
// Mi perfil, Movimientos), para no repetir los mismos accesos dos veces.
const ACCIONES = [
  { to: '/depositos',      icon: 'deposit', label: 'Depositar' },
  { to: '/cambio',         icon: 'swap',    label: 'Cambio' },
  { to: '/prestamos',      icon: 'loan',      label: 'Préstamos' },
  { to: '/tarjetas',       icon: 'card',      label: 'Tarjetas' },
  { to: '/seguros',        icon: 'insurance', label: 'Seguros' },
  { to: '/servicios',      icon: 'receipt',   label: 'Servicios' },
  { to: '/recargas',       icon: 'phone',     label: 'Recargar' },
  { to: '/inversiones',    icon: 'trending',  label: 'Inversiones' },
  { to: '/reservas',       icon: 'vault',     label: 'Reservas' },
];

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [abriendoUsd, setAbriendoUsd] = useState(false);
  const [errorUsd, setErrorUsd]     = useState('');
  const [tarjetas, setTarjetas]     = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Tarjetas es una sección secundaria del dashboard: si falla, no bloquea
    // el resto de la pantalla, pero el error queda en la consola en vez de
    // desaparecer en silencio (para poder diagnosticar un token vencido, el
    // backend caído, etc. sin adivinar por qué la sección quedó vacía).
    api.get('/tarjetas').then((res) => setTarjetas(res.data)).catch((err) => {
      console.error('No se pudieron cargar las tarjetas del dashboard:', err.response?.data?.error || err.message);
    });
  }, []);

  const cargarCuentas = async () => {
    try {
      // /productos ya viene con cbu, saldo y moneda de cada cuenta propia
      const productos = await api.get(`/personas/${usuario.id}/productos`);
      const misCuentas = productos.data
        .filter((p) => p.tipo === 'CAJA_AHORRO' && p.cbu)
        // ARS primero, siempre: es la cuenta principal
        .sort((a, b) => (a.moneda === 'ARS' ? -1 : b.moneda === 'ARS' ? 1 : 0));
      setCuentas(misCuentas);
    } catch {
      setErrorCarga('No se pudo conectar con el banco. Verificá que el backend esté corriendo.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarCuentas(); }, [usuario]);

  const tieneUsd = cuentas.some((c) => c.moneda === 'USD');

  const abrirCuentaUsd = async () => {
    setErrorUsd('');
    setAbriendoUsd(true);
    try {
      await api.post('/cuentas', { moneda: 'USD' });
      await cargarCuentas();
    } catch (err) {
      setErrorUsd(err.response?.data?.error || 'No se pudo abrir la caja en dólares');
    } finally {
      setAbriendoUsd(false);
    }
  };

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buen día' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">{saludo}, {usuario?.nombre}</h1>
        <p className="page-sub">Este es el resumen de tu cuenta.</p>
      </div>

      {errorCarga && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} />
          <span>{errorCarga}</span>
        </div>
      )}

      {cargando ? (
        <div className="balance-card anim-up-1">
          <p className="balance-label">Saldo disponible</p>
          <div className="skeleton" style={{ width: 220, height: 46 }} />
        </div>
      ) : (
        <>
          {/* Panel fusionado: el degradé de la cuenta sigue hasta los accesos
              rapidos, en vez de cortar en una tarjeta separada (como el Home
              de una app de fintech, donde las acciones "viven" en el header) */}
          <div className="hero-panel anim-up-1">
            {cuentas.map((c) => (
              <TarjetaCuenta key={c.cbu} cuenta={c} claseAnim="" onAliasActualizado={cargarCuentas} />
            ))}

            <div className="quick-panel">
              <div className="quick-panel-label">Acciones rápidas</div>
              <div className="quick-grid">
                {ACCIONES.map((a) => (
                  <div key={a.to} className="quick-action" onClick={() => navigate(a.to)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(a.to)}>
                    <div className="quick-action-icon">
                      <Icon name={a.icon} size={22} />
                    </div>
                    <span className="quick-action-label">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cards-preview dash-panel anim-up-2">
            <button className="cards-preview-head" onClick={() => navigate('/tarjetas')}>
              <span>Tarjetas</span>
              <Icon name="chevronRight" size={16} />
            </button>
            <div className="cards-preview-row">
              {tarjetas.filter((t) => t.estado !== 'CERRADO').slice(0, 2).map((t) => (
                <button
                  key={t.id_tarjeta}
                  className={`card-swatch ${t.marca === 'MASTERCARD' ? 'card-swatch-mc' : ''}`}
                  onClick={() => navigate('/tarjetas')}
                >
                  <span className="card-swatch-brand">{t.marca}</span>
                  <span className="card-swatch-num">•••• {String(t.numero_tarjeta).slice(-4)}</span>
                </button>
              ))}
              <button className="card-swatch card-swatch-add" onClick={() => navigate('/tarjetas')}>
                <span className="card-swatch-plus">+</span>
                <span>{tarjetas.some((t) => t.estado !== 'CERRADO') ? 'Nueva tarjeta' : 'Emitir tarjeta'}</span>
              </button>
            </div>
          </div>

          {!tieneUsd && (
            <div className="dash-panel anim-up-2" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
              <div className="quick-action-icon" style={{ flexShrink: 0 }}>
                <Icon name="loan" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Abrí una caja en dólares</p>
                <p className="dash-panel-sub" style={{ fontSize: 13 }}>
                  Tené un CBU y alias propios en USD, independientes de tu cuenta en pesos.
                </p>
              </div>
              <button className="btn-outline-green" onClick={abrirCuentaUsd} disabled={abriendoUsd}>
                {abriendoUsd ? 'Abriendo…' : 'Abrir caja en USD'}
              </button>
            </div>
          )}
          {errorUsd && (
            <div className="alert alert-error" style={{ marginBottom: 0, marginTop: 18 }}>
              <Icon name="alert" size={16} /> <span>{errorUsd}</span>
            </div>
          )}
        </>
      )}

      {/* Banner sostenible */}
      <div className="dash-panel anim-up-3" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="quick-action-icon" style={{ flexShrink: 0 }}>
          <Icon name="leaf" size={22} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Banco sostenible</p>
          <p className="dash-panel-sub" style={{ fontSize: 13 }}>
            Tree Bank planta un árbol por cada cuenta activa.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

// Una tarjeta de saldo por cuenta (ARS o USD), cada una con su propio
// CBU, alias y estado de edición — así una persona con dos cajas ve las dos.
function TarjetaCuenta({ cuenta, claseAnim, onAliasActualizado }) {
  const [verSaldo, setVerSaldo] = useState(true);
  const [copiado, setCopiado]   = useState('');

  const [editandoAlias, setEditandoAlias]   = useState(false);
  const [nuevoAlias, setNuevoAlias]         = useState('');
  const [guardandoAlias, setGuardandoAlias] = useState(false);
  const [aliasError, setAliasError]         = useState('');
  const [aliasExito, setAliasExito]         = useState(false);

  const copiar = async (texto, etiqueta) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(''), 1500);
    } catch { /* clipboard no disponible */ }
  };

  const empezarEdicionAlias = () => {
    setNuevoAlias(cuenta.alias || '');
    setAliasError('');
    setEditandoAlias(true);
  };

  const guardarAlias = async () => {
    const alias = nuevoAlias.trim();
    setAliasError('');
    if (alias.length < 3) {
      setAliasError('Mínimo 3 caracteres');
      return;
    }
    setGuardandoAlias(true);
    try {
      // El alias de una cuenta en USD vive en /cuentas; el de la caja en ARS
      // (que es la misma cuenta con la que se registró la persona) en /personas
      const ruta = cuenta.moneda === 'ARS' ? `/personas/${cuenta.cbu}/alias` : `/cuentas/${cuenta.cbu}/alias`;
      await api.put(ruta, { alias });
      setEditandoAlias(false);
      setAliasExito(true);
      setTimeout(() => setAliasExito(false), 2500);
      onAliasActualizado();
    } catch (err) {
      setAliasError(err.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setGuardandoAlias(false);
    }
  };

  const saldoNum = Number(cuenta.saldo || 0);
  const [entero, centavos] = saldoNum
    .toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',');
  const simbolo = cuenta.moneda === 'USD' ? 'US$' : '$';

  const inputAliasStyle = {
    background: 'rgba(255,255,255,0.9)',
    border: 'none',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 13,
    fontWeight: 600,
    color: '#14231b',
    width: 160,
    outline: 'none',
  };

  return (
    <div className={`balance-card ${claseAnim}`}>
      <button
        className="btn-eye balance-eye"
        onClick={() => setVerSaldo(!verSaldo)}
        title={verSaldo ? 'Ocultar saldo' : 'Mostrar saldo'}
      >
        <Icon name={verSaldo ? 'eye' : 'eyeOff'} size={18} />
      </button>

      <p className="balance-label">Caja de ahorro · {cuenta.moneda}</p>
      <h2 className="balance-amount">
        {verSaldo ? <>{simbolo} {entero}<span className="cents">,{centavos}</span></> : `${simbolo} ••••••`}
      </h2>

      <div className="balance-meta-row">
        <div>
          <p className="balance-meta-label">CBU</p>
          <p className="balance-meta-value">
            {cuenta.cbu}
            <button className="btn-copy" onClick={() => copiar(cuenta.cbu, 'cbu')} title="Copiar CBU">
              <Icon name={copiado === 'cbu' ? 'check' : 'copy'} size={14} />
            </button>
          </p>
        </div>
        <div>
          <p className="balance-meta-label">Alias</p>
          {!editandoAlias ? (
            <p className="balance-meta-value">
              {cuenta.alias || 'Sin alias'}
              {aliasExito && <Icon name="check" size={14} />}
              {cuenta.alias && (
                <button className="btn-copy" onClick={() => copiar(cuenta.alias, 'alias')} title="Copiar alias">
                  <Icon name={copiado === 'alias' ? 'check' : 'copy'} size={14} />
                </button>
              )}
              <button className="btn-copy" onClick={empezarEdicionAlias} title="Cambiar alias">
                <Icon name="edit" size={14} />
              </button>
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  style={inputAliasStyle}
                  value={nuevoAlias}
                  onChange={(e) => setNuevoAlias(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarAlias(); if (e.key === 'Escape') setEditandoAlias(false); }}
                  placeholder="nuevo.alias"
                  maxLength={50}
                  autoFocus
                  disabled={guardandoAlias}
                />
                <button className="btn-copy" onClick={guardarAlias} title="Guardar" disabled={guardandoAlias}>
                  <Icon name="check" size={16} />
                </button>
                <button className="btn-copy" onClick={() => setEditandoAlias(false)} title="Cancelar" disabled={guardandoAlias}>
                  <Icon name="x" size={16} />
                </button>
              </div>
              {aliasError && (
                <p style={{ fontSize: 11, color: '#fecaca', marginTop: 4, fontWeight: 600 }}>{aliasError}</p>
              )}
            </div>
          )}
        </div>
        <div>
          <p className="balance-meta-label">Moneda</p>
          <p className="balance-meta-value">{cuenta.moneda}</p>
        </div>
      </div>
    </div>
  );
}
