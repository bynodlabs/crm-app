# CRM Backend Base

Primera base de backend local para el proyecto:

- API HTTP en `server/index.js`
- Persistencia simple en `server/data/db.json`
- Servicios separados de `auth`, `users` y `records`

Scripts:

- `npm run dev:api`
- `npm run start:api`
- `npm run test:sim:duplicates`

Variables de entorno útiles:

- `API_HOST`
- `API_PORT`
- `CORS_ORIGIN`
- `SESSION_TTL_MS`
- `API_BODY_LIMIT_BYTES`
- `AUTH_RATE_LIMIT`
- `AUTH_RATE_WINDOW_MS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Rutas iniciales:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/users`
- `PATCH /api/users/password`
- `GET /api/records`
- `POST /api/records`
- `PATCH /api/records/:id`
- `PATCH /api/records/bulk-status`
- `POST /api/records/clean-duplicates`

Esto todavía no reemplaza `localStorage` del frontend. El siguiente paso es conectar la UI a estas rutas y luego migrar esta persistencia JSON a una base real como PostgreSQL o MySQL.

Endurecimientos ya incluidos:

- hashing de contraseñas con `scrypt`
- migración automática de contraseñas antiguas en texto plano
- expiración de sesiones por TTL
- rate limiting básico para login y registro
- límite de tamaño para request body JSON
- credenciales admin configurables por entorno
