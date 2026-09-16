import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

const fmt = (v, decimales = 2) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

// Simbolos destacados para "Acciones Extranjeras": el panel completo de
// data912 trae mas de 3000 tickers (bonos, ETFs, empresas chicas incluidos),
// imposible de listar de entrada. Mientras no se busca nada, se muestran
// solo estos, ya cruzados contra lo que efectivamente devolvio la API.
const POPULARES_EX = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'DIS', 'KO'];

const PANELES = {
  ACCION_AR: { label: 'Acciones Argentinas', moneda: 'ARS', simbolo: '$' },
  ACCION_EX: { label: 'Acciones Extranjeras', moneda: 'USD', simbolo: 'U$S' },
};

// Refresco de cotizaciones: acompaña el cache de 15s del backend sin
// golpearlo mas seguido de lo que tiene sentido
const INTERVALO_REFRESCO_MS = 15000;

const RANGOS_HISTORICO = ['1M', '3M', '6M', '1A', 'MAX'];

// Grafico de precio historico (SVG hecho a mano, sin librerias, igual que
// las ruedas de categorias de Movimientos): una linea con relleno degradado,
// verde o rojo segun si subio o bajo en el periodo elegido.
function GraficoHistorico({ mercado, simbolo, monedaPrefijo, onCerrar }) {
  const [rango, setRango] = useState('1M');
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null); // indice del punto bajo el mouse
  const svgWrapRef = useRef(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    api.get(`/inversiones/historico/${mercado}/${simbolo}`, { params: { rango } })
      .then((res) => { if (activo) setPuntos(res.data.puntos); })
      .catch(() => { if (activo) setError('No se pudo obtener el histórico'); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [mercado, simbolo, rango]);

  useEffect(() => setHover(null), [rango]);

  const grafico = useMemo(() => {
    if (puntos.length < 2) return null;
    const valores = puntos.map((p) => Number(p.cierre));
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rangoY = max - min || 1;
    const W = 600, H = 160, PAD = 6;

    const coords = valores.map((v, i) => [
      (i / (valores.length - 1)) * (W - PAD * 2) + PAD,
      H - PAD - ((v - min) / rangoY) * (H - PAD * 2),
    ]);
    const pathD = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const areaD = `${pathD} L ${coords[coords.length - 1][0].toFixed(2)} ${H - PAD} L ${coords[0][0].toFixed(2)} ${H - PAD} Z`;
    const cambioPct = ((valores[valores.length - 1] - valores[0]) / valores[0]) * 100;

    return { coords, W, H, cambioPct, positivo: cambioPct >= 0, pathD, areaD };
  }, [puntos]);

  // Mueve el mouse (o el dedo) sobre el grafico -> busca el punto mas cercano
  // en X y lo guarda en "hover" para dibujar la linea guia y el tooltip
  const handlePuntero = (clientX) => {
    if (!grafico || !svgWrapRef.current) return;
    const rect = svgWrapRef.current.getBoundingClientRect();
    const relX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const indice = Math.round(relX * (puntos.length - 1));
    setHover(indice);
  };

  return (
    <div className="card anim-up-1" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Histórico de {simbolo}</h3>
        <button className="btn-icon-ghost" onClick={onCerrar} title="Cerrar"><Icon name="x" size={16} /></button>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        {RANGOS_HISTORICO.map((r) => (
          <button key={r} className={`chip${rango === r ? ' active' : ''}`} onClick={() => setRango(r)}>{r}</button>
        ))}
      </div>

      {cargando ? (
        <div className="loading-center"><div className="spinner" />Cargando histórico…</div>
      ) : error || !grafico ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="trending" size={24} /></div>
          <p>{error || 'Sin datos históricos suficientes para este símbolo'}</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13.5, marginBottom: 8, color: grafico.positivo ? 'var(--ok)' : 'var(--red)', fontWeight: 600 }}>
            {hover != null
              ? `${monedaPrefijo} ${fmt(puntos[hover].cierre, puntos[hover].cierre < 10 ? 4 : 2)} · ${puntos[hover].fecha}`
              : `${grafico.positivo ? '+' : ''}${fmt(grafico.cambioPct)}% en el período`}
          </p>
          <div
            ref={svgWrapRef}
            style={{ position: 'relative', touchAction: 'none' }}
            onMouseMove={(e) => handlePuntero(e.clientX)}
            onMouseLeave={() => setHover(null)}
            onTouchMove={(e) => { if (e.touches[0]) handlePuntero(e.touches[0].clientX); }}
            onTouchEnd={() => setHover(null)}
          >
            <svg viewBox={`0 0 ${grafico.W} ${grafico.H}`} style={{ width: '100%', height: 160, display: 'block', cursor: 'crosshair' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`grad-${mercado}-${simbolo}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={grafico.positivo ? 'var(--ok)' : 'var(--red)'} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={grafico.positivo ? 'var(--ok)' : 'var(--red)'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={grafico.areaD} fill={`url(#grad-${mercado}-${simbolo})`} stroke="none" />
              <path d={grafico.pathD} fill="none" stroke={grafico.positivo ? 'var(--ok)' : 'var(--red)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {hover != null && (
                <>
                  <line
                    x1={grafico.coords[hover][0]} x2={grafico.coords[hover][0]}
                    y1="0" y2={grafico.H}
                    stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={grafico.coords[hover][0]} cy={grafico.coords[hover][1]} r="4"
                    fill={grafico.positivo ? 'var(--ok)' : 'var(--red)'} stroke="var(--surface)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
            <span>{puntos[0].fecha}</span>
            <span>{puntos[puntos.length - 1].fecha}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function InversionesPage() {
  const [tab, setTab] = useState('ACCION_AR');

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Inversiones</h1>
        <p className="page-sub">
          Cotizaciones reales en vivo (BYMA y mercados de EE.UU., vía data912.com) y cauciones a plazo.
        </p>
      </div>

      <div className="tabs anim-up-1">
        <button className={`tab${tab === 'ACCION_AR' ? ' active' : ''}`} onClick={() => setTab('ACCION_AR')}>
          Acciones AR
        </button>
        <button className={`tab${tab === 'ACCION_EX' ? ' active' : ''}`} onClick={() => setTab('ACCION_EX')}>
          Acciones Extranjeras
        </button>
        <button className={`tab${tab === 'CAUCIONES' ? ' active' : ''}`} onClick={() => setTab('CAUCIONES')}>
          Cauciones
        </button>
      </div>

      {tab === 'CAUCIONES' ? <PanelCauciones /> : <PanelAcciones mercado={tab} />}
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ACCIONES (argentinas o extranjeras): mismo componente para los dos paneles,
// solo cambia el mercado (moneda, endpoint, simbolos por defecto)
// ──────────────────────────────────────────────────────────────────────────
function PanelAcciones({ mercado }) {
  const { label, moneda, simbolo } = PANELES[mercado];

  const [cotizaciones, setCotizaciones] = useState([]);
  const [actualizado, setActualizado] = useState(null);
  const [fuente, setFuente] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [tenencias, setTenencias] = useState([]);
  const [cargandoTenencias, setCargandoTenencias] = useState(true);

  const [operando, setOperando] = useState(null); // { simbolo, tipo: 'comprar'|'vender' }
  const [cantidad, setCantidad] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historicoSimbolo, setHistoricoSimbolo] = useState(null);

  const intervaloRef = useRef(null);

  // Guarda el mercado del efecto mas reciente: si el usuario cambia de pestaña
  // (AR -> EX) mientras un fetch del mercado viejo todavia esta en vuelo, esa
  // respuesta llega tarde y no debe pisar el estado del mercado que se esta
  // mostrando ahora (los precios de un mercado apareciendo bajo el otro).
  const mercadoVigenteRef = useRef(mercado);

  const cargarCotizaciones = async () => {
    try {
      const res = await api.get(`/inversiones/cotizaciones/${mercado}`);
      if (mercadoVigenteRef.current !== mercado) return; // respuesta obsoleta
      setCotizaciones(res.data.datos);
      setActualizado(res.data.actualizado);
      setFuente(res.data.fuente);
      setError('');
    } catch (err) {
      if (mercadoVigenteRef.current !== mercado) return;
      setError(err.response?.data?.error || 'No se pudieron obtener las cotizaciones');
    } finally {
      if (mercadoVigenteRef.current === mercado) setCargando(false);
    }
  };

  const cargarTenencias = async () => {
    setCargandoTenencias(true);
    try {
      const res = await api.get('/inversiones/tenencias');
      if (mercadoVigenteRef.current !== mercado) return;
      setTenencias(res.data.filter((t) => t.mercado === mercado));
    } catch { /* si falla, se queda con lo que ya tenia */ }
    finally { if (mercadoVigenteRef.current === mercado) setCargandoTenencias(false); }
  };

  useEffect(() => {
    mercadoVigenteRef.current = mercado;
    setCargando(true);
    cargarCotizaciones();
    cargarTenencias();
    setOperando(null);
    setResultado(null);
    setBusqueda('');
    setHistoricoSimbolo(null);

    intervaloRef.current = setInterval(cargarCotizaciones, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervaloRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    if (q) return cotizaciones.filter((c) => c.simbolo.toUpperCase().includes(q)).slice(0, 60);
    if (mercado === 'ACCION_EX') return cotizaciones.filter((c) => POPULARES_EX.includes(c.simbolo));
    return cotizaciones.slice(0, 100);
  }, [cotizaciones, busqueda, mercado]);

  const abrirOperar = (simbolo, tipo) => {
    setOperando({ simbolo, tipo });
    setCantidad('');
    setResultado(null);
  };

  const cotizacionDe = (simbolo) => cotizaciones.find((c) => c.simbolo === simbolo);

  const confirmarOperacion = async () => {
    if (!operando) return;
    const cant = Number(cantidad);
    if (!Number.isInteger(cant) || cant <= 0) {
      setResultado({ ok: false, mensaje: 'La cantidad debe ser un número entero mayor a 0' });
      return;
    }
    setProcesando(true);
    setResultado(null);
    try {
      const endpoint = operando.tipo === 'comprar' ? '/inversiones/comprar' : '/inversiones/vender';
      const res = await api.post(endpoint, { mercado, simbolo: operando.simbolo, cantidad: cant });
      setResultado({ ok: true, mensaje: res.data.mensaje });
      setOperando(null);
      cargarTenencias();
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo realizar la operación' });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <div className="card anim-up-1" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>{label}</h3>
          {actualizado && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              <Icon name="history" size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
              Actualizado {new Date(actualizado).toLocaleTimeString('es-AR')} · {fuente}
            </span>
          )}
        </div>

        <div className="input-icon-wrap" style={{ marginBottom: 14 }}>
          <Icon name="search" size={17} />
          <input
            className="input"
            placeholder={mercado === 'ACCION_EX' ? 'Buscar símbolo (ej: AAPL, TSLA)…' : 'Buscar símbolo (ej: GGAL, YPFD)…'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-error"><Icon name="alert" size={16} /><span>{error}</span></div>}

        {cargando ? (
          <div className="loading-center"><div className="spinner" />Cargando cotizaciones…</div>
        ) : visibles.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Icon name="inbox" size={26} /></div>
            <p>{busqueda ? 'No se encontró ningún símbolo con esa búsqueda' : 'Sin cotizaciones disponibles'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
            {visibles.map((c) => {
              const positivo = (c.variacion_pct ?? 0) >= 0;
              return (
                <div key={c.simbolo} className="tx-item">
                  <div
                    className="tx-icon"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setHistoricoSimbolo(c.simbolo)}
                    title={`Ver histórico de ${c.simbolo}`}
                  >
                    <Icon name="trending" size={17} />
                  </div>
                  <div className="tx-info" style={{ cursor: 'pointer' }} onClick={() => setHistoricoSimbolo(c.simbolo)}>
                    <p className="tx-desc">{c.simbolo}</p>
                    <p className="tx-date" style={{ color: positivo ? 'var(--ok)' : 'var(--red)' }}>
                      {c.variacion_pct != null ? `${positivo ? '+' : ''}${fmt(c.variacion_pct)}%` : 'sin variación hoy'}
                    </p>
                  </div>
                  <div className="tx-right">
                    <p className="tx-amount" style={{ color: 'var(--text)' }}>{simbolo} {fmt(c.precio, c.precio < 10 ? 4 : 2)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
                    <button className="btn-outline-green" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => abrirOperar(c.simbolo, 'comprar')}>
                      Comprar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {operando && (
        <div className="card anim-up-1" style={{ marginBottom: 18 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {operando.tipo === 'comprar' ? 'Comprar' : 'Vender'} {operando.simbolo}
          </h3>
          <p style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 14 }}>
            Precio actual: {simbolo} {fmt(cotizacionDe(operando.simbolo)?.precio || 0, 2)}
          </p>

          <div className="field">
            <label className="label">Cantidad</label>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              placeholder="Ej: 10"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          {cantidad > 0 && cotizacionDe(operando.simbolo) && (
            <p style={{ fontSize: 13.5, marginBottom: 14 }}>
              Total: <b>{simbolo} {fmt(cotizacionDe(operando.simbolo).precio * Number(cantidad))}</b>
            </p>
          )}

          {resultado && !resultado.ok && (
            <div className="alert alert-error"><Icon name="alert" size={16} /><span>{resultado.mensaje}</span></div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" disabled={procesando} onClick={confirmarOperacion}>
              {procesando ? 'Procesando…' : `Confirmar ${operando.tipo}`}
            </button>
            <button className="btn-ghost" onClick={() => setOperando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {resultado?.ok && (
        <div className="alert alert-success anim-up-1" style={{ marginBottom: 18 }}>
          <Icon name="check" size={16} /><span>{resultado.mensaje}</span>
        </div>
      )}

      {historicoSimbolo && (
        <GraficoHistorico mercado={mercado} simbolo={historicoSimbolo} monedaPrefijo={simbolo} onCerrar={() => setHistoricoSimbolo(null)} />
      )}

      <h3 className="section-title anim-up-2">Mi cartera</h3>
      {cargandoTenencias ? (
        <div className="loading-center"><div className="spinner" />Cargando tu cartera…</div>
      ) : tenencias.length === 0 ? (
        <div className="empty anim-up-2">
          <div className="empty-icon"><Icon name="trending" size={26} /></div>
          <p>Todavía no tenés {label.toLowerCase()} en tu cartera</p>
        </div>
      ) : (
        <div className="anim-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tenencias.map((t) => {
            // Precio en vivo (viene del mismo panel de cotizaciones que ya se
            // refresca solo cada INTERVALO_REFRESCO_MS): asi la ganancia se
            // recalcula en tiempo real en vez de quedar congelada en el precio
            // que habia al entrar a la pagina o al ultimo comprar/vender.
            const precioLive = cotizacionDe(t.simbolo)?.precio ?? t.precio_actual;
            const valorActual = precioLive != null ? precioLive * Number(t.cantidad) : null;
            const costo = Number(t.precio_promedio) * Number(t.cantidad);
            const ganancia = valorActual != null ? valorActual - costo : null;
            const gananciaPositiva = (ganancia ?? 0) >= 0;
            return (
              <div key={t.id_tenencia} className="tx-item" style={{ flexWrap: 'wrap' }}>
                <div className="tx-icon in" style={{ cursor: 'pointer' }} onClick={() => setHistoricoSimbolo(t.simbolo)} title={`Ver histórico de ${t.simbolo}`}>
                  <Icon name="trending" size={19} />
                </div>
                <div className="tx-info" style={{ cursor: 'pointer' }} onClick={() => setHistoricoSimbolo(t.simbolo)}>
                  <p className="tx-desc">{t.simbolo} · {fmt(t.cantidad, 0)} {Number(t.cantidad) === 1 ? 'unidad' : 'unidades'}</p>
                  <p className="tx-date">PPC {simbolo} {fmt(t.precio_promedio)}{precioLive != null ? ` · actual ${simbolo} ${fmt(precioLive)}` : ''}</p>
                </div>
                <div className="tx-right">
                  <p className="tx-amount" style={{ color: 'var(--text)' }}>{simbolo} {fmt(valorActual ?? costo)}</p>
                  {ganancia != null && (
                    <span className={`tx-badge ${gananciaPositiva ? 'in' : 'out'}`}>
                      {gananciaPositiva ? '+' : ''}{simbolo} {fmt(ganancia)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn-ghost" onClick={() => abrirOperar(t.simbolo, 'vender')}>Vender</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CAUCIONES: colocar pesos a un plazo corto y cobrar un interés al vencer
// ──────────────────────────────────────────────────────────────────────────
// Plazos cortos (1 a 30, uno por uno) vs. plazos largos (saltos), para
// agrupar el <select> en dos bloques legibles en vez de 44 opciones sueltas
const esPlazoLargo = (dias) => dias > 30;

function PanelCauciones() {
  const [plazos, setPlazos] = useState([]);
  const [mercadoAbierto, setMercadoAbierto] = useState(true);
  const [horario, setHorario] = useState('');
  const [cauciones, setCauciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [monto, setMonto] = useState('');
  const [plazoElegido, setPlazoElegido] = useState(null);
  const [colocando, setColocando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const cargarCauciones = async () => {
    try {
      const res = await api.get('/cauciones');
      setCauciones(res.data);
    } catch { /* se mantiene lo que ya habia */ }
  };

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      try {
        const [resPlazos] = await Promise.all([api.get('/cauciones/plazos'), cargarCauciones()]);
        setPlazos(resPlazos.data.plazos);
        setMercadoAbierto(resPlazos.data.mercado_abierto);
        setHorario(resPlazos.data.horario);
        setPlazoElegido(resPlazos.data.plazos[0]?.plazo_dias ?? null);
      } catch {
        setError('No se pudieron cargar los plazos de caución');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const tasaElegida = plazos.find((p) => p.plazo_dias === plazoElegido)?.tasa_anual;
  const montoNum = Number(monto);
  const simulacion = tasaElegida && montoNum > 0
    ? {
      interes: Number((montoNum * (tasaElegida / 100) * (plazoElegido / 365)).toFixed(2)),
      total: Number((montoNum * (1 + (tasaElegida / 100) * (plazoElegido / 365))).toFixed(2)),
    }
    : null;

  const handleColocar = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    if (!montoNum || montoNum <= 0) {
      setError('Ingresá un monto mayor a 0');
      return;
    }
    setColocando(true);
    try {
      const res = await api.post('/cauciones', { monto: montoNum, plazo_dias: plazoElegido });
      setResultado({ ok: true, mensaje: res.data.mensaje });
      setMonto('');
      cargarCauciones();
    } catch (err) {
      setResultado({ ok: false, mensaje: err.response?.data?.error || 'No se pudo colocar la caución' });
    } finally {
      setColocando(false);
    }
  };

  return (
    <>
      <div className="card anim-up-1" style={{ marginBottom: 18 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Colocar una caución</h3>
        <p style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 14 }}>
          Prestás tus pesos a un plazo corto y cobrás un interés al vencimiento. Se debita de tu caja en ARS.
        </p>

        {cargando ? (
          <div className="loading-center"><div className="spinner" />Cargando…</div>
        ) : !mercadoAbierto ? (
          <div className="alert alert-warn" style={{ marginBottom: 0 }}>
            <Icon name="lock" size={16} />
            <span>El mercado de cauciones está cerrado. Se opera de {horario}. Volvé a entrar en el próximo horario de rueda.</span>
          </div>
        ) : (
          <form onSubmit={handleColocar}>
            <div className="field">
              <label className="label">Plazo</label>
              <select
                className="input"
                value={plazoElegido ?? ''}
                onChange={(e) => setPlazoElegido(Number(e.target.value))}
              >
                <optgroup label="1 a 30 días">
                  {plazos.filter((p) => !esPlazoLargo(p.plazo_dias)).map((p) => (
                    <option key={p.plazo_dias} value={p.plazo_dias}>
                      {p.plazo_dias} día{p.plazo_dias > 1 ? 's' : ''} · TNA {p.tasa_anual}%
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Plazos largos">
                  {plazos.filter((p) => esPlazoLargo(p.plazo_dias)).map((p) => (
                    <option key={p.plazo_dias} value={p.plazo_dias}>
                      {p.plazo_dias} días · TNA {p.tasa_anual}%
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="field">
              <label className="label">Monto</label>
              <input
                className="input"
                type="number"
                min="1"
                step="0.01"
                placeholder="Ej: 50000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>

            {simulacion && (
              <div className="recipient-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, marginBottom: 16 }}>
                <div className="receipt-row"><span className="k">Interés estimado</span><span className="v">$ {fmt(simulacion.interes)}</span></div>
                <div className="receipt-row"><span className="k">Cobrás al vencimiento</span><span className="v">$ {fmt(simulacion.total)}</span></div>
              </div>
            )}

            {error && <div className="alert alert-error"><Icon name="alert" size={16} /><span>{error}</span></div>}
            {resultado && (
              <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-error'}`}>
                <Icon name={resultado.ok ? 'check' : 'alert'} size={16} /><span>{resultado.mensaje}</span>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={colocando}>
              {colocando ? 'Colocando…' : 'Colocar caución'}
            </button>
          </form>
        )}
      </div>

      <h3 className="section-title anim-up-2">Mis cauciones</h3>
      {cauciones.length === 0 ? (
        <div className="empty anim-up-2">
          <div className="empty-icon"><Icon name="vault" size={26} /></div>
          <p>Todavía no colocaste ninguna caución</p>
        </div>
      ) : (
        <div className="anim-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cauciones.map((c) => (
            <div key={c.id_caucion} className="tx-item">
              <div className={`tx-icon ${c.estado === 'ACTIVA' ? 'in' : ''}`}>
                <Icon name="vault" size={19} />
              </div>
              <div className="tx-info">
                <p className="tx-desc">$ {fmt(c.monto)} a {c.plazo_dias} día(s) · TNA {c.tasa_anual}%</p>
                <p className="tx-date">
                  Vence {new Date(c.fecha_vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · cobrás $ {fmt(c.monto_a_cobrar)}
                </p>
              </div>
              <div className="tx-right">
                <span className={`tx-badge ${c.estado === 'ACTIVA' ? 'in' : 'out'}`}>
                  {c.estado === 'ACTIVA' ? 'Activa' : 'Liquidada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
