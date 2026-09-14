# 🌳 Tree Bank — Sistema de Homebanking

Proyecto integrador de Prácticas Profesionalizantes II.
Banco digital interoperable con el Banco Central, con backend en Node.js/Express
y frontend en React/Vite.

## Estructura del repositorio

| Carpeta | Descripción |
|---------|-------------|
| `AS2_pp1_extracted/AS2_pp1/` | **Backend** — API REST (Express + PostgreSQL/Supabase + JWT + bcrypt) |
| `homebanking-front/` | **Frontend** — React + Vite (login, dashboard, transferencias, depósitos, historial, perfil) |
| `tree_bank_documentacion.docx` | Documentación técnica completa del sistema |

## Puesta en marcha

### Backend
```bash
cd AS2_pp1_extracted/AS2_pp1
npm install
cp .env.example .env   # completar con las credenciales (Supabase, Banco Central, JWT)
npm run dev            # http://localhost:3001
```

### Frontend
```bash
cd homebanking-front
npm install
npm run dev            # http://localhost:5173
```

> ⚠️ El archivo `.env` con las credenciales reales **no se sube al repositorio**.
> Usar `.env.example` como plantilla. En producción hay que setear además
> `CORS_ORIGINS` con el dominio real del frontend (ver [Seguridad](#seguridad)).

## Roles

El sistema tiene dos tipos de usuario, guardados en las tablas `Roles` / `Roles_x_Personas`:

- **Cliente** (por defecto): opera su propia cuenta (transferencias, depósitos, historial, perfil).
- **ADMIN**: no opera cuentas propias, entra directo a un panel (`/admin`) donde ve **todas** las
  cuentas del banco y puede:
  - **Bloquear / reactivar / cerrar** (estado reversible): una cuenta bloqueada o cerrada no
    puede transferir ni depositar hasta que un admin la reactive.
  - **Eliminar para siempre** (`DELETE /api/admin/cuentas/:idProducto`, irreversible): borra la
    cuenta y todo su historial de movimientos. Solo funciona si el saldo es $0 y la persona no
    tiene tarjetas de crédito activas (préstamos pendientes); si no, el backend rechaza el pedido
    con el motivo.

El rol se calcula en el login (`POST /api/auth/login`) y viaja dentro del JWT, así el backend no
necesita consultar la base de datos en cada pedido protegido (`middleware/authMiddleware.js` →
`verificarAdmin`).

Para habilitar el panel en una base de datos ya existente, correr una vez
`AS2_pp1_extracted/AS2_pp1/init/04_admin_role.sql` en el SQL Editor de Supabase, reemplazando el
DNI de ejemplo por el de la persona que va a administrar el banco.

Para el día a día (dar o quitar el rol a alguien, o resetear una contraseña) es más simple usar
`scripts/admin.js` desde el servidor — no hay ningún endpoint de la API que pueda otorgar el rol
ADMIN, a propósito: sería el agujero de seguridad más grande del sistema.

```bash
cd AS2_pp1_extracted/AS2_pp1
node scripts/admin.js listar                    # lista los ADMIN actuales
node scripts/admin.js promover <dni>             # le da el rol ADMIN a una persona
node scripts/admin.js quitar <dni>               # le quita el rol (no deja el banco sin ninguno)
node scripts/admin.js password <dni> <nueva>     # define o resetea una contraseña
```

## Funcionalidades principales

- Apertura de cuenta con CBU y alias asignados por el Banco Central
- Login con DNI y contraseña (bcrypt + JWT)
- Transferencias por CBU **o alias** con verificación de destinatario,
  confirmación y comprobante imprimible — procesadas vía Banco Central. Quien ya abrió su
  caja en dólares (desde Cambio) puede elegir transferir y recibir en ARS o en USD; el
  backend rechaza cualquier intento de mover plata entre una caja en ARS y una en USD sin
  pasar por Cambio, para que no funcione como un cambio de divisa gratuito
- Lista de contactos con búsqueda y favoritos
- Depósitos en efectivo
- Historial de movimientos ("Movimientos") con:
  - resumen de total recibido/gastado y cantidad de movimientos,
  - dos ruedas de categorías al estilo Mercado Pago (gastos e ingresos, sin contar
    transferencias, que se listan aparte abajo),
  - filtro por período (hoy, esta semana, este mes, todo, o un rango de fechas propio),
  - gráfico de flujo de dinero por día y filtro por tipo de gasto
- Pago de servicios (agua, luz, gas) con factura simulada
- Recarga de celular (Movistar, Personal, Claro) en denominaciones fijas, débito directo
  de la caja en ARS
- Reportes de problemas: cualquier usuario puede reportar algo que no funcionó desde
  cualquier pantalla de la app; el panel de administrador los lista y permite marcarlos
  como resueltos (ver [Reportes de problemas](#reportes-de-problemas))
- Inversiones al estilo IOL: acciones argentinas y extranjeras a precio real en vivo, y
  cauciones a plazo (ver [Inversiones](#inversiones))
- Perfil editable con foto, cambio de alias y de contraseña
- Sincronización automática con el Banco Central cada 15 minutos

## Seguridad

- **Autenticación**: contraseñas con bcrypt, sesiones con JWT (8 hs de expiración). El servidor
  no arranca si falta `JWT_SECRET` en el `.env`.
- **Autorización por rol**: los endpoints de back-office (`/api/personas`, `/api/tablas/:tabla`,
  `/api/admin/*`, `/api/central-deudores/:dni`, `/api/bancos/nombre`, `/api/sync`) requieren token
  y rol ADMIN. Todo lo demás valida además que el recurso pedido (cuenta, préstamo, tarjeta,
  póliza, reserva) le pertenezca a la persona del token, no a otra.
- **`/api/tablas/:tabla`** nunca devuelve `password_hash`, ni siquiera a un ADMIN.
- **Límite de intentos**: `/auth/login`, `/auth/register` y `/auth/olvide-password` cortan a los
  10 intentos fallidos por IP cada 15 minutos. Un login correcto reinicia el contador.
- **CORS**: solo se aceptan pedidos desde los orígenes listados en `CORS_ORIGINS` (por defecto,
  los puertos locales de Vite).
- **Validación de entradas** centralizada en `utils/validaciones.js`: montos, DNI, email, texto
  libre y enteros se validan con el mismo criterio en todos los controllers (rechaza `Infinity`,
  notación científica, texto con basura pegada, arrays, etc., algo que un `parseFloat` suelto
  dejaba pasar).
- **Errores**: en producción (`NODE_ENV=production`) las respuestas 5xx nunca exponen el mensaje
  interno (de Postgres, de axios, etc.) — ese detalle solo queda en el log del servidor.

## Reportes de problemas

Cualquiera puede reportar un problema desde el botón "Reportar un problema" (visible en el
sidebar y en la topbar de toda la app, tanto para clientes como para el admin) — funciona
logueado o no, por si el problema es justo no poder entrar.

- `POST /api/reportes`: público, limitado a 8 pedidos por IP cada 15 minutos para frenar spam.
  Si el pedido trae un token válido, el reporte queda asociado a esa persona; si no, queda anónimo.
- `GET /api/reportes/mios`: requiere token. El propio usuario ve los reportes que mandó estando
  logueado (con su estado, ABIERTO o RESUELTO), directamente debajo del formulario en
  "Reportar un problema" — antes de esto, una vez enviado el reporte no había forma de volver a
  leerlo, solo el admin lo veía.
- `GET /api/admin/reportes` y `PUT /api/admin/reportes/:id/estado`: solo ADMIN. Listan los
  reportes (más recientes primero) y permiten marcarlos como resueltos o reabrirlos.
- Aviso opcional por webhook: si se completa `REPORTES_WEBHOOK_URL` en el `.env` (acepta una URL
  de Discord o de Slack), cada reporte nuevo manda un aviso ahí al toque. Sin configurar, los
  reportes se siguen guardando igual — alcanza con revisarlos en el panel de administrador.

## Préstamos

Desde `/prestamos`, un cliente simula y pide un préstamo en ARS a 3, 6, 12 o 24 cuotas
(`prestamoModel.TASAS_POR_CUOTAS`, la tasa total sube con el plazo), acreditado de inmediato en
su cuenta si se aprueba.

Cuánto se le puede prestar a alguien **depende de lo que esa persona movió realmente por el
banco**, no de un monto fijo igual para todos — sin este límite, una cuenta con $2 podía pedir
un préstamo de mil millones con solo pasar el chequeo de la Central de Deudores:

- `Persona.getTotalIngresadoReal(id_cuenta)` suma únicamente depósitos y transferencias
  recibidas (`DEPOSITO`, `TRANSFERENCIA_INGRESO`) — a propósito no cuenta plata que entró por
  otro préstamo o por una caución, para que no se pueda "autoabastecer" el límite.
- El límite total prestable es `PISO_PRESTAMO (5000) + capacidad × MULTIPLO_CAPACIDAD (3)`, y se
  compara contra la deuda activa de otros préstamos más el nuevo que se está pidiendo
  (`Prestamo.getDeudaActivaTotal`). Si se pasa, el backend rechaza con 400 y devuelve cuánto sí
  podría pedir.
- Pagar una cuota (`POST /api/prestamos/:id/pagar-cuota`) también valida que el saldo disponible
  de la cuenta alcance, y todo el cobro (descuento de saldo + actualización del préstamo, y su
  cierre si era la última cuota) va en una única transacción de base de datos.

## Integridad de las operaciones con dinero

Todas las operaciones que mueven saldo (transferencias, depósitos, préstamos, tarjetas, seguros,
cauciones, inversiones, cambio de divisas, pago de servicios y recargas) están envueltas en una
transacción de PostgreSQL (`BEGIN` / `COMMIT` / `ROLLBACK`): si un paso intermedio falla, no queda
plata descontada ni un movimiento a mitad de registrar. Además, el descuento de saldo es una
operación atómica en una sola sentencia SQL (`UPDATE ... WHERE saldo >= $1`), así dos pedidos
simultáneos sobre la misma cuenta no pueden dejarla en negativo por una condición de carrera.

## Inversiones

Desde `/inversiones`, un cliente puede operar tres tipos de instrumento, con pestañas
independientes para cada uno:

- **Acciones argentinas** (`ACCION_AR`) — se compran y venden en ARS contra la caja en pesos.
- **Acciones extranjeras** (`ACCION_EX`) — mercado de EE.UU. (miles de tickers); mientras no se
  busca nada se muestra un panel acotado de populares (AAPL, MSFT, TSLA, etc.). Se operan en USD
  contra la caja en dólares — hay que abrirla primero desde el Dashboard (mismo flujo que Cambio).
- **Cauciones** — se presta dinero a cualquier plazo de 1 a 30 días, o a uno de los plazos largos
  (40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300 o 365 días), y se cobra un interés al
  vencimiento; se liquidan solas por cron una vez por día. Al igual que en el mercado real, solo se
  pueden colocar en horario de rueda (11 a 17hs, días hábiles, hora Argentina) — fuera de ese
  horario la tasa es 0% y el formulario se deshabilita hasta la próxima apertura.

**Cotizaciones reales, no simuladas**: `services/mercadoService.js` consulta
[data912.com](https://data912.com), una API pública y gratuita (sin API key) con datos reales de
BYMA y del mercado estadounidense. Se cachea 15 segundos de nuestro lado para no saturarla; si
data912 no responde, se devuelve el último valor bueno conocido en vez de romper la pantalla. El
precio de cada compra/venta lo fija siempre el servidor con esa cotización — nunca se confía en un
precio que venga del body del pedido.

**Cauciones: por qué la tasa es simulada.** A diferencia de las acciones, la tasa de caución de
BYMA (el índice que calculan en tiempo real) no tiene una API pública y gratuita — BYMA la vende
como dato de mercado a las casas de bolsa. Por eso `models/caucionModel.js` usa una curva de tasas
calculada por plazo (logarítmica: arranca en 32% TNA al día y sube hasta ~37% al año), del orden de
las tasas reales en pesos — mismo espíritu que `TASAS_POR_CUOTAS` en `prestamoModel.js` para los
préstamos —, y el interés se calcula con la fórmula de interés simple estándar
(`monto × tasa_anual/100 × plazo_dias/365`).

**Cauciones: horario de rueda.** `mercadoAbierto()` calcula la hora actual en la zona horaria
`America/Argentina/Buenos_Aires` (con `Intl.DateTimeFormat`, sin depender de en qué zona horaria
corra el servidor) y solo permite colocar entre las 11:00 y las 17:00 de un día hábil. Fuera de ese
horario, `GET /api/cauciones/plazos` devuelve `mercado_abierto: false` y tasa 0% en todos los
plazos, y `POST /api/cauciones` rechaza cualquier intento con un 400.

**Precio histórico**: al hacer clic en cualquier símbolo (del panel de cotizaciones o de la propia
cartera) se abre un gráfico de precio de cierre, con selector de período (1M/3M/6M/1A/MAX) y un
tooltip que sigue al mouse mostrando precio y fecha exactos al pasar por encima del gráfico. Para
acciones argentinas, data912.com tiene un endpoint de histórico propio con serie diaria completa
desde 2002; para extranjeras no lo tiene, así que se usa el chart API público de Yahoo Finance
(`query1.finance.yahoo.com/v8/finance/chart`), sin API key. Cada símbolo+período se cachea 10
minutos del lado del servidor.

Endpoints (todos requieren token, se opera siempre contra la cuenta propia):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/inversiones/cotizaciones/:mercado` | Panel completo en vivo (`ACCION_AR` o `ACCION_EX`) |
| GET | `/api/inversiones/historico/:mercado/:simbolo?rango=` | Serie de cierres (`1M`\|`3M`\|`6M`\|`1A`\|`MAX`) |
| GET | `/api/inversiones/tenencias` | Cartera del usuario, con la cotización actual de cada símbolo |
| POST | `/api/inversiones/comprar` | `{ mercado, simbolo, cantidad }` |
| POST | `/api/inversiones/vender` | `{ mercado, simbolo, cantidad }` |
| GET | `/api/cauciones/plazos` | Tabla de tasas vigente por plazo |
| GET | `/api/cauciones` | Cauciones del usuario |
| POST | `/api/cauciones` | `{ monto, plazo_dias }` |
