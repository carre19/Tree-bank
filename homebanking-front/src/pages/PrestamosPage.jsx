import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

// Espejo de TASAS_POR_CUOTAS en prestamoModel.js — solo para simular en vivo
// mientras el usuario elige el plazo. La aprobacion real la decide el backend.
const TASAS_POR_CUOTAS = { 3: 8, 6: 15, 12: 28, 24: 45 };
const PLAZOS = Object.keys(TASAS_POR_CUOTAS).map(Number);

const simular = (monto, cuotas) => {
  const tasa = TASAS_POR_CUOTAS[cuotas];
  const total = monto * (1 + tasa / 100);
  return { tasa, total, cuota: total / cuotas };
};

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

const ESTADO_LABEL = {
  ACTIVO: 'Al día',
  CERRADO: 'Pagado',
  BLOQUEADO: 'En mora',
};

export default function PrestamosPage() {
  const [prestamos, setPrestamos]   = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');

  const [vista, setVista]     = useState('lista'); // 'lista' | 'solicitar'
  const [monto, setMonto]     = useState('');
  const [cuotas, setCuotas]   = useState(6);
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState('');
  const [resultado, setResultado] = useState(null); // respuesta del backend (aprobado o rechazado)
  const [pagando, setPagando] = useState(null); // id_prestamo en curso

  const cargarPrestamos = async () => {
    try {
      const res = await api.get('/prestamos');
      setPrestamos(res.data);
    } catch {
      setError('No se pudieron cargar tus prestamos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarPrestamos(); }, []);

  const handleSolicitar = async (e) => {
    e.preventDefault();
    setFormError('');
    setResultado(null);
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) return setFormError('Ingresá un monto mayor a 0');

    setEnviando(true);
    try {
      const res = await api.post('/prestamos', { monto: montoNum, cuotas });
      setResultado({ ok: true, mensaje: res.data.mensaje, situacion: res.data.situacion_al_otorgar });
      setMonto('');
      cargarPrestamos();
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo procesar la solicitud' });
    } finally {
      setEnviando(false);
    }
  };

  const handlePagarCuota = async (prestamo) => {
    setError('');
    setPagando(prestamo.id_prestamo);
    try {
      await api.post(`/prestamos/${prestamo.id_prestamo}/pagar-cuota`);
      cargarPrestamos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo pagar la cuota');
    } finally {
      setPagando(null);
    }
  };

  const sim = monto > 0 ? simular(Number(monto), cuotas) : null;

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Préstamos</h1>
        <p className="page-sub">Pedí un préstamo personal o seguí el estado de los que ya tenés.</p>
      </div>

      <div className="tabs anim-up">
        <button className={`tab${vista === 'lista' ? ' active' : ''}`} onClick={() => setVista('lista')}>
          Mis préstamos
        </button>
        <button className={`tab${vista === 'solicitar' ? ' active' : ''}`} onClick={() => { setVista('solicitar'); setResultado(null); }}>
          Solicitar
        </button>
      </div>

      {error && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} /> <span>{error}</span>
        </div>
      )}

      {/* ════════ VISTA: MIS PRÉSTAMOS ════════ */}
      {vista === 'lista' && (
        <>
          {cargando && (
            <div className="loading-center">
              <div className="spinner" />
              Cargando préstamos…
            </div>
          )}

          {!cargando && prestamos.length === 0 && (
            <div className="empty anim-up-1">
              <div className="empty-icon"><Icon name="loan" size={26} /></div>
              <p>Todavía no pediste ningún préstamo</p>
            </div>
          )}

          <div className="anim-up-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prestamos.map((p) => {
              const badge = p.estado === 'ACTIVO' ? 'in' : p.estado === 'BLOQUEADO' ? 'warn' : 'out';
              const vencida = p.estado === 'ACTIVO' && p.fecha_proximo_vencimiento
                && new Date(p.fecha_proximo_vencimiento) < new Date().setHours(0, 0, 0, 0);
              return (
                <div key={p.id_prestamo} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>
                        $ {fmt(p.monto)}
                      </p>
                      <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                        {p.cuotas_totales} cuotas de $ {fmt(p.monto_cuota)} · TNA {fmt(p.tasa_interes)}%
                      </p>
                    </div>
                    <span className={`tx-badge ${badge}`}>{ESTADO_LABEL[p.estado] || p.estado}</span>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                      <span>{p.cuotas_pagadas} de {p.cuotas_totales} cuotas pagadas</span>
                      <span>Saldo: $ {fmt(p.saldo_pendiente)}</span>
                    </div>
                    {p.estado === 'ACTIVO' && p.fecha_proximo_vencimiento && (
                      <p style={{ fontSize: 12, color: vencida ? 'var(--red)' : 'var(--text-3)', marginBottom: 6 }}>
                        {vencida ? 'Cuota vencida el ' : 'Próximo vencimiento: '}
                        {new Date(p.fecha_proximo_vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                      </p>
                    )}
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(p.cuotas_pagadas / p.cuotas_totales) * 100}%`,
                        background: 'var(--grad-brand)',
                        borderRadius: 999,
                        transition: 'width 0.3s var(--ease-out)',
                      }} />
                    </div>
                  </div>

                  {vencida && (
                    <div className="alert alert-warn" style={{ marginTop: 16, marginBottom: 0 }}>
                      <Icon name="alert" size={16} />
                      <span>Tenés una cuota vencida. Pagala pronto para evitar que se informe a la Central de Deudores.</span>
                    </div>
                  )}
                  {p.estado === 'ACTIVO' && (
                    <button
                      className="btn-outline-green"
                      style={{ marginTop: 16 }}
                      disabled={pagando === p.id_prestamo}
                      onClick={() => handlePagarCuota(p)}
                    >
                      {pagando === p.id_prestamo ? 'Pagando…' : `Pagar cuota ($ ${fmt(p.monto_cuota)})`}
                    </button>
                  )}
                  {p.estado === 'BLOQUEADO' && (
                    <div className="alert alert-error" style={{ marginTop: 16, marginBottom: 0 }}>
                      <Icon name="alert" size={16} />
                      <span>Este préstamo está en mora y fue informado a la Central de Deudores.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════ VISTA: SOLICITAR ════════ */}
      {vista === 'solicitar' && (
        <div className="card anim-up-1">
          <form onSubmit={handleSolicitar}>
            <div className="field">
              <label className="label">Monto a solicitar</label>
              <div className="amount-box">
                <span className="amount-sign">$</span>
                <input
                  className="amount-input"
                  type="number"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="1"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Plazo</label>
              <div className="chips">
                {PLAZOS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`chip${cuotas === c ? ' active' : ''}`}
                    onClick={() => setCuotas(c)}
                  >
                    {c} cuotas
                  </button>
                ))}
              </div>
            </div>

            {sim && (
              <div className="recipient-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div className="receipt-row"><span className="k">Interés total (TNA)</span><span className="v">{sim.tasa}%</span></div>
                <div className="receipt-row"><span className="k">Total a devolver</span><span className="v">$ {fmt(sim.total)}</span></div>
                <div className="receipt-row"><span className="k">Cuota mensual</span><span className="v">$ {fmt(sim.cuota)}</span></div>
              </div>
            )}

            {formError && (
              <div className="alert alert-error"><Icon name="alert" size={16} /> {formError}</div>
            )}

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
              <span>Antes de aprobar, consultamos tu situación en la Central de Deudores del sistema bancario.</span>
            </div>

            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? 'Consultando situación crediticia…' : 'Solicitar préstamo'}
              {!enviando && <Icon name="loan" size={16} />}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
