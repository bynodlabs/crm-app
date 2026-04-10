# Deploy En VPS (Hostinger)

## Recomendación

Esta es la opción más estable para este proyecto.

## Pasos

### 1. Entrar al servidor

```bash
ssh usuario@IP_DEL_SERVIDOR
```

### 2. Instalar Node.js

Usa Node 20 o superior.

### 3. Subir el proyecto

Puedes subirlo por:
- Git
- SFTP
- zip descomprimido

### 4. Instalar dependencias

```bash
npm install
```

### 5. Crear `.env`

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

### 6. Build

```bash
npm run build
```

### 7. Arranque manual

```bash
npm start
```

### 8. Arranque persistente con PM2

```bash
npm install -g pm2
pm2 start server/index.js --name crm-new-2026
pm2 save
pm2 startup
```

### 9. Nginx reverse proxy

Ejemplo básico:

```nginx
server {
  server_name tudominio.com www.tudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 10. SSL

```bash
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

## Resultado

La misma app Node sirve:
- frontend compilado (`dist`)
- backend (`/api`)

No necesitas WordPress para este proyecto.
