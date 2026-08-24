import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const ACCIONES = [
  { to: '/transferencias', icon: 'send',    label: 'Transferir' },
  { to: '/depositos',      icon: 'deposit', label: 'Depositar' },
  { to: '/prestamos',      icon: 'loan',    label: 'Préstamos' },
  { to: '/perfil',         icon: 'user',    label: 'Mi perfil' },
];

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [abriendoUsd, setAbriendoUsd] = useState(false);
  const [errorUsd, setErrorUsd]     = useState('');
  const navigate = useNavigate();

  const cargarCuentas = async () => {
    try {
      const productos = await api.get(`/personas/${usuario.id}/productos`);
      const cuentasRes = await api.get('/tablas/cuentas_bancarias');
      const misCuentas = productos.data
        .filter((p) => p.tipo === 'CAJA_AHORRO')
        .map((p) => cuentasRes.data.find((c) => c.id_producto === p.id_producto))
        .filter(Boolean)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {cuentas.map((c, i) => (
            <TarjetaCuenta key={c.cbu} cuenta={c} claseAnim={`anim-up-${Math.min(i + 1, 3)}`} onAliasActualizado={cargarCuentas} />
          ))}

          {!tieneUsd && (
            <div className="card anim-up-2" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div className="quick-action-icon" style={{ flexShrink: 0 }}>
                <Icon name="loan" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Abrí una caja en dólares</p>
                <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                  Tené un CBU y alias propios en USD, independientes de tu cuenta en pesos.
                </p>
              </div>
              <button className="btn-outline-green" onClick={abrirCuentaUsd} disabled={abriendoUsd}>
                {abriendoUsd ? 'Abriendo…' : 'Abrir caja en USD'}
              </button>
            </div>
          )}
          {errorUsd && (
            <div className="alert alert-error" style={{ marginBottom: 0 }}>
              <Icon name="alert" size={16} /> <span>{errorUsd}</span>
            </div>
          )}
        </div>
      )}

      {/* Acciones rápidas */}
      <h3 className="section-title anim-up-2">Acciones rápidas</h3>
      <div className="quick-grid anim-up-2">
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

      {/* Banner sostenible */}
      <div className="card anim-up-3" style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="quick-action-icon" style={{ flexShrink: 0 }}>
          <Icon name="leaf" size={22} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Banco sostenible</p>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="balance-label">Caja de ahorro en {cuenta.moneda}</p>
          <h2 className="balance-amount">
            {verSaldo ? <>{simbolo} {entero}<span className="cents">,{centavos}</span></> : `${simbolo} ••••••`}
          </h2>
        </div>
        <button className="btn-eye" onClick={() => setVerSaldo(!verSaldo)} title={verSaldo ? 'Ocultar saldo' : 'Mostrar saldo'}>
          <Icon name={verSaldo ? 'eye' : 'eyeOff'} size={18} />
        </button>
      </div>

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
