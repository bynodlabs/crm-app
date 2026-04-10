# CRM Bigdata: Checklist Maestro

Estado al dia:

- [x] `npm run build`
- [x] `npm run test:sim:core`
- [x] `npm run test:sim:duplicates`
- [x] `npm run test:sim:workspace`
- [x] `npm run lint`

Notas rapidas:

- Las pruebas automáticas ya validan flujo core, aislamiento, reparto y duplicados.
- Las simulaciones que tocan `db.json` deben correrse en secuencia. Usa `npm run test:sim:all`.
- La ronda manual sigue siendo necesaria para UI, UX, CSV reales, WhatsApp y banderas.
- La validacion tecnica base ya esta en verde: build, lint y simulaciones.

## Bloque 1. Acceso, cuentas, persistencia y admin

- [x] Login correcto con usuario cliente
- [x] Login correcto con admin global
- [x] Registro de usuario nuevo
- [x] Sesion persiste al recargar
- [ ] Logout limpia sesion correctamente
- [x] Cambio de contraseña funciona
- [x] Usuario no puede cambiar contraseña de otro usuario
- [x] Admin puede entrar a panel global sin romper cuentas cliente
- [x] Un usuario no ve leads de otra cuenta
- [x] Un usuario no pisa configuracion de otra cuenta
- [ ] Idioma se guarda por usuario
- [ ] Tema claro/oscuro se guarda por usuario
- [ ] Plantilla WA se guarda por usuario
- [ ] Pestaña activa se guarda por usuario
- [ ] Filtros se guardan por usuario o workspace segun corresponda
- [ ] Admin ve total global de usuarios
- [ ] Admin ve total global de leads
- [ ] Admin ve informacion agregada correcta

## Bloque 2. Leads manuales, modal y prospeccion

- [ ] Crear lead manual lo guarda en el directorio
- [ ] Crear lead manual asigna pais correcto
- [ ] Crear lead manual asigna categoria correcta
- [x] Crear lead manual respeta workspace del usuario
- [ ] Crear lead manual bloquea duplicado real
- [ ] Enviar directo a prospeccion funciona
- [ ] Al hacer click en un lead abre modal
- [ ] Modal muestra nombre, correo, telefono, notas y estado
- [ ] Se puede editar y guardar
- [ ] Guardado actualiza la vista
- [ ] Historial se muestra correctamente
- [ ] Cerrar modal no rompe seleccion
- [ ] Autoasignacion llena la mesa
- [ ] Solo aparecen leads del usuario
- [ ] Marcar mensaje enviado funciona
- [ ] Abrir WhatsApp registra actividad
- [ ] Archivar lead funciona
- [ ] Restaurar lead funciona
- [ ] Descartar lead funciona
- [ ] Quitar lead del workspace funciona
- [ ] Notas guardan correctamente
- [ ] Estado del lead cambia correctamente desde Workspace

## Bloque 3. CSV, WhatsApp, duplicados, paises y banderas

- [ ] Primer CSV entra correctamente
- [x] Segundo upload del mismo CSV detecta duplicados
- [x] Duplicados no vuelven a entrar al directorio normal
- [x] Duplicados se guardan en archivo de duplicados
- [ ] El mensaje final muestra conteos reales
- [ ] CSV con columnas distintas sigue detectando numeros repetidos
- [ ] CSV con numeros con espacios o signos sigue detectando duplicados
- [ ] Importacion WA crea leads nuevos correctamente
- [ ] Importacion WA enriquece leads ya existentes cuando aplica
- [ ] Importacion WA detecta duplicados reales
- [ ] Leads WA respetan el workspace del usuario
- [ ] Sector detectado o seleccionado se conserva
- [ ] Boton “Archivar duplicados” funciona
- [ ] El modal de duplicados abre
- [ ] Los duplicados archivados aparecen en el modal
- [ ] Restaurar duplicados los devuelve al directorio
- [ ] Eliminar duplicados los borra del archivo
- [ ] Cada usuario ve solo sus duplicados
- [ ] Mexico muestra bandera MX
- [ ] Colombia muestra bandera CO
- [ ] Peru muestra bandera PE
- [ ] Republica Dominicana no cae en US por error
- [ ] Numeros con + detectan pais correcto
- [ ] Numeros con 00 detectan pais correcto
- [ ] Registros viejos mal detectados se corrigen al cargar
- [ ] Filtro por pais coincide con la bandera mostrada

## Bloque 4. Equipo, reparto, directorio y reportes

- [ ] Usuario puede ver miembros registrados con su codigo
- [x] Compartir leads a un referido funciona
- [x] El referido ve los leads compartidos en su cuenta
- [x] Los leads compartidos no aparecen en cuentas ajenas
- [x] Se conserva trazabilidad del lead compartido
- [ ] El lote compartido aparece en Mi Equipo
- [ ] Compartir a “pool general” se comporta como se espera
- [ ] Los leads aparecen en Nuevos correctamente
- [ ] Archivados aparecen en su pestaña
- [ ] Descartados aparecen en su pestaña
- [ ] Filtro por pais funciona
- [ ] Filtro por categoria funciona
- [ ] Filtro por estado funciona
- [ ] Filtro por sector funciona
- [ ] Filtro por origen funciona
- [ ] Filtro por responsable funciona
- [ ] Mezclar contactos funciona sin romper seleccion
- [ ] Seleccion masiva funciona
- [ ] Mover seleccion a prospeccion funciona
- [ ] Dashboard del usuario refleja solo su cuenta
- [ ] Reporte personal refleja solo su actividad
- [ ] Reporte de equipo refleja solo su estructura
- [ ] Conteos de nuevos, trabajados y contactados cuadran
- [ ] Metas mensuales funcionan
- [ ] Tendencias no mezclan datos de otras cuentas

## Bloque 5. Criterio de listo funcional

- [x] No hay mezcla de datos entre cuentas
- [x] No hay duplicados entrando como nuevos en segunda importacion
- [x] Compartir leads funciona de punta a punta
- [ ] Modal de lead y guardado funcionan siempre
- [ ] Paises y filtros son consistentes
- [ ] Reportes cuadran con datos reales
- [ ] Admin global funciona de punta a punta
- [ ] Flujo completo soporta uso diario sin romperse

## Bloque 6. Deuda tecnica y produccion

- [x] `npm run lint` limpio
- [ ] Eliminar codigo obsoleto
- [ ] Revisar servicios backend que ya no se usan
- [ ] Consolidar normalizacion de telefonos
- [ ] Reducir logica duplicada entre frontend y backend
- [ ] Preparar migracion a DB real
- [ ] Configurar entorno real para hosting
- [ ] Cerrar pruebas integrales manuales

## Secuencia de revision recomendada

1. Bloque 1 completo
2. Bloque 2 completo
3. Bloque 3 completo
4. Bloque 4 completo
5. Bloque 5 como cierre
6. Bloque 6 como salida a produccion
