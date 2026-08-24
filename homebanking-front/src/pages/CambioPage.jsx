import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export default function CambioPage() {
  const [cotizacion, setCotizacion]   = useState(null);
  const [cargandoCot, setCargandoCot] = useState(true);
  const [errorCot, setErrorCot]       = useState('');

  const [operacion, setOperacion] = useState('COMPRA'); // COMPRA | VENTA
  const [monto, setMonto]         = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState('');
  const [resultado, setResultado] = useState(null);

  const cargarCotizacion = async () => {
    setCargandoCot(true);
    setErrorCot('');
    try {
      const res = await api.get('/cambio/cotizacion');
      setCotizacion(res.data);
    } catch {
      setErrorCot('No se pudo obtener la cotización del dólar');
    } finally {
      setCargandoCot(false);
    }
  };

  useEffect(() => { cargarCotizacion(); }, []);

  const montoNum = Number(monto) || 0;
  const precio = operacion === 'COMPRA' ? cotizacion?.venta : cotizacion?.compra;
  const totalArs = precio ? montoNum * precio : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    if (!montoNum || montoNum <= 0) return setError('Ingresá un monto en USD mayor a 0');

    setEnviando(true);
    try {
      const res = await api.post('/cambio', { operacion, monto: montoNum });
      setResultado({ ok: true, ...res.data });
      setMonto('');
      cargarCotizacion();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo realizar la operación');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Compra y venta de dólares</h1>
        <p className="page-sub">Operá entre tu caja en pesos y tu caja en dólares, a la cotización oficial.</p>
      </div>

      {/* Cotización vigente */}
      <div className="card anim-up-1" style={{ marginBottom: 18 }}>
        {cargandoCot ? (
          <div className="loading-center" style={{ padding: 20 }}>
            <div className="spinner" />
            Consultando cotización…
          </div>
        ) : errorCot ? (
          <div className="alert alert-error" style={{ marginBottom: 0 }}>
            <Icon name="alert" size={16} /> <span>{errorCot}</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Dólar oficial</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Fuente: {cotizacion.fuente}</span>
            </div>
            <div style={{ display: 'flex', gap: 28, marginTop: 10 }}>
              <div>
                <p className="info-row-label">Compra (te pagamos)</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--green-bright)' }}>
                  $ {fmt(cotizacion.compra)}
                </p>
              </div>
              <div>
                <p className="info-row-label">Venta (te cobramos)</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>
                  $ {fmt(cotizacion.venta)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Operar */}
      <div className="card anim-up-2">
        <div className="chips" style={{ marginBottom: 22 }}>
          <button type="button" className={`chip${operacion === 'COMPRA' ? ' active' : ''}`} onClick={() => { setOperacion('COMPRA'); setResultado(null); setError(''); }}>
            Comprar USD
          </button>
          <button type="button" className={`chip${operacion === 'VENTA' ? ' active' : ''}`} onClick={() => { setOperacion('VENTA'); setResultado(null); setError(''); }}>
            Vender USD
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Monto en USD a {operacion === 'COMPRA' ? 'comprar' : 'vender'}</label>
            <div className="amount-box">
              <span className="amount-sign">US$</span>
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

          {montoNum > 0 && precio && (
            <div className="recipient-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="receipt-row">
                <span className="k">Cotización aplicada</span>
                <span className="v">$ {fmt(precio)}</span>
              </div>
              <div className="receipt-row">
                <span className="k">{operacion === 'COMPRA' ? 'Vas a pagar' : 'Vas a recibir'}</span>
                <span className="v">$ {fmt(totalArs)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error"><Icon name="alert" size={16} /> {error}</div>
          )}
          {resultado && (
            <div className="alert alert-success">
              <Icon name="check" size={16} /> <span>{resultado.mensaje}</span>
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={enviando || cargandoCot}>
            {enviando ? 'Procesando…' : operacion === 'COMPRA' ? 'Comprar dólares' : 'Vender dólares'}
            {!enviando && <Icon name="swap" size={16} />}
          </button>
        </form>
      </div>

      <div className="alert alert-info anim-up-3" style={{ marginTop: 18 }}>
        <Icon name="info" size={16} />
        <span>Necesitás tener una caja en USD abierta (desde el Inicio) para operar acá.</span>
      </div>
    </AppLayout>
  );
}
