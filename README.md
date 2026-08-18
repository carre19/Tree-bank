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
> Usar `.env.example` como plantilla.

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

## Funcionalidades principales

- Apertura de cuenta con CBU y alias asignados por el Banco Central
- Login con DNI y contraseña (bcrypt + JWT)
- Transferencias por CBU **o alias** con verificación de destinatario,
  confirmación y comprobante imprimible — procesadas vía Banco Central
- Lista de contactos con búsqueda y favoritos
- Depósitos en efectivo
- Historial de movimientos con resumen, filtros y gráfico de flujo de dinero
- Perfil editable con foto, cambio de alias y de contraseña
- Sincronización automática con el Banco Central cada 15 minutos
