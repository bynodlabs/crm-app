# Project Audit

## Estado actual

El proyecto funciona como prototipo de una SPA en React + Vite.

Puntos positivos:
- Compila correctamente en producción con `npm run build`.
- La UI principal ya existe y cubre login, dashboard, directorio, importación, equipo y reportes.
- Ya hay branding integrado y persistencia local básica con `localStorage`.

Puntos críticos:
- Toda la app vive casi por completo en un único archivo: `src/App.jsx` con ~5000 líneas.
- La lógica de frontend, autenticación, persistencia, “backend” y “base de datos” están mezcladas.
- No existe API real ni base de datos real.
- La seguridad actual no es apta para producción.

## Diagnóstico técnico

### Frontend

Problemas:
- `src/App.jsx` concentra demasiadas responsabilidades.
- Hay estilos inline, lógica de negocio, estados globales, vistas y utilidades en el mismo sitio.
- El crecimiento del proyecto será costoso y frágil si no se modulariza.

Qué debería salir de `App.jsx`:
- `components/`
- `views/`
- `hooks/`
- `lib/`
- `data/`
- `styles/`

Separación recomendada:
- `views/LoginView.jsx`
- `views/DashboardView.jsx`
- `views/ProspectingWorkspace.jsx`
- `views/AddRecordView.jsx`
- `views/DataTableView.jsx`
- `views/NetworkView.jsx`
- `views/ReportsView.jsx`
- `components/BrandLogo.jsx`
- `components/AvatarInitials.jsx`
- `components/NavItem.jsx`
- `components/SettingsDrawer.jsx`
- `components/ShareLeadsModal.jsx`
- `lib/storage.js`
- `lib/date.js`
- `lib/lead-utils.js`
- `lib/constants.js`

### Estado y persistencia

Ahora mismo:
- Se usa `localStorage` como persistencia local.
- Sirve para demo y pruebas locales.
- No sirve como fuente de verdad para una app multiusuario real.

Riesgos:
- Cada navegador tendría su propia “base”.
- No hay sincronización entre usuarios.
- No hay control real de sesiones.
- Los datos pueden borrarse si el navegador limpia almacenamiento.

### Backend

Ahora mismo:
- No existe backend real.
- Login, registro, roles, equipo, importaciones y links compartidos viven en el frontend.

Esto implica:
- Las credenciales están expuestas en el cliente.
- Cualquier usuario técnico podría inspeccionar la lógica.
- No hay validación centralizada.

Backend real recomendado:
- Node.js con Express o NestJS.
- API REST inicialmente.
- Autenticación con JWT o sesiones.
- Endpoints para:
  - auth
  - users
  - leads
  - imports
  - teams
  - reports
  - shared-links

### Base de datos

Ahora mismo:
- Los datos son estructuras JS persistidas en `localStorage`.

Base de datos recomendada:
- PostgreSQL

Tablas mínimas:
- `users`
- `leads`
- `lead_history`
- `duplicate_leads`
- `team_links` o `referrals`
- `shared_links`
- `imports`

## Riesgos de producción

Antes de desplegar en hosting real, hay que resolver:
- autenticación insegura
- credenciales hardcodeadas
- ausencia de API
- ausencia de base de datos
- archivo monolítico demasiado grande
- reglas de negocio duplicadas o difíciles de mantener

## Ruta recomendada por fases

### Fase 1: Ordenar frontend actual
- extraer componentes y vistas de `App.jsx`
- centralizar constantes y helpers
- limpiar estados repetidos
- mantener la app visualmente igual

### Fase 2: Diseñar modelo de datos
- definir entidades reales
- mapear campos actuales de leads, usuarios, historial, equipo y duplicados
- decidir relaciones

### Fase 3: Crear backend
- levantar servidor
- mover auth
- mover CRUD de leads
- mover importación CSV
- mover reportes básicos

### Fase 4: Integrar base de datos
- crear esquema
- migraciones
- conexión desde backend
- reemplazar `localStorage` como fuente principal

### Fase 5: Deploy
- frontend build
- backend desplegado
- base de datos activa
- dominio configurado

## Recomendación para HostGator

HostGator puede servir bien para:
- frontend estático
- WordPress
- hosting tradicional PHP

Pero si quieres una app moderna con:
- React SPA
- backend Node
- API propia
- PostgreSQL

entonces hay que confirmar primero si tu plan de HostGator soporta:
- Node.js
- procesos persistentes
- variables de entorno
- acceso a base de datos adecuada

Si no lo soporta bien, normalmente conviene:
- frontend en Vercel o Netlify
- backend en Railway, Render o VPS
- base de datos en Neon, Supabase o Railway

Si quieres mantener todo ligado a tu dominio en HostGator, también se puede:
- dominio en HostGator
- frontend/backend en otro proveedor
- DNS apuntando desde HostGator

## Siguiente paso recomendado

Empezar por Fase 1:
- modularizar `src/App.jsx`
- extraer branding, login, sidebar, utilidades y persistencia
- dejar el frontend ordenado antes de construir backend real
