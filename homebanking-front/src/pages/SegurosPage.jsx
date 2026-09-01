import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

// Espejo de TIPOS_SEGURO en seguroModel.js — solo para mostrar cobertura/prima
// antes de contratar. La aprobacion real (y el precio) los decide el backend.
const TIPOS_SEGURO = {
  VIDA:               { cobertura: 5000000, prima_mensual: 2500, label: 'Vida' },
  HOGAR:              { cobertura: 3000000, prima_mensual: 1800, label: 'Hogar' },
  PROTECCION_COMPRAS: { cobertura: 500000,  prima_mensual: 900,  label: 'Protección de compras' },
};

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

const ESTADO_LABEL = { ACTIVO: 'Vigente', CERRADO: 'Cancelada' };

export default function SegurosPage() {
  const [polizas, setPolizas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [vista, setVista] = useState('lista'); // 'lista' | 'contratar'
  const [tipoElegido, setTipoElegido] = useState('VIDA');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [operando, setOperando] = useState(null); // id_poliza en curso

  const cargarPolizas = async () => {
    try {
      const res = await api.get('/seguros');
      setPolizas(res.data);
    } catch {
      setError('No se pudieron cargar tus seguros');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarPolizas(); }, []);

  const handleContratar = async (e) => {
    e.preventDefault();
    setResultado(null);
    setEnviando(true);
    try {
      const res = await api.post('/seguros', { tipo_seguro: tipoElegido });
      setResultado({ ok: true, mensaje: res.data.mensaje });
      cargarPolizas();
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo contratar la póliza' });
    } finally {
      setEnviando(false);
    }
  };

  const handlePagarPrima = async (p) => {
    setError('');
    setOperando(p.id_poliza);
    try {
      await api.post(`/seguros/${p.id_poliza}/pagar-prima`);
      cargarPolizas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo pagar la prima');
    } finally {
      setOperando(null);
    }
  };

  const handleCancelar = async (p) => {
    if (!window.confirm('¿Cancelar esta póliza? Vas a perder la cobertura.')) return;
    setError('');
    setOperando(p.id_poliza);
    try {
      await api.post(`/seguros/${p.id_poliza}/cancelar`);
      cargarPolizas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cancelar la póliza');
    } finally {
      setOperando(null);
    }
  };

  const plan = TIPOS_SEGURO[tipoElegido];

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Seguros</h1>
        <p className="page-sub">Contratá una póliza y pagá la prima mensual desde tu caja en ARS.</p>
      </div>

      <div className="tabs anim-up">
        <button className={`tab${vista === 'lista' ? ' active' : ''}`} onClick={() => setVista('lista')}>
          Mis pólizas
        </button>
        <button className={`tab${vista === 'contratar' ? ' active' : ''}`} onClick={() => { setVista('contratar'); setResultado(null); }}>
          Contratar
        </button>
      </div>

      {error && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} /> <span>{error}</span>
        </div>
      )}

      {/* ════════ VISTA: MIS PÓLIZAS ════════ */}
      {vista === 'lista' && (
        <>
          {cargando && (
            <div className="loading-center">
              <div className="spinner" />
              Cargando pólizas…
            </div>
          )}

          {!cargando && polizas.length === 0 && (
            <div className="empty anim-up-1">
              <div className="empty-icon"><Icon name="insurance" size={26} /></div>
              <p>Todavía no contrataste ningún seguro</p>
            </div>
          )}

          <div className="anim-up-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {polizas.map((p) => {
              const badge = p.estado === 'ACTIVO' ? 'in' : 'out';
              const nombreTipo = TIPOS_SEGURO[p.tipo_seguro]?.label || p.tipo_seguro;
              return (
                <div key={p.id_poliza} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>
                        Seguro de {nombreTipo}
                      </p>
                      <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
                        Cobertura $ {fmt(p.cobertura)} · Prima mensual $ {fmt(p.prima_mensual)}
                      </p>
                    </div>
                    <span className={`tx-badge ${badge}`}>{ESTADO_LABEL[p.estado] || p.estado}</span>
                  </div>

                  {p.estado === 'ACTIVO' && (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
                        Próximo pago: {new Date(p.fecha_proximo_pago).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                        <button
                          className="btn-outline-green"
                          disabled={operando === p.id_poliza}
                          onClick={() => handlePagarPrima(p)}
                        >
                          {operando === p.id_poliza ? '...' : `Pagar prima ($ ${fmt(p.prima_mensual)})`}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ color: 'var(--red)' }}
                          disabled={operando === p.id_poliza}
                          onClick={() => handleCancelar(p)}
                        >
                          Cancelar póliza
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════ VISTA: CONTRATAR ════════ */}
      {vista === 'contratar' && (
        <div className="card anim-up-1">
          <form onSubmit={handleContratar}>
            <div className="field">
              <label className="label">Tipo de seguro</label>
              <div className="chips">
                {Object.entries(TIPOS_SEGURO).map(([key, t]) => (
                  <button
                    type="button"
                    key={key}
                    className={`chip${tipoElegido === key ? ' active' : ''}`}
                    onClick={() => setTipoElegido(key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="recipient-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="receipt-row"><span className="k">Cobertura</span><span className="v">$ {fmt(plan.cobertura)}</span></div>
              <div className="receipt-row"><span className="k">Prima mensual</span><span className="v">$ {fmt(plan.prima_mensual)}</span></div>
            </div>

            {resultado && (
              <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-error'}`}>
                <Icon name={resultado.ok ? 'check' : 'alert'} size={16} />
                <span>{resultado.mensaje}</span>
              </div>
            )}

            <div className="alert alert-info" style={{ marginBottom: 18 }}>
              <Icon name="info" size={16} />
              <span>La primera prima se descuenta de tu caja en ARS apenas contratás la póliza.</span>
            </div>

            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? 'Procesando…' : 'Contratar póliza'}
              {!enviando && <Icon name="insurance" size={16} />}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
