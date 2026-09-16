import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import api from '../api/api';

// Ganancia/perdida NO REALIZADA de las acciones argentinas en cartera: no es
// un movimiento real (no se acredito ni debito nada), asi que no sale de
// /movimientos — se arma en el cliente cruzando las tenencias con la
// cotizacion en vivo, y se refresca solo cada INTERVALO_MS para que la cifra
// "+$" se vaya moviendo sin que el usuario recargue la pagina.
const INTERVALO_MS = 15000;

const fmt = (v) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Hook: trae tenencias + cotizaciones de ACCION_AR y devuelve la ganancia
// total en ARS (o null mientras carga / si no hay nada en cartera)
export function useGananciaInversionesArs() {
  const [ganancia, setGanancia] = useState(null);
  const [cargando, setCargando] = useState(true);
  const intervaloRef = useRef(null);

  useEffect(() => {
    let activo = true;

    const refrescar = async () => {
      try {
        const [tenenciasRes, cotizacionesRes] = await Promise.all([
          api.get('/inversiones/tenencias'),
          api.get('/inversiones/cotizaciones/ACCION_AR'),
        ]);
        if (!activo) return;

        const tenenciasArs = tenenciasRes.data.filter((t) => t.mercado === 'ACCION_AR' && Number(t.cantidad) > 0);
        if (tenenciasArs.length === 0) {
          setGanancia(null);
          return;
        }

        const precios = new Map(cotizacionesRes.data.datos.map((c) => [c.simbolo, c.precio]));
        const total = tenenciasArs.reduce((sum, t) => {
          const precioLive = precios.get(t.simbolo) ?? t.precio_actual;
          if (precioLive == null) return sum;
          const valorActual = precioLive * Number(t.cantidad);
          const costo = Number(t.precio_promedio) * Number(t.cantidad);
          return sum + (valorActual - costo);
        }, 0);
        setGanancia(total);
      } catch {
        if (activo) setGanancia(null);
      } finally {
        if (activo) setCargando(false);
      }
    };

    refrescar();
    intervaloRef.current = setInterval(refrescar, INTERVALO_MS);
    return () => { activo = false; clearInterval(intervaloRef.current); };
  }, []);

  return { ganancia, cargando };
}

// Item visual, al mismo estilo "tx-item" que usan Movimientos y el Dashboard,
// para que quede integrado como uno mas de la lista en vez de un cartel aparte.
export default function GananciaInversionesItem({ ganancia }) {
  if (ganancia == null) return null;
  const positiva = ganancia >= 0;
  return (
    <div className="tx-item">
      <div className={`tx-icon ${positiva ? 'in' : 'out'}`}>
        <Icon name="trending" size={19} />
      </div>
      <div className="tx-info">
        <p className="tx-desc">Ganancia en inversiones</p>
        <p className="tx-date">Variación no realizada de tus acciones en cartera, en vivo</p>
      </div>
      <div className="tx-right">
        <p className={`tx-amount ${positiva ? 'in' : 'out'}`}>
          {positiva ? '+' : '-'}$ {fmt(Math.abs(ganancia))}
        </p>
        <span className={`tx-badge ${positiva ? 'in' : 'out'}`}>Inversiones</span>
      </div>
    </div>
  );
}
