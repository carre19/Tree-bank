import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

const ESTADO_LABEL = {
  ACTIVO: 'Activa',
  CERRADO: 'Cerrada',
  BLOQUEADO: 'Bloqueada',
};

const agrupar = (numero) => String(numero).replace(/(.{4})/g, '$1 ').trim();

const formatearVencimiento = (fecha) => {
  const d = new Date(fecha);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = String(d.getFullYear()).slice(-2);
  return `${mes}/${anio}`;
};

export default function TarjetasPage() {
  const { usuario } = useAuth();
  const usuarioNombre = `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim().toUpperCase() || 'TREE BANK';
  const [tarjetas, setTarjetas] = useState([]);
  const tarjetasVisibles = tarjetas.filter((t) => t.estado !== 'CERRADO');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [vista, setVista] = useState('lista'); // 'lista' | 'emitir'
  const [marca, setMarca] = useState('VISA');
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const [operando, setOperando] = useState(null); // id_tarjeta con una accion en curso
  const [montoCompra, setMontoCompra] = useState({});
  const [montoPago, setMontoPago] = useState({});

  const cargarTarjetas = async () => {
    try {
      const res = await api.get('/tarjetas');
      setTarjetas(res.data);
    } catch {
      setError('No se pudieron cargar tus tarjetas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarTarjetas(); }, []);

  const handleEmitir = async (e) => {
    e.preventDefault();
    setResultado(null);
    setEmitiendo(true);
    try {
      const res = await api.post('/tarjetas', { marca });
      setResultado({ ok: true, mensaje: res.data.mensaje, situacion: res.data.situacion_al_otorgar });
      cargarTarjetas();
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo emitir la tarjeta' });
    } finally {
      setEmitiendo(false);
    }
  };

  const handleComprar = async (t) => {
    const monto = Number(montoCompra[t.id_tarjeta]);
    if (!monto || monto <= 0) return;
    setError('');
    setOperando(`compra-${t.id_tarjeta}`);
    try {
      await api.post(`/tarjetas/${t.id_tarjeta}/compras`, { monto, descripcion: 'Compra de prueba' });
      setMontoCompra((prev) => ({ ...prev, [t.id_tarjeta]: '' }));
      cargarTarjetas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la compra');
    } finally {
      setOperando(null);
    }
  };

  const handlePagar = async (t) => {
    const monto = Number(montoPago[t.id_tarjeta]);
    if (!monto || monto <= 0) return;
    setError('');
    setOperando(`pago-${t.id_tarjeta}`);
    try {
      await api.post(`/tarjetas/${t.id_tarjeta}/pagar-resumen`, { monto });
      setMontoPago((prev) => ({ ...prev, [t.id_tarjeta]: '' }));
      cargarTarjetas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo pagar el resumen');
    } finally {
      setOperando(null);
    }
  };

  const handleCerrar = async (t) => {
    if (!window.confirm('¿Cerrar esta tarjeta? No vas a poder volver a usarla.')) return;
    setError('');
    setOperando(`cerrar-${t.id_tarjeta}`);
    try {
      await api.post(`/tarjetas/${t.id_tarjeta}/cerrar`);
      cargarTarjetas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cerrar la tarjeta');
    } finally {
      setOperando(null);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Tarjetas de crédito</h1>
        <p className="page-sub">Emití una tarjeta, registrá compras y pagá tu resumen desde tu caja en ARS.</p>
      </div>

      <div className="tabs anim-up">
        <button className={`tab${vista === 'lista' ? ' active' : ''}`} onClick={() => setVista('lista')}>
          Mis tarjetas
        </button>
        <button className={`tab${vista === 'emitir' ? ' active' : ''}`} onClick={() => { setVista('emitir'); setResultado(null); }}>
          Emitir tarjeta
        </button>
      </div>

      {error && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} /> <span>{error}</span>
        </div>
      )}

      {/* ════════ VISTA: MIS TARJETAS ════════ */}
      {vista === 'lista' && (
        <>
          {cargando && (
            <div className="loading-center">
              <div className="spinner" />
              Cargando tarjetas…
            </div>
          )}

          {!cargando && tarjetasVisibles.length === 0 && (
            <div className="empty anim-up-1">
              <div className="empty-icon"><Icon name="card" size={26} /></div>
              <p>Todavía no tenés ninguna tarjeta de crédito</p>
            </div>
          )}

          <div className="anim-up-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tarjetasVisibles.map((t) => {
              const badge = t.estado === 'ACTIVO' ? 'in' : t.estado === 'BLOQUEADO' ? 'warn' : 'out';
              const disponible = Number(t.limite_compra) - Number(t.saldo_consumido);
              return (
                <div key={t.id_tarjeta} className="card">
                  <div className={`credit-card ${t.marca === 'MASTERCARD' ? 'credit-card-mc' : ''} ${t.estado !== 'ACTIVO' ? 'credit-card-inactive' : ''}`}>
                    <div className="credit-card-top">
                      <span className="credit-card-brand">TREE BANK</span>
                      <div className="credit-card-chip" />
                    </div>
                    <div className="credit-card-number">{agrupar(t.numero_tarjeta)}</div>
                    <div className="credit-card-mid">
                      <div>
                        <div className="credit-card-label">Vence</div>
                        <div className="credit-card-value">{formatearVencimiento(t.fecha_vencimiento)}</div>
                      </div>
                      <div>
                        <div className="credit-card-label">CVV</div>
                        <div className="credit-card-value">{t.codigo_seguridad}</div>
                      </div>
                    </div>
                    <div className="credit-card-bottom">
                      <div>
                        <div className="credit-card-label">Titular</div>
                        <div className="credit-card-value">{usuarioNombre}</div>
                      </div>
                      {t.marca === 'MASTERCARD' ? (
                        <div className="credit-card-mark-mc"><span className="c1" /><span className="c2" /></div>
                      ) : (
                        <span className="credit-card-mark">VISA</span>
                      )}
                    </div>
                    {t.estado !== 'ACTIVO' && (
                      <div className="credit-card-overlay">{ESTADO_LABEL[t.estado] || t.estado}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                      Límite $ {fmt(t.limite_compra)} · Disponible $ {fmt(disponible)}
                    </p>
                    <span className={`tx-badge ${badge}`}>{ESTADO_LABEL[t.estado] || t.estado}</span>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                      <span>Consumido del resumen</span>
                      <span>$ {fmt(t.saldo_consumido)} de $ {fmt(t.limite_compra)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((t.saldo_consumido / t.limite_compra) * 100, 100)}%`,
                        background: 'var(--grad-brand)',
                        borderRadius: 999,
                        transition: 'width 0.3s var(--ease-out)',
                      }} />
                    </div>
                  </div>

                  {t.estado === 'ACTIVO' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 18 }}>
                      <div style={{ flex: '1 1 200px', display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          type="number"
                          placeholder="Monto a comprar"
                          min="0.01"
                          step="0.01"
                          value={montoCompra[t.id_tarjeta] || ''}
                          onChange={(e) => setMontoCompra((prev) => ({ ...prev, [t.id_tarjeta]: e.target.value }))}
                        />
                        <button
                          className="btn-outline-green"
                          disabled={operando === `compra-${t.id_tarjeta}`}
                          onClick={() => handleComprar(t)}
                        >
                          {operando === `compra-${t.id_tarjeta}` ? '...' : 'Comprar'}
                        </button>
                      </div>

                      {Number(t.saldo_consumido) > 0 && (
                        <div style={{ flex: '1 1 200px', display: 'flex', gap: 8 }}>
                          <input
                            className="input"
                            type="number"
                            placeholder="Monto a pagar"
                            min="0.01"
                            step="0.01"
                            max={t.saldo_consumido}
                            value={montoPago[t.id_tarjeta] || ''}
                            onChange={(e) => setMontoPago((prev) => ({ ...prev, [t.id_tarjeta]: e.target.value }))}
                          />
                          <button
                            className="btn-primary"
                            style={{ width: 'auto', padding: '10px 18px' }}
                            disabled={operando === `pago-${t.id_tarjeta}`}
                            onClick={() => handlePagar(t)}
                          >
                            {operando === `pago-${t.id_tarjeta}` ? '...' : 'Pagar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {t.estado === 'ACTIVO' && Number(t.saldo_consumido) === 0 && (
                    <button
                      className="btn-ghost"
                      style={{ marginTop: 14, color: 'var(--text-3)', fontSize: 12.5 }}
                      disabled={operando === `cerrar-${t.id_tarjeta}`}
                      onClick={() => handleCerrar(t)}
                    >
                      Cerrar tarjeta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════ VISTA: EMITIR ════════ */}
      {vista === 'emitir' && (
        <div className="card anim-up-1">
          <form onSubmit={handleEmitir}>
            <div className="field">
              <label className="label">Marca</label>
              <div className="chips">
                {['VISA', 'MASTERCARD'].map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`chip${marca === m ? ' active' : ''}`}
                    onClick={() => setMarca(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {resultado && (
              <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-error'}`}>
                <Icon name={resultado.ok ? 'check' : 'alert'} size={16} />
                <span>
                  {resultado.mensaje}
                  {resultado.ok && resultado.situacion != null && ` (situación crediticia consultada: ${resultado.situacion})`}
                </span>
              </div>
            )}

            <div className="alert alert-info" style={{ marginBottom: 18 }}>
              <Icon name="lock" size={16} />
              <span>Antes de emitirla, consultamos tu situación en la Central de Deudores del sistema bancario. El límite depende de esa situación.</span>
            </div>

            <button className="btn-primary" type="submit" disabled={emitiendo}>
              {emitiendo ? 'Consultando situación crediticia…' : 'Emitir tarjeta'}
              {!emitiendo && <Icon name="card" size={16} />}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
