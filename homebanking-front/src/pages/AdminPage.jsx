import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const ESTADO_PRESTAMO_LABEL = { ACTIVO: 'Al día', CERRADO: 'Pagado', BLOQUEADO: 'En mora' };
const ESTADO_TARJETA_LABEL = { ACTIVO: 'Activa', CERRADO: 'Cerrada', BLOQUEADO: 'Bloqueada' };

export default function AdminPage() {
  const [cuentas, setCuentas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [busqueda, setBusqueda]     = useState('');
  const [actualizando, setActualizando] = useState(null); // id_producto en curso

  const [prestamos, setPrestamos]             = useState([]);
  const [cargandoPrestamos, setCargandoPrestamos] = useState(true);
  const [marcandoMora, setMarcandoMora]       = useState(null); // id_prestamo en curso

  const [tarjetas, setTarjetas]               = useState([]);
  const [cargandoTarjetas, setCargandoTarjetas] = useState(true);

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
    cargarPrestamos();
    cargarTarjetas();
  }, []);

  const cargarTarjetas = async () => {
    setCargandoTarjetas(true);
    try {
      const res = await api.get('/admin/tarjetas');
      setTarjetas(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las tarjetas');
    } finally {
      setCargandoTarjetas(false);
    }
  };

  const cargarPrestamos = async () => {
    setCargandoPrestamos(true);
    try {
      const res = await api.get('/admin/prestamos');
      setPrestamos(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los prestamos');
    } finally {
      setCargandoPrestamos(false);
    }
  };

  const marcarEnMora = async (prestamo) => {
    if (!window.confirm(
      `Esto marca el prestamo de ${prestamo.nombre} ${prestamo.apellido} (DNI ${prestamo.dni}) como EN MORA ` +
      `y lo informa a la Central de Deudores por $ ${fmt(prestamo.saldo_pendiente)} (situacion 4). ¿Confirmas?`
    )) return;

    setError('');
    setMarcandoMora(prestamo.id_prestamo);
    try {
      await api.put(`/admin/prestamos/${prestamo.id_prestamo}/mora`);
      setPrestamos((prev) => prev.map((p) => (
        p.id_prestamo === prestamo.id_prestamo ? { ...p, estado: 'BLOQUEADO' } : p
      )));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo marcar el prestamo en mora');
    } finally {
      setMarcandoMora(null);
    }
  };

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

      <h3 className="section-title anim-up-3">Préstamos</h3>

      {cargandoPrestamos && (
        <div className="loading-center">
          <div className="spinner" />
          Cargando préstamos…
        </div>
      )}

      {!cargandoPrestamos && prestamos.length === 0 && (
        <div className="empty anim-up-3">
          <div className="empty-icon"><Icon name="loan" size={26} /></div>
          <p>Todavía no se otorgó ningún préstamo</p>
        </div>
      )}

      <div className="anim-up-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {prestamos.map((p) => {
          const badge = p.estado === 'ACTIVO' ? 'in' : p.estado === 'BLOQUEADO' ? 'warn' : 'out';
          const vencida = p.estado === 'ACTIVO' && p.fecha_proximo_vencimiento
            && new Date(p.fecha_proximo_vencimiento) < new Date().setHours(0, 0, 0, 0);
          return (
            <div key={p.id_prestamo} className="tx-item" style={{ flexWrap: 'wrap' }}>
              <div className={`tx-icon ${p.estado === 'BLOQUEADO' ? 'out' : 'in'}`}>
                <Icon name="loan" size={19} />
              </div>
              <div className="tx-info">
                <p className="tx-desc">{p.nombre} {p.apellido} · DNI {p.dni}</p>
                <p className="tx-date">
                  {p.cuotas_pagadas}/{p.cuotas_totales} cuotas · saldo $ {fmt(p.saldo_pendiente)}
                  {p.estado === 'ACTIVO' && p.fecha_proximo_vencimiento && (
                    <span style={{ color: vencida ? 'var(--red)' : 'inherit' }}>
                      {' '}· vence {new Date(p.fecha_proximo_vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                      {vencida ? ' (vencida)' : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="tx-right">
                <p className="tx-amount" style={{ color: 'var(--text)' }}>$ {fmt(p.monto)}</p>
                <span className={`tx-badge ${badge}`}>{ESTADO_PRESTAMO_LABEL[p.estado] || p.estado}</span>
              </div>
              {p.estado === 'ACTIVO' && (
                <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    className="btn-ghost"
                    style={{ color: 'var(--red)' }}
                    disabled={marcandoMora === p.id_prestamo}
                    onClick={() => marcarEnMora(p)}
                  >
                    {marcandoMora === p.id_prestamo ? 'Informando…' : 'Marcar en mora'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="section-title anim-up-3">Tarjetas de crédito</h3>

      {cargandoTarjetas && (
        <div className="loading-center">
          <div className="spinner" />
          Cargando tarjetas…
        </div>
      )}

      {!cargandoTarjetas && tarjetas.length === 0 && (
        <div className="empty anim-up-3">
          <div className="empty-icon"><Icon name="card" size={26} /></div>
          <p>Todavía no se emitió ninguna tarjeta</p>
        </div>
      )}

      <div className="anim-up-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tarjetas.map((t) => {
          const badge = t.estado === 'ACTIVO' ? 'in' : t.estado === 'BLOQUEADO' ? 'warn' : 'out';
          return (
            <div key={t.id_tarjeta} className="tx-item" style={{ flexWrap: 'wrap' }}>
              <div className={`tx-icon ${t.estado === 'BLOQUEADO' ? 'out' : 'in'}`}>
                <Icon name="card" size={19} />
              </div>
              <div className="tx-info">
                <p className="tx-desc">{t.nombre} {t.apellido} · DNI {t.dni}</p>
                <p className="tx-date">
                  {t.marca} ···· {String(t.numero_tarjeta).slice(-4)} · consumido $ {fmt(t.saldo_consumido)} de $ {fmt(t.limite_compra)}
                </p>
              </div>
              <div className="tx-right">
                <span className={`tx-badge ${badge}`}>{ESTADO_TARJETA_LABEL[t.estado] || t.estado}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
