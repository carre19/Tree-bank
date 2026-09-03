import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

export default function DepositosPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [monto, setMonto]             = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cbu, setCbu]                 = useState('');
  const [saldoActual, setSaldoActual] = useState(null);
  const [cargando, setCargando]       = useState(true);
  const [enviando, setEnviando]       = useState(false);
  const [exito, setExito]             = useState(null);
  const [error, setError]             = useState('');

  useEffect(() => {
    const cargarCuenta = async () => {
      try {
        // Los depositos van siempre a la caja en ARS (si tambien hay una en USD,
        // hace falta filtrar por moneda y no solo tomar "el primer producto")
        // /productos ya viene con cbu, saldo y moneda de cada cuenta propia
        const productos = await api.get(`/personas/${usuario.id}/productos`);
        const miCuenta = productos.data.find(
          p => p.tipo === 'CAJA_AHORRO' && p.moneda === 'ARS' && p.cbu
        );
        if (miCuenta) {
          setCbu(miCuenta.cbu);
          setSaldoActual(parseFloat(miCuenta.saldo));
        }
      } catch {
        setError('No se pudo conectar con el banco. Verificá que el backend esté corriendo.');
      } finally {
        setCargando(false);
      }
    };
    cargarCuenta();
  }, [usuario]);

  const handleDeposito = async (e) => {
    e.preventDefault();
    setError('');

    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      return setError('Ingresá un monto válido mayor a $0');
    }
    if (montoNum > 10000000) {
      return setError('El monto máximo por depósito es $10.000.000');
    }

    setEnviando(true);

    try {
      const res = await api.post('/depositos', {
        cbu,
        monto: montoNum,
        descripcion: descripcion || 'Deposito en efectivo'
      });
      setExito(res.data);
      setSaldoActual(res.data.saldo_actualizado);
      setMonto('');
      setDescripcion('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar el depósito');
    } finally {
      setEnviando(false);
    }
  };

  const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Depósito en efectivo</h1>
        <p className="page-sub">Acreditá dinero en tu cuenta al instante.</p>
      </div>

      {/* Saldo */}
      {!cargando && saldoActual !== null && (
        <div className="balance-card anim-up-1" style={{ marginBottom: 22 }}>
          <p className="balance-label">Saldo disponible</p>
          <h2 className="balance-amount" style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>
            $ {fmt(saldoActual)}
          </h2>
          <div className="balance-meta-row">
            <div>
              <p className="balance-meta-label">CBU</p>
              <p className="balance-meta-value">{cbu}</p>
            </div>
          </div>
        </div>
      )}

      {/* Éxito */}
      {exito && (
        <div className="alert alert-success" style={{ alignItems: 'center' }}>
          <Icon name="check" size={18} />
          <span style={{ flex: 1 }}>
            <strong>Depósito realizado.</strong> Se acreditaron $ {fmt(exito.monto)} —
            nuevo saldo: <strong>$ {fmt(exito.saldo_actualizado)}</strong>
          </span>
          <button className="btn-copy" onClick={() => setExito(null)} title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* Formulario */}
      <div className="card anim-up-2">
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
          Ingresar efectivo
        </h3>
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 22 }}>
          Registrá un depósito en tu cuenta bancaria.
        </p>

        {error && (
          <div className="alert alert-error">
            <Icon name="alert" size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleDeposito}>
          <div className="field">
            <label className="label">Monto a depositar</label>
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
            <label className="label">
              Descripción <span className="optional">(opcional)</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="Ej: Cobro de sueldo, efectivo personal…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="alert alert-info">
            <Icon name="info" size={16} />
            <span>
              El monto se acreditará inmediatamente en tu cuenta y quedará registrado en tu historial.
            </span>
          </div>

          <button className="btn-primary" type="submit" disabled={enviando || !monto}>
            {enviando ? 'Procesando…' : 'Confirmar depósito'}
            {!enviando && <Icon name="deposit" size={16} />}
          </button>
        </form>
      </div>

      <button
        className="btn-ghost anim-up-3"
        onClick={() => navigate('/historial')}
        style={{ width: '100%', marginTop: 16 }}
      >
        Ver historial de movimientos
        <Icon name="history" size={16} />
      </button>
    </AppLayout>
  );
}
