import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

export default function AdminPage() {
  const [cuentas, setCuentas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [busqueda, setBusqueda]     = useState('');
  const [actualizando, setActualizando] = useState(null); // id_producto en curso

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError('');
      try {
        const res = await api.get('/admin/cuentas');
        setCuentas(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'No se pudieron cargar las cuentas');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const cambiarEstado = async (cuenta, estado) => {
    const verbo = estado === 'BLOQUEADO' ? 'bloquear' : estado === 'CERRADO' ? 'cerrar' : 'reactivar';
    if (!window.confirm(`¿Seguro que queres ${verbo} la cuenta de ${cuenta.nombre} ${cuenta.apellido} (${cuenta.cbu})?`)) {
      return;
    }

    setError('');
    setActualizando(cuenta.id_producto);
    try {
      await api.put(`/admin/cuentas/${cuenta.id_producto}/estado`, { estado });
      setCuentas((prev) => prev.map((c) => (
        c.id_producto === cuenta.id_producto ? { ...c, estado } : c
      )));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el estado de la cuenta');
    } finally {
      setActualizando(null);
    }
  };

  const eliminarCuenta = async (cuenta) => {
    const confirmacion = window.confirm(
      `Esto ELIMINA PARA SIEMPRE la cuenta de ${cuenta.nombre} ${cuenta.apellido} (${cuenta.cbu}) ` +
      `junto con todo su historial de movimientos. No se puede deshacer.\n\n` +
      `Solo funciona si el saldo es $0 y no tiene tarjetas de credito activas. ¿Confirmas?`
    );
    if (!confirmacion) return;

    setError('');
    setActualizando(cuenta.id_producto);
    try {
      await api.delete(`/admin/cuentas/${cuenta.id_producto}`);
      setCuentas((prev) => prev.filter((c) => c.id_producto !== cuenta.id_producto));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la cuenta');
    } finally {
      setActualizando(null);
    }
  };

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter((c) =>
      `${c.nombre} ${c.apellido} ${c.dni} ${c.cbu} ${c.alias || ''}`.toLowerCase().includes(q)
    );
  }, [cuentas, busqueda]);

  const totales = useMemo(() => ({
    total: cuentas.length,
    activas: cuentas.filter((c) => c.estado === 'ACTIVO').length,
    bloqueadas: cuentas.filter((c) => c.estado === 'BLOQUEADO').length,
  }), [cuentas]);

  const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  const badgeClase = (estado) =>
    estado === 'ACTIVO' ? 'in' : estado === 'BLOQUEADO' ? 'warn' : 'out';

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Panel de administrador</h1>
        <p className="page-sub">Gestioná el estado de las cuentas de todos los clientes.</p>
      </div>

      <div className="stats-grid anim-up-1">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--surface-2)', color: 'var(--mint)', border: '1px solid var(--border)' }}>
            <Icon name="shield" size={19} />
          </div>
          <div>
            <p className="stat-label">Cuentas totales</p>
            <p className="stat-value">{totales.total}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52,211,153,0.13)', color: 'var(--green-bright)', border: '1px solid var(--ok-border)' }}>
            <Icon name="check" size={19} />
          </div>
          <div>
            <p className="stat-label">Activas</p>
            <p className="stat-value" style={{ color: 'var(--green-bright)' }}>{totales.activas}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>
            <Icon name="lock" size={19} />
          </div>
          <div>
            <p className="stat-label">Bloqueadas</p>
            <p className="stat-value" style={{ color: 'var(--warn)' }}>{totales.bloqueadas}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="field anim-up-1" style={{ maxWidth: 380 }}>
        <div className="input-icon-wrap">
          <Icon name="search" size={17} />
          <input
            className="input"
            placeholder="Buscar por nombre, DNI, CBU o alias…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {cargando && (
        <div className="loading-center">
          <div className="spinner" />
          Cargando cuentas…
        </div>
      )}

      {!cargando && filtradas.length === 0 && (
        <div className="empty anim-up-2">
          <div className="empty-icon">
            <Icon name="inbox" size={28} />
          </div>
          <p>No se encontraron cuentas</p>
        </div>
      )}

      <div className="anim-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtradas.map((c) => (
          <div key={c.id_cuenta} className="tx-item" style={{ flexWrap: 'wrap' }}>
            <div className={`tx-icon ${c.estado === 'ACTIVO' ? 'in' : 'out'}`}>
              <Icon name="user" size={19} />
            </div>
            <div className="tx-info">
              <p className="tx-desc">{c.nombre} {c.apellido} · DNI {c.dni}</p>
              <p className="tx-date">{c.tipo} · {c.cbu}{c.alias ? ` · ${c.alias}` : ''}</p>
            </div>
            <div className="tx-right">
              <p className="tx-amount" style={{ color: 'var(--text)' }}>$ {fmt(c.saldo)}</p>
              <span className={`tx-badge ${badgeClase(c.estado)}`}>{c.estado}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', marginTop: 10 }}>
              {c.estado !== 'ACTIVO' && (
                <button
                  className="btn-outline-green"
                  disabled={actualizando === c.id_producto}
                  onClick={() => cambiarEstado(c, 'ACTIVO')}
                >
                  Reactivar
                </button>
              )}
              {c.estado !== 'BLOQUEADO' && (
                <button
                  className="btn-ghost"
                  disabled={actualizando === c.id_producto}
                  onClick={() => cambiarEstado(c, 'BLOQUEADO')}
                >
                  Bloquear
                </button>
              )}
              {c.estado !== 'CERRADO' && (
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--red)' }}
                  disabled={actualizando === c.id_producto}
                  onClick={() => cambiarEstado(c, 'CERRADO')}
                >
                  Cerrar
                </button>
              )}
              <button
                className="btn-ghost"
                style={{ color: 'var(--red)', fontWeight: 700 }}
                disabled={actualizando === c.id_producto}
                title="Elimina la cuenta y sus movimientos para siempre. Requiere saldo $0 y sin tarjetas de credito activas."
                onClick={() => eliminarCuenta(c)}
              >
                Eliminar para siempre
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
