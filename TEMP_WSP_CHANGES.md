# Cambios temporales de navegacion y WSP

Fecha: 2026-04-23

## Cambios activos

1. Se ocultaron temporalmente los accesos de `Inicio`, `Workspace` y `Herramientas`.
2. El menu visible principal quedo en `Directorio`, `Anadir Leads` y `WhatsApp API`.
3. En `Directorio General > Eliminados` se agrego un boton pequeno llamado `WSP`.
4. Para entrar a `Workspace / WSP` ahora se pide una contrasena basica.
5. La contrasena temporal actual es: `Ad1234567890@`
6. Desde `Directorio`, el icono de WhatsApp abre directo `wa.me` y ya no manda el lead a `Workspace`.

## Accesos protegidos con contrasena

- Boton `WSP` dentro de `Directorio General > Eliminados`.
- Abrir conversacion desde `Directorio General`.
- Abrir chat desde `Pipeline`.
- Envio a `Workspace` al crear un lead desde `Anadir Leads`.
- Reapertura automatica si el sistema recordaba la pestana `prospecting`.

## Cambio extra en Directorio

- El boton de WhatsApp en `Directorio General` ya no abre `Workspace`.
- Ahora abre el chat directo en WhatsApp Web / `wa.me`.
- Con eso el lead no cambia de etapa ni se mueve al flujo de `Workspace` solo por abrir WhatsApp desde `Directorio`.

## Cambio temporal en WhatsApp QR Group

- En `Anadir Leads > WhatsApp > WhatsApp QR Group` ahora se ocultan comunidades, grupos de anuncios y grupos ligados a comunidades.
- Solo se listan grupos normales para importacion.
- La carga de participantes ahora se hace por grupo, de forma secuencial, para evitar picos innecesarios.
- La vista previa ya no renderiza todo de golpe.
- La tabla muestra primero 10 contactos y va cargando 10 mas conforme el usuario baja.
- Tambien se dejaron fuera participantes sin numero de telefono resoluble para evitar ruido y carga innecesaria.

## Archivos tocados

- `src/App.jsx`
- `src/views/DataTableView.jsx`
- `src/views/AddRecordView.jsx`
- `src/views/PipelineView.jsx`
- `server/src/services/whatsapp-service.js`

## Guia rapida para revertir

1. En `src/App.jsx`, volver a mostrar los botones `Inicio`, `Workspace` y `Herramientas` en desktop y mobile.
2. En `src/App.jsx`, eliminar:
   `TEMP_WORKSPACE_PASSWORD`
   `getWorkspaceAccessStorageKey`
   `hasWorkspaceAccess`
   `isWorkspaceAccessReady`
   `openWorkspace`
   `requestWorkspaceAccess`
   y el `useEffect` que saca de `prospecting` cuando no hay acceso.
3. En `src/views/DataTableView.jsx`, quitar el boton pequeno `WSP` y restaurar la prop anterior si se quiere volver a abrir `Workspace` sin clave.
4. En `src/views/DataTableView.jsx`, si quieres volver al comportamiento anterior del icono de WhatsApp en `Directorio`, restaurar `onOpenWorkspaceConversation?.(r)` en lugar de abrir `wa.me`.
5. En `src/views/AddRecordView.jsx`, restaurar:
   `setActiveTab(formData.sendToProspecting ? 'prospecting' : 'database');`
6. En `src/views/PipelineView.jsx`, restaurar:
   `setActiveTab?.('prospecting');`
7. En `src/views/AddRecordView.jsx`, quitar el filtro de comunidades y la carga progresiva del preview si quieres volver a mostrar todos los contactos de golpe.
8. En `server/src/services/whatsapp-service.js`, quitar el filtro de `isCommunity`, `isCommunityAnnounce` y `linkedParent` si quieres volver a listar tambien comunidades y anuncios.

## Nota

Esto es solo una barrera visual y basica para el flujo temporal. No sustituye autenticacion real.
