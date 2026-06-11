import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const ACCIONES = [
  { to: '/transferencias', icon: 'send',    label: 'Transferir' },
  { to: '/depositos',      icon: 'deposit', label: 'Depositar' },
  { to: '/historial',      icon: 'history', label: 'Movimientos' },
  { to: '/perfil',         icon: 'user',    label: 'Mi perfil' },
];

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [cuenta, setCuenta]       = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [verSaldo, setVerSaldo]   = useState(true);
  const [copiado, setCopiado]     = useState('');
  const [errorCarga, setErrorCarga] = useState('');
  const navigate = useNavigate();

  // Edición de alias (PUT /personas/:cbu/alias)
  const [editandoAlias, setEditandoAlias]   = useState(false);
  const [nuevoAlias, setNuevoAlias]         = useState('');
  const [guardandoAlias, setGuardandoAlias] = useState(false);
  const [aliasError, setAliasError]         = useState('');
  const [aliasExito, setAliasExito]         = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const productos = await api.get(`/personas/${usuario.id}/productos`);
        if (productos.data.length > 0) {
          const cuentasRes = await api.get('/tablas/cuentas_bancarias');
          const miCuenta = cuentasRes.data.find(c => c.id_producto === productos.data[0].id_producto);
          setCuenta(miCuenta);
        }
      } catch {
        setErrorCarga('No se pudo conectar con el banco. Verificá que el backend esté corriendo.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [usuario]);

  const copiar = async (texto, etiqueta) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(''), 1500);
    } catch { /* clipboard no disponible */ }
  };

  const empezarEdicionAlias = () => {
    setNuevoAlias(cuenta?.alias || '');
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
      await api.put(`/personas/${cuenta.cbu}/alias`, { alias });
      setCuenta(prev => ({ ...prev, alias }));
      setEditandoAlias(false);
      setAliasExito(true);
      setTimeout(() => setAliasExito(false), 2500);
    } catch (err) {
      setAliasError(err.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setGuardandoAlias(false);
    }
  };

  // Saldo partido en entero + centavos para tipografía jerárquica
  const saldoNum = Number(cuenta?.saldo || 0);
  const [entero, centavos] = saldoNum
    .toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',');

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buen día' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

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
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">{saludo}, {usuario?.nombre} 👋</h1>
        <p className="page-sub">Este es el resumen de tu cuenta.</p>
      </div>

      {/* Aviso de error de conexión */}
      {errorCarga && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} />
          <span>{errorCarga}</span>
        </div>
      )}

      {/* Tarjeta de saldo */}
      <div className="balance-card anim-up-1">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="balance-label">Saldo disponible</p>
            {cargando ? (
              <div className="skeleton" style={{ width: 220, height: 46 }} />
            ) : (
              <h2 className="balance-amount">
                {verSaldo ? <>$ {entero}<span className="cents">,{centavos}</span></> : '$ ••••••'}
              </h2>
            )}
          </div>
          <button className="btn-eye" onClick={() => setVerSaldo(!verSaldo)} title={verSaldo ? 'Ocultar saldo' : 'Mostrar saldo'}>
            <Icon name={verSaldo ? 'eye' : 'eyeOff'} size={18} />
          </button>
        </div>

        <div className="balance-meta-row">
          <div>
            <p className="balance-meta-label">CBU</p>
            <p className="balance-meta-value">
              {cuenta?.cbu || '—'}
              {cuenta?.cbu && (
                <button className="btn-copy" onClick={() => copiar(cuenta.cbu, 'cbu')} title="Copiar CBU">
                  <Icon name={copiado === 'cbu' ? 'check' : 'copy'} size={14} />
                </button>
              )}
            </p>
          </div>
          <div>
            <p className="balance-meta-label">Alias</p>
            {!editandoAlias ? (
              <p className="balance-meta-value">
                {cuenta?.alias || 'Sin alias'}
                {aliasExito && <Icon name="check" size={14} />}
                {cuenta?.alias && (
                  <button className="btn-copy" onClick={() => copiar(cuenta.alias, 'alias')} title="Copiar alias">
                    <Icon name={copiado === 'alias' ? 'check' : 'copy'} size={14} />
                  </button>
                )}
                {cuenta?.cbu && (
                  <button className="btn-copy" onClick={empezarEdicionAlias} title="Cambiar alias">
                    <Icon name="edit" size={14} />
                  </button>
                )}
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
            <p className="balance-meta-value">{cuenta?.moneda || 'ARS'}</p>
          </div>
        </div>
      </div>

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
