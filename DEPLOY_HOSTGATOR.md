# Deploy En HostGator

## Conclusión rápida

Este proyecto funciona en HostGator **solo si tu plan tiene soporte real para aplicaciones Node.js** en cPanel.

Si tu plan compartido **no** tiene Node.js:
- no funciona correctamente ahí
- necesitas VPS o cambiar de plataforma

## Qué subir

Sube el proyecto completo, excepto:
- `node_modules`
- `.DS_Store`

Sí debes subir:
- `dist`
- `server`
- `src`
- `public`
- `package.json`
- `package-lock.json`
- `.env`

## Build local antes de subir

```bash
npm install
npm run build
```

## Variables de entorno mínimas

Crea un `.env` con algo como esto:

```env
VITE_API_URL=/api
HOST=0.0.0.0
PORT=3001
API_HOST=0.0.0.0
API_PORT=3001
CORS_ORIGIN=https://tudominio.com
ADMIN_EMAIL=admin@bigdata.com
ADMIN_PASSWORD=TU_PASSWORD_SEGURA
SESSION_TTL_MS=604800000
API_BODY_LIMIT_BYTES=1048576
AUTH_RATE_LIMIT=10
AUTH_RATE_WINDOW_MS=900000
```

## En cPanel / HostGator Node App

1. Crea la aplicación Node.js.
2. Elige la versión de Node disponible.
3. Como `Application root`, apunta a la carpeta del proyecto.
4. Como `Application startup file`, usa:

```text
server/index.js
```

5. Entra a la terminal de cPanel y corre:

```bash
npm install
npm run build
```

6. Reinicia la aplicación Node desde cPanel.

## Dominio

Si HostGator te deja asignar dominio o subdominio a la app Node:
- apunta el dominio a la aplicación Node

Si no te deja:
- este proyecto no te conviene en ese plan compartido
- mejor usa VPS

## Nota importante

Este proyecto guarda datos en:

```text
server/data/db.json
```

Eso funciona para pruebas o proyectos pequeños.
Para volumen alto, VPS es la opción correcta.
