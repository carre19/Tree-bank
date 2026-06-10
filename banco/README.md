# Tree Bank - Backend

API REST del sistema de homebanking Tree Bank.

## Instalacion

```bash
npm install
```

Copiar `.env.example` como `.env` y completar los datos:

```bash
cp .env.example .env
```

## Iniciar el servidor

```bash
npm run dev
```

El servidor corre en `http://localhost:3001`

## Panel de administracion

Con el servidor corriendo, abrir en el navegador:

```
http://localhost:3001
```

## Endpoints principales

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/auth/register | Crear contrasena |
| POST | /api/auth/login | Iniciar sesion |
| POST | /api/personas | Registrar cliente |
| POST | /api/transferencias | Realizar transferencia |
| POST | /api/depositos | Realizar deposito |
| GET | /api/movimientos/:id | Historial de cuenta |
| GET | /api/bancos | Listar bancos |
