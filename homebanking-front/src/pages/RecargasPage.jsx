import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

// Insignia de marca por operador (inicial sobre el color de marca), estilo
// consistente con el resto de los íconos de la app. No son los logos
// oficiales de cada empresa, sino una referencia visual rápida para
// identificarlos — el color y la letra hacen el trabajo de reconocimiento.
const MARCAS = {
  MOVISTAR: { letra: 'M' },
  PERSONAL: { letra: 'P' },
  CLARO:    { letra: 'C' },
};

function LogoOperador({ opKey }) {
  const marca = MARCAS[opKey];
  if (!marca) return null;
  return (
    <span className={`op-badge op-${opKey.toLowerCase()}`} aria-hidden="true">
      {marca.letra}
    </span>
  );
}

export default function RecargasPage() {
  const [operadores, setOperadores] = useState([]);
  const [montos, setMontos] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  const [operador, setOperador] = useState('');
  const [numeroCelular, setNumeroCelular] = useState('');
  const [monto, setMonto] = useState(null);

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    api.get('/recargas/operadores')
      .then((res) => {
        setOperadores(res.data.operadores);
        setMontos(res.data.montos);
        setOperador(res.data.operadores[0]?.key || '');
      })
      .catch(() => setError('No se pudo cargar la lista de operadores'))
      .finally(() => setCargandoCatalogo(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);

    if (!/^\d{10}$/.test(numeroCelular.trim())) {
      setError('Ingresá un número de celular de 10 dígitos, sin 0 ni 15 (ej: 1123456789)');
      return;
    }
    if (!monto) {
      setError('Elegí un monto para la recarga');
      return;
    }

    setProcesando(true);
    try {
      const res = await api.post('/recargas', {
        operador,
        numero_celular: numeroCelular.trim(),
        monto,
      });
      setResultado({ ok: true, mensaje: res.data.mensaje });
      setNumeroCelular('');
      setMonto(null);
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo procesar la recarga' });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Recarga de celular</h1>
        <p className="page-sub">Cargá crédito a cualquier línea, al instante, desde tu caja en ARS.</p>
      </div>

      <div className="card anim-up-1">
        {cargandoCatalogo ? (
          <div className="loading-center"><div className="spinner" />Cargando…</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Operador</label>
              <div className="chips">
                {operadores.map((op) => (
                  <button
                    type="button"
                    key={op.key}
                    className={`chip chip-op${operador === op.key ? ' active' : ''}`}
                    onClick={() => { setOperador(op.key); setResultado(null); }}
                  >
                    <LogoOperador opKey={op.key} />
                    {op.empresa}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label">Número de celular</label>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                placeholder="Ej: 1123456789 (sin 0 ni 15)"
                value={numeroCelular}
                onChange={(e) => { setNumeroCelular(e.target.value.replace(/\D/g, '').slice(0, 10)); setResultado(null); }}
                maxLength={10}
              />
            </div>

            <div className="field">
              <label className="label">Monto</label>
              <div className="chips">
                {montos.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`chip${monto === m ? ' active' : ''}`}
                    onClick={() => { setMonto(m); setResultado(null); }}
                  >
                    $ {fmt(m)}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="alert alert-error"><Icon name="alert" size={16} /> <span>{error}</span></div>
            )}

            <button className="btn-primary" type="submit" disabled={procesando}>
              {procesando ? 'Procesando…' : monto ? `Recargar $ ${fmt(monto)}` : 'Recargar'}
              {!procesando && <Icon name="phone" size={16} />}
            </button>
          </form>
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
        <span>Cada recarga queda categorizada como "Recargas" en tus movimientos, para que puedas seguir tus gastos por tipo.</span>
      </div>
    </AppLayout>
  );
}
