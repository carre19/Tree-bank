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
