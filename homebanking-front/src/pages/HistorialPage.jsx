import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';
import { CATEGORIAS, infoMovimiento, categoriasPresentes, agruparPorCategoria } from '../data/categoriasMovimiento';

const fmtMonto = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

// Rueda de categorías al estilo Mercado Pago: un anillo armado con conic-gradient
// (un color por categoría, proporcional a lo que representa del total) y el
// total en el centro. Se usa una para gastos y otra para ingresos.
function RuedaCategorias({ titulo, subtitulo, segmentos, total }) {
  const gradiente = (() => {
    let acumulado = 0;
    const stops = segmentos.map((s) => {
      const inicio = acumulado;
      acumulado += (s.total / total) * 100;
      return `${s.color} ${inicio}% ${acumulado}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  })();

  return (
    <div className="wheel-card">
      <h3 className="wheel-title">{titulo}</h3>
      <p className="wheel-sub">{subtitulo}</p>

      {segmentos.length === 0 ? (
        <div className="wheel-empty">
          <div className="wheel-ring wheel-ring-empty" />
          <p>Sin movimientos para mostrar</p>
        </div>
      ) : (
        <>
          <div className="wheel-wrap">
            <div className="wheel-ring" style={{ background: gradiente }} />
            <div className="wheel-hole">
              <span className="wheel-hole-value">$ {fmtMonto(total)}</span>
              <span className="wheel-hole-label">Total</span>
            </div>
          </div>
          <div className="wheel-legend">
            {segmentos.map((s) => (
              <div className="wheel-legend-item" key={s.categoria}>
                <span className="wheel-legend-dot" style={{ background: s.color }} />
                <Icon name={s.icon} size={14} />
                <span className="wheel-legend-label">{s.label}</span>
                <span className="wheel-legend-pct">{Math.round((s.total / total) * 100)}%</span>
                <span className="wheel-legend-amount">$ {fmtMonto(s.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

  const fmt = fmtMonto;

  const totalIngresos = movimientos
    .filter(m => infoMovimiento(m.tipo_movimiento).signo === 'in')
    .reduce((sum, m) => sum + Number(m.monto), 0);

  const totalEgresos = movimientos
    .filter(m => infoMovimiento(m.tipo_movimiento).signo === 'out')
    .reduce((sum, m) => sum + Number(m.monto), 0);

  // Ruedas de gastos e ingresos por categoría (las transferencias quedan afuera,
  // se muestran aparte en su propia lista) y total de cada una para el centro del anillo
  const gastosPorCategoria = agruparPorCategoria(movimientos, 'out');
  const ingresosPorCategoria = agruparPorCategoria(movimientos, 'in');
  const totalGastosCategorizados = gastosPorCategoria.reduce((sum, s) => sum + s.total, 0);
  const totalIngresosCategorizados = ingresosPorCategoria.reduce((sum, s) => sum + s.total, 0);

  const transferencias = movimientos.filter(m => infoMovimiento(m.tipo_movimiento).categoria === 'TRANSFERENCIAS');

  // Chips de categoría: solo se muestran las que de verdad aparecen en el historial
  const categoriasChip = categoriasPresentes(movimientos);
  const movFiltrados = filtro === 'TODOS'
    ? movimientos
    : movimientos.filter(m => infoMovimiento(m.tipo_movimiento).categoria === filtro);

  // ── Datos del gráfico: ingresos vs egresos agrupados por día (últimos 7 días con actividad)
  const porDia = {};
  movimientos.forEach(m => {
    const dia = new Date(m.fecha).toISOString().slice(0, 10);
    if (!porDia[dia]) porDia[dia] = { in: 0, out: 0 };
    const signo = infoMovimiento(m.tipo_movimiento).signo;
    if (signo === 'in') porDia[dia].in += Number(m.monto);
    else if (signo === 'out') porDia[dia].out += Number(m.monto);
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
        <p className="page-sub">Todo lo que entró y salió de tu cuenta, catalogado por tipo de gasto.</p>
      </div>

      {/* Resumen */}
      <div className="stats-grid anim-up-1">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', border: '1px solid var(--ok-border)' }}>
            <Icon name="arrowDown" size={19} />
          </div>
          <div>
            <p className="stat-label">Total recibido</p>
            <p className="stat-value" style={{ color: 'var(--ok)' }}>+$ {fmt(totalIngresos)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
            <Icon name="arrowUp" size={19} />
          </div>
          <div>
            <p className="stat-label">Total gastado</p>
            <p className="stat-value" style={{ color: 'var(--red)' }}>-$ {fmt(totalEgresos)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
            <Icon name="history" size={19} />
          </div>
          <div>
            <p className="stat-label">Movimientos</p>
            <p className="stat-value">{movimientos.length}</p>
          </div>
        </div>
      </div>

      {/* Ruedas de gastos e ingresos por categoría, al estilo Mercado Pago */}
      {!cargando && movimientos.length > 0 && (
        <div className="wheels-grid anim-up-1">
          <RuedaCategorias
            titulo="Gastos"
            subtitulo="En qué se fue la plata"
            segmentos={gastosPorCategoria}
            total={totalGastosCategorizados}
          />
          <RuedaCategorias
            titulo="Ingresos"
            subtitulo="De dónde vino la plata"
            segmentos={ingresosPorCategoria}
            total={totalIngresosCategorizados}
          />
        </div>
      )}

      {/* Transferencias, siempre abajo de las ruedas */}
      {!cargando && transferencias.length > 0 && (
        <div className="card anim-up-1" style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            <Icon name="send" size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Transferencias
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transferencias.map((mov) => {
              const info = infoMovimiento(mov.tipo_movimiento);
              const dir = info.signo === 'in' ? 'in' : info.signo === 'out' ? 'out' : 'warn';
              return (
                <div key={mov.id_movimiento} className="tx-item">
                  <div className={`tx-icon ${dir === 'warn' ? '' : dir}`} style={dir === 'warn' ? { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' } : undefined}>
                    <Icon name={info.icon} size={19} />
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc">{mov.descripcion || info.label}</p>
                    <p className="tx-date">{formatFecha(mov.fecha)}</p>
                  </div>
                  <div className="tx-right">
                    <p className={`tx-amount ${dir === 'warn' ? '' : dir}`} style={dir === 'warn' ? { color: 'var(--warn)' } : undefined}>
                      {info.signo === 'in' ? '+' : info.signo === 'out' ? '-' : ''}$ {fmt(mov.monto)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <span><span className="dot" style={{ background: 'var(--ok)' }} />Ingresos</span>
            <span><span className="dot" style={{ background: 'var(--red)' }} />Egresos</span>
          </div>
        </div>
      )}

      {/* Filtros por categoría (estilo Mercado Pago: todo, o un tipo de gasto puntual) */}
      <div className="chips anim-up-2">
        <button
          className={`chip${filtro === 'TODOS' ? ' active' : ''}`}
          onClick={() => setFiltro('TODOS')}
        >
          Todos
        </button>
        {categoriasChip.map((cat) => (
          <button
            key={cat}
            className={`chip${filtro === cat ? ' active' : ''}`}
            onClick={() => setFiltro(cat)}
          >
            <Icon name={CATEGORIAS[cat].icon} size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
            {CATEGORIAS[cat].label}
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
          const info = infoMovimiento(mov.tipo_movimiento);
          const dir = info.signo === 'in' ? 'in' : info.signo === 'out' ? 'out' : 'warn';

          return (
            <div key={mov.id_movimiento} className="tx-item">
              <div className={`tx-icon ${dir === 'warn' ? '' : dir}`} style={dir === 'warn' ? { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' } : undefined}>
                <Icon name={info.icon} size={19} />
              </div>
              <div className="tx-info">
                <p className="tx-desc">{mov.descripcion || info.label}</p>
                <p className="tx-date">{formatFecha(mov.fecha)}</p>
              </div>
              <div className="tx-right">
                <p className={`tx-amount ${dir === 'warn' ? '' : dir}`} style={dir === 'warn' ? { color: 'var(--warn)' } : undefined}>
                  {info.signo === 'in' ? '+' : info.signo === 'out' ? '-' : ''}$ {fmt(mov.monto)}
                </p>
                <span className={`tx-badge ${dir}`}>{info.categoriaLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
