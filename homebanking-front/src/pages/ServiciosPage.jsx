import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

// Espejo de TIPOS_SERVICIO en servicioModel.js — solo para mostrar el ícono
// y el nombre de cada servicio. El monto real de la factura lo decide el backend.
const TIPOS_SERVICIO = {
  AGUA: { label: 'Agua', icon: 'droplet' },
  LUZ:  { label: 'Luz',  icon: 'bolt' },
  GAS:  { label: 'Gas',  icon: 'flame' },
};

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export default function ServiciosPage() {
  const [tipoElegido, setTipoElegido] = useState('AGUA');
  const [numeroCliente, setNumeroCliente] = useState('');

  const [factura, setFactura] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');

  const [pagando, setPagando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cambiarServicio = (tipo) => {
    setTipoElegido(tipo);
    setFactura(null);
    setResultado(null);
    setErrorConsulta('');
  };

  const handleConsultar = async (e) => {
    e.preventDefault();
    setErrorConsulta('');
    setResultado(null);
    setFactura(null);
    if (numeroCliente.trim().length < 3) {
      setErrorConsulta('Ingresá tu número de cliente (mínimo 3 caracteres)');
      return;
    }
    setConsultando(true);
    try {
      const res = await api.post('/servicios/consultar-factura', {
        tipo_servicio: tipoElegido,
        numero_cliente: numeroCliente,
      });
      setFactura(res.data);
    } catch (err) {
      setErrorConsulta(err.response?.data?.error || 'No se pudo consultar la factura');
    } finally {
      setConsultando(false);
    }
  };

  const handlePagar = async () => {
    setPagando(true);
    setResultado(null);
    try {
      const res = await api.post('/servicios/pagar', {
        tipo_servicio: factura.tipo_servicio,
        numero_cliente: factura.numero_cliente,
        monto: factura.monto,
      });
      setResultado({ ok: true, mensaje: res.data.mensaje });
      setFactura(null);
      setNumeroCliente('');
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo pagar el servicio' });
    } finally {
      setPagando(false);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Servicios</h1>
        <p className="page-sub">Pagá agua, luz y gas desde tu caja en ARS, todo en un mismo lugar.</p>
      </div>

      <div className="card anim-up-1">
        <div className="field">
          <label className="label">Servicio</label>
          <div className="chips">
            {Object.entries(TIPOS_SERVICIO).map(([key, s]) => (
              <button
                type="button"
                key={key}
                className={`chip${tipoElegido === key ? ' active' : ''}`}
                onClick={() => cambiarServicio(key)}
              >
                <Icon name={s.icon} size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleConsultar}>
          <div className="field">
            <label className="label">Número de cliente</label>
            <input
              className="input"
              type="text"
              placeholder="El que figura en tu última factura"
              value={numeroCliente}
              onChange={(e) => { setNumeroCliente(e.target.value); setFactura(null); }}
              maxLength={40}
            />
          </div>

          {errorConsulta && (
            <div className="alert alert-error"><Icon name="alert" size={16} /> <span>{errorConsulta}</span></div>
          )}

          <button className="btn-primary" type="submit" disabled={consultando}>
            {consultando ? 'Consultando…' : 'Consultar factura'}
            {!consultando && <Icon name="receipt" size={16} />}
          </button>
        </form>

        {factura && (
          <div className="recipient-card anim-up-1" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 20 }}>
            <div className="receipt-row"><span className="k">Empresa</span><span className="v">{factura.empresa}</span></div>
            <div className="receipt-row"><span className="k">Cliente</span><span className="v">{factura.numero_cliente}</span></div>
            <div className="receipt-row"><span className="k">Vencimiento</span><span className="v">{new Date(factura.vencimiento).toLocaleDateString('es-AR')}</span></div>
            <div className="receipt-row"><span className="k">Monto a pagar</span><span className="v">$ {fmt(factura.monto)}</span></div>

            <button className="btn-primary" style={{ marginTop: 10 }} onClick={handlePagar} disabled={pagando}>
              {pagando ? 'Procesando…' : `Pagar $ ${fmt(factura.monto)}`}
              {!pagando && <Icon name="check" size={16} />}
            </button>
          </div>
        )}

        {resultado && (
          <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 18, marginBottom: 0 }}>
            <Icon name={resultado.ok ? 'check' : 'alert'} size={16} />
            <span>{resultado.mensaje}</span>
          </div>
        )}
      </div>

      <div className="alert alert-info anim-up-2" style={{ marginTop: 18 }}>
        <Icon name="info" size={16} />
        <span>Cada pago queda categorizado como "Servicios" en tus movimientos, para que puedas seguir tus gastos por tipo.</span>
      </div>
    </AppLayout>
  );
}
