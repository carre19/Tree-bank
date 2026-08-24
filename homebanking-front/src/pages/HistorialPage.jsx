import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const FILTROS = [
  { id: 'TODOS',                  label: 'Todos' },
  { id: 'TRANSFERENCIA_INGRESO',  label: 'Recibidos' },
  { id: 'TRANSFERENCIA_EGRESO',   label: 'Enviados' },
  { id: 'DEPOSITO',               label: 'Depósitos' },
];

export default function HistorialPage() {
  const { usuario } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [filtro, setFiltro]           = useState('TODOS');

  useEffect(() => {
    const cargar = async () => {
      try {
        // El historial es siempre el de la caja en ARS (si tambien hay una en USD,
        // hace falta filtrar por moneda y no solo tomar "el primer producto")
        const productos = await api.get(`/personas/${usuario.id}/productos`);
        const cajasAhorro = productos.data.filter(p => p.tipo === 'CAJA_AHORRO');
        if (cajasAhorro.length === 0) return;

        const cuentasRes = await api.get('/tablas/cuentas_bancarias');
        const miCuenta = cuentasRes.data.find(c =>
          cajasAhorro.some(p => p.id_producto === c.id_producto) && c.moneda === 'ARS'
        );
        if (!miCuenta) return;

        const movRes = await api.get(`/movimientos/${miCuenta.id_cuenta}`);
        setMovimientos(movRes.data);
      } catch {
        setMovimientos([]);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [usuario]);

  const formatFecha = (fecha) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const esPositivo = (tipo) => tipo === 'TRANSFERENCIA_INGRESO' || tipo === 'DEPOSITO';
  const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  const totalIngresos = movimientos
    .filter(m => esPositivo(m.tipo_movimiento))
    .reduce((sum, m) => sum + Number(m.monto), 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo_movimiento === 'TRANSFERENCIA_EGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0);

  const movFiltrados = filtro === 'TODOS'
    ? movimientos
    : movimientos.filter(m => m.tipo_movimiento === filtro);

  // ── Datos del gráfico: ingresos vs egresos agrupados por día (últimos 7 días con actividad)
  const porDia = {};
  movimientos.forEach(m => {
    const dia = new Date(m.fecha).toISOString().slice(0, 10);
    if (!porDia[dia]) porDia[dia] = { in: 0, out: 0 };
    if (esPositivo(m.tipo_movimiento)) porDia[dia].in += Number(m.monto);
    else porDia[dia].out += Number(m.monto);
  });
  const dias = Object.keys(porDia).sort().slice(-7);
  const maxValor = Math.max(1, ...dias.flatMap(d => [porDia[d].in, porDia[d].out]));
  const labelDia = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Movimientos</h1>
        <p className="page-sub">Todo lo que entró y salió de tu cuenta.</p>
      </div>

      {/* Resumen */}
      <div className="stats-grid anim-up-1">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52,211,153,0.13)', color: 'var(--green-bright)', border: '1px solid var(--ok-border)' }}>
            <Icon name="arrowDown" size={19} />
          </div>
          <div>
            <p className="stat-label">Total recibido</p>
            <p className="stat-value" style={{ color: 'var(--green-bright)' }}>+$ {fmt(totalIngresos)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
            <Icon name="arrowUp" size={19} />
          </div>
          <div>
            <p className="stat-label">Total enviado</p>
            <p className="stat-value" style={{ color: 'var(--red)' }}>-$ {fmt(totalEgresos)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--surface-2)', color: 'var(--mint)', border: '1px solid var(--border)' }}>
            <Icon name="history" size={19} />
          </div>
          <div>
            <p className="stat-label">Movimientos</p>
            <p className="stat-value">{movimientos.length}</p>
          </div>
        </div>
      </div>

      {/* Gráfico de flujo de dinero */}
      {!cargando && dias.length > 0 && (
        <div className="card chart-card anim-up-1">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Flujo de dinero
          </h3>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>
            Ingresos y egresos por día (últimos {dias.length} días con actividad)
          </p>
          <div className="chart-bars">
            {dias.map((dia, i) => (
              <div className="chart-group" key={dia}>
                <div className="chart-pair">
                  <div
                    className="chart-bar in"
                    style={{
                      height: `${Math.max(3, (porDia[dia].in / maxValor) * 100)}%`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                    title={`Ingresos ${labelDia(dia)}: $ ${fmt(porDia[dia].in)}`}
                  />
                  <div
                    className="chart-bar out"
                    style={{
                      height: `${Math.max(3, (porDia[dia].out / maxValor) * 100)}%`,
                      animationDelay: `${i * 0.07 + 0.03}s`,
                    }}
                    title={`Egresos ${labelDia(dia)}: $ ${fmt(porDia[dia].out)}`}
                  />
                </div>
                <span className="chart-date">{labelDia(dia)}</span>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><span className="dot" style={{ background: 'var(--green-bright)' }} />Ingresos</span>
            <span><span className="dot" style={{ background: 'var(--red)' }} />Egresos</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="chips anim-up-2">
        {FILTROS.map(f => (
          <button
            key={f.id}
            className={`chip${filtro === f.id ? ' active' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando && (
        <div className="loading-center">
          <div className="spinner" />
          Cargando movimientos…
        </div>
      )}

      {!cargando && movFiltrados.length === 0 && (
        <div className="empty anim-up-2">
          <div className="empty-icon">
            <Icon name="inbox" size={28} />
          </div>
          <p>No hay movimientos para mostrar</p>
        </div>
      )}

      <div className="anim-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {movFiltrados.map((mov) => {
          const tipo = mov.tipo_movimiento;
          const positivo = esPositivo(tipo);
          const esDeposito = tipo === 'DEPOSITO';
          const dir = positivo ? 'in' : 'out';
          const labelBadge = esDeposito ? 'Depósito' : positivo ? 'Recibido' : 'Enviado';
          const descDefault = esDeposito ? 'Depósito en efectivo' : positivo ? 'Transferencia recibida' : 'Transferencia enviada';

          return (
            <div key={mov.id_movimiento} className="tx-item">
              <div className={`tx-icon ${dir}`}>
                <Icon name={esDeposito ? 'deposit' : positivo ? 'arrowDown' : 'arrowUp'} size={19} />
              </div>
              <div className="tx-info">
                <p className="tx-desc">{mov.descripcion || descDefault}</p>
                <p className="tx-date">{formatFecha(mov.fecha)}</p>
              </div>
              <div className="tx-right">
                <p className={`tx-amount ${dir}`}>
                  {positivo ? '+' : '-'}$ {fmt(mov.monto)}
                </p>
                <span className={`tx-badge ${dir}`}>{labelBadge}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
