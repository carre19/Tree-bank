// Traduce cada tipo_movimiento (el que ya guarda el backend) a una categoría
// de gasto/ingreso "amigable", al estilo Mercado Pago: un ícono, una
// etiqueta y si mueve plata para adentro, para afuera, o ninguna (rechazada).
// Vive acá y no en cada página porque Movimientos y el resumen del Dashboard
// necesitan exactamente el mismo criterio.

export const CATEGORIAS = {
  TRANSFERENCIAS: { label: 'Transferencias', icon: 'send' },
  DEPOSITOS:      { label: 'Depósitos',      icon: 'deposit' },
  TARJETA:        { label: 'Tarjeta',        icon: 'card' },
  PRESTAMOS:      { label: 'Préstamos',      icon: 'loan' },
  SEGUROS:        { label: 'Seguros',        icon: 'insurance' },
  SERVICIOS:      { label: 'Servicios',      icon: 'receipt' },
  CAMBIO:         { label: 'Cambio de divisa', icon: 'swap' },
};

// signo: 'in' (suma), 'out' (resta), 'neutro' (no llegó a mover plata)
const MOVIMIENTOS = {
  TRANSFERENCIA_INGRESO:  { categoria: 'TRANSFERENCIAS', signo: 'in',  label: 'Transferencia recibida' },
  TRANSFERENCIA_EGRESO:   { categoria: 'TRANSFERENCIAS', signo: 'out', label: 'Transferencia enviada' },
  TRANSFERENCIA_RECHAZADA:{ categoria: 'TRANSFERENCIAS', signo: 'neutro', label: 'Transferencia rechazada' },
  DEPOSITO:               { categoria: 'DEPOSITOS',      signo: 'in',  label: 'Depósito en efectivo' },
  TARJETA_COMPRA:         { categoria: 'TARJETA',         signo: 'out', label: 'Compra con tarjeta' },
  TARJETA_PAGO:           { categoria: 'TARJETA',         signo: 'out', label: 'Pago de resumen' },
  PRESTAMO_OTORGADO:      { categoria: 'PRESTAMOS',       signo: 'in',  label: 'Préstamo acreditado' },
  PRESTAMO_CUOTA:         { categoria: 'PRESTAMOS',       signo: 'out', label: 'Cuota de préstamo' },
  SEGURO_PRIMA:           { categoria: 'SEGUROS',         signo: 'out', label: 'Prima de seguro' },
  SERVICIO_PAGO:          { categoria: 'SERVICIOS',       signo: 'out', label: 'Pago de servicio' },
  CAMBIO_INGRESO:         { categoria: 'CAMBIO',          signo: 'in',  label: 'Cambio de divisa' },
  CAMBIO_EGRESO:          { categoria: 'CAMBIO',          signo: 'out', label: 'Cambio de divisa' },
};

const DEFAULT = { categoria: 'TRANSFERENCIAS', signo: 'out', label: 'Movimiento' };

// Info completa (categoría + ícono + signo + etiqueta) de un tipo_movimiento
export function infoMovimiento(tipo_movimiento) {
  const m = MOVIMIENTOS[tipo_movimiento] || DEFAULT;
  const cat = CATEGORIAS[m.categoria];
  return { ...m, icon: cat.icon, categoriaLabel: cat.label };
}

// Lista de categorías presentes en un conjunto de movimientos, en el orden
// fijo de CATEGORIAS (para armar los chips de filtro sin repetir ni mezclar orden)
export function categoriasPresentes(movimientos) {
  const set = new Set(movimientos.map((m) => infoMovimiento(m.tipo_movimiento).categoria));
  return Object.keys(CATEGORIAS).filter((c) => set.has(c));
}
