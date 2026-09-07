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
  confirmación y comprobante imprimible — procesadas vía Banco Central
- Lista de contactos con búsqueda y favoritos
- Depósitos en efectivo
- Historial de movimientos ("Movimientos") con:
  - resumen de total recibido/gastado y cantidad de movimientos,
  - dos ruedas de categorías al estilo Mercado Pago (gastos e ingresos, sin contar
    transferencias, que se listan aparte abajo),
  - filtro por período (hoy, esta semana, este mes, todo, o un rango de fechas propio),
  - gráfico de flujo de dinero por día y filtro por tipo de gasto
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
