import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });
const SIMBOLO = { ARS: '$', USD: 'US$' };

export default function ReservasPage() {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [cbuSeleccionado, setCbuSeleccionado] = useState('');
  const [cargandoCuentas, setCargandoCuentas] = useState(true);

  const [resumen, setResumen] = useState(null); // { saldo, reservado, disponible, reservas }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [nombreNueva, setNombreNueva] = useState('');
  const [montoNueva, setMontoNueva] = useState('');
  const [creando, setCreando] = useState(false);

  const [montoOperacion, setMontoOperacion] = useState({});
  const [operando, setOperando] = useState(null);

  const cargarCuentas = async () => {
    try {
      const productos = await api.get(`/personas/${usuario.id}/productos`);
      const cuentasRes = await api.get('/tablas/cuentas_bancarias');
      const misCuentas = productos.data
        .filter((p) => p.tipo === 'CAJA_AHORRO')
        .map((p) => cuentasRes.data.find((c) => c.id_producto === p.id_producto))
        .filter(Boolean)
        .sort((a, b) => (a.moneda === 'ARS' ? -1 : b.moneda === 'ARS' ? 1 : 0));
      setCuentas(misCuentas);
      if (misCuentas.length > 0) setCbuSeleccionado(misCuentas[0].cbu);
    } catch {
      setError('No se pudieron cargar tus cuentas');
    } finally {
      setCargandoCuentas(false);
    }
  };

  useEffect(() => { cargarCuentas(); }, [usuario]);

  const cargarResumen = async (cbu) => {
    if (!cbu) return;
    setCargando(true);
    setError('');
    try {
      const res = await api.get(`/cuentas/${cbu}/reservas`);
      setResumen(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las reservas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (cbuSeleccionado) cargarResumen(cbuSeleccionado); }, [cbuSeleccionado]);

  const cuentaActual = cuentas.find((c) => c.cbu === cbuSeleccionado);
  const simbolo = SIMBOLO[cuentaActual?.moneda] || '$';

  const handleCrear = async (e) => {
    e.preventDefault();
    setError('');
    const monto = Number(montoNueva);
    if (!nombreNueva.trim() || nombreNueva.trim().length < 2) return setError('El nombre debe tener al menos 2 caracteres');
    if (!monto || monto <= 0) return setError('Ingresá un monto mayor a 0');

    setCreando(true);
    try {
      await api.post(`/cuentas/${cbuSeleccionado}/reservas`, { nombre: nombreNueva.trim(), monto });
      setNombreNueva('');
      setMontoNueva('');
      cargarResumen(cbuSeleccionado);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la reserva');
    } finally {
      setCreando(false);
    }
  };

  const handleLiberar = async (reserva) => {
    const monto = Number(montoOperacion[reserva.id_reserva]) || Number(reserva.monto);
    setError('');
    setOperando(`liberar-${reserva.id_reserva}`);
    try {
      await api.post(`/reservas/${reserva.id_reserva}/liberar`, { monto });
      setMontoOperacion((prev) => ({ ...prev, [reserva.id_reserva]: '' }));
      cargarResumen(cbuSeleccionado);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo liberar el monto');
    } finally {
      setOperando(null);
    }
  };

  const handleEliminar = async (reserva) => {
    if (!window.confirm(`¿Eliminar la reserva "${reserva.nombre}"? Todo su monto vuelve a estar disponible.`)) return;
    setError('');
    setOperando(`eliminar-${reserva.id_reserva}`);
    try {
      await api.delete(`/reservas/${reserva.id_reserva}`);
      cargarResumen(cbuSeleccionado);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la reserva');
    } finally {
      setOperando(null);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Reservas</h1>
        <p className="page-sub">Separá plata dentro de tu cuenta para no gastarla por error. Sigue siendo tuya, solo queda apartada.</p>
      </div>

      {cuentas.length > 1 && (
        <div className="chips anim-up">
          {cuentas.map((c) => (
            <button
              key={c.cbu}
              type="button"
              className={`chip${cbuSeleccionado === c.cbu ? ' active' : ''}`}
              onClick={() => setCbuSeleccionado(c.cbu)}
            >
              Caja en {c.moneda}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-error anim-up">
          <Icon name="alert" size={16} /> <span>{error}</span>
        </div>
      )}

      {(cargandoCuentas || cargando) && (
        <div className="loading-center">
          <div className="spinner" />
          Cargando…
        </div>
      )}

      {!cargandoCuentas && !cargando && resumen && (
        <>
          <div className="card anim-up-1" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <p className="info-row-label">Saldo total</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>
                  {simbolo} {fmt(resumen.saldo)}
                </p>
              </div>
              <div>
                <p className="info-row-label">Reservado</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--text-2)' }}>
                  {simbolo} {fmt(resumen.reservado)}
                </p>
              </div>
              <div>
                <p className="info-row-label">Disponible</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--green-bright)' }}>
                  {simbolo} {fmt(resumen.disponible)}
                </p>
              </div>
            </div>
          </div>

          {resumen.reservas.length === 0 ? (
            <div className="empty anim-up-2">
              <div className="empty-icon"><Icon name="vault" size={26} /></div>
              <p>Todavía no separaste plata en esta cuenta</p>
            </div>
          ) : (
            <div className="anim-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {resumen.reservas.map((r) => (
                <div key={r.id_reserva} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="quick-action-icon" style={{ width: 40, height: 40 }}>
                        <Icon name="vault" size={18} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{r.nombre}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{simbolo} {fmt(r.monto)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        placeholder="Monto"
                        min="0.01"
                        step="0.01"
                        style={{ width: 110, padding: '8px 10px' }}
                        value={montoOperacion[r.id_reserva] || ''}
                        onChange={(e) => setMontoOperacion((prev) => ({ ...prev, [r.id_reserva]: e.target.value }))}
                      />
                      <button
                        className="btn-outline-green"
                        disabled={operando === `liberar-${r.id_reserva}`}
                        onClick={() => handleLiberar(r)}
                      >
                        Liberar
                      </button>
                      <button
                        className="btn-icon-ghost"
                        title="Eliminar reserva"
                        disabled={operando === `eliminar-${r.id_reserva}`}
                        onClick={() => handleEliminar(r)}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card anim-up-3">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nueva reserva</h3>
            <form onSubmit={handleCrear}>
              <div className="field">
                <label className="label">Nombre</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ej: Vacaciones, Alquiler..."
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">Monto a apartar</label>
                <div className="amount-box">
                  <span className="amount-sign">{simbolo}</span>
                  <input
                    className="amount-input"
                    type="number"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    value={montoNueva}
                    onChange={(e) => setMontoNueva(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={creando}>
                {creando ? 'Creando…' : 'Crear reserva'}
                {!creando && <Icon name="vault" size={16} />}
              </button>
            </form>
          </div>
        </>
      )}
    </AppLayout>
  );
}
