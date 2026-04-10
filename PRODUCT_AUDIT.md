# CRM Bigdata: Especificacion Funcional, Flujo Ideal y Auditoria

## 1. Vision del producto

Este software debe funcionar como un CRM comercial multiusuario orientado a captacion, clasificacion, seguimiento y distribucion de leads.

Cada cliente o usuario que entra al sistema debe tener:

- su propio login
- su propio backoffice
- su propia base de leads
- sus propias preferencias de interfaz
- sus propias metricas
- opcion de compartir leads con miembros de su equipo

Adicionalmente, debe existir un panel maestro de administracion global para la cuenta interna de Bigdata, desde el cual se pueda observar:

- todos los usuarios registrados
- todas las cuentas
- todos los leads globales
- actividad general
- metricas agregadas
- estructura comercial
- soporte y supervision

En teoria, el producto no debe sentirse como una sola base compartida con filtros visuales, sino como un sistema con:

- cuentas separadas por cliente
- equipo comercial asociado a cada cuenta
- permisos claros
- trazabilidad
- operacion estable

---

## 2. Roles del sistema

### 2.1 Usuario cliente

Es el dueño de una cuenta.

Debe poder:

- iniciar sesion
- gestionar sus propios leads
- importar leads manualmente, por CSV o por WhatsApp
- ver directorio
- mover leads a prospeccion
- escribir notas
- cambiar estados
- revisar metricas
- compartir leads a miembros de su equipo
- configurar idioma, tema y plantilla WA

### 2.2 Miembro de equipo

Es un usuario ligado por codigo de invitacion o estructura de equipo.

Debe poder:

- iniciar sesion con su propia cuenta
- ver su propio backoffice
- recibir leads compartidos por el lider
- trabajar solo los leads que le fueron asignados o compartidos
- ver sus metricas
- no ver informacion privada global del lider salvo lo que se le comparta

### 2.3 Administrador maestro

Es la cuenta interna de Bigdata.

Debe poder:

- entrar al panel global
- ver todas las cuentas
- ver todos los leads globales
- ver metricas globales
- impersonar usuarios o revisar cuentas
- detectar fallos de operacion
- auditar actividad comercial
- intervenir solo a nivel administrativo

---

## 3. Modulos principales

### 3.1 Autenticacion

Debe resolver:

- login
- registro
- cierre de sesion
- sesion persistente
- recuperacion o cambio de password
- validacion por token o sesion real

### 3.2 Backoffice del cliente

Debe agrupar:

- dashboard
- directorio general
- workspace de prospeccion
- carga de leads
- equipo
- reportes
- configuracion

### 3.3 Gestion de leads

Debe permitir:

- crear lead manual
- importar en lote
- importar desde WhatsApp
- detectar duplicados
- enriquecer informacion
- archivar o descartar
- editar datos
- registrar historial

### 3.4 Distribucion a equipo

Debe permitir:

- compartir lote de leads
- asignar a un miembro concreto
- dejar en pool general si aplica
- reflejar esos leads en la cuenta destino
- dejar trazabilidad del origen del lead

### 3.5 Reportes y metricas

Debe mostrar:

- captacion total
- captacion mensual
- actividad por usuario
- leads trabajados
- leads contactados
- leads archivados
- avance de metas
- actividad del equipo

### 3.6 Panel admin global

Debe concentrar:

- usuarios
- cuentas
- leads totales
- actividad global
- conversiones
- estructura
- alertas

---

## 4. Flujo ideal del sistema

### 4.1 Flujo del cliente principal

1. El usuario entra con email y password.
2. El sistema valida sesion y carga solo su workspace.
3. El usuario entra a su dashboard.
4. Ve resumen de leads, actividad y estado del equipo.
5. Decide cargar leads.

Puede hacerlo de tres formas:

- individual
- CSV
- WhatsApp

6. El sistema procesa la carga.
7. Los leads nuevos entran al directorio.
8. Los duplicados no deben entrar al directorio normal.
9. Los duplicados van a almacenamiento separado de duplicados.
10. El usuario revisa duplicados y decide:

- eliminarlos
- restaurarlos
- dejarlos archivados

11. El usuario envia leads a prospeccion.
12. Dentro del workspace puede:

- abrir detalle del lead
- editar
- guardar notas
- registrar contacto
- marcar enviado
- archivar
- descartar

13. Si tiene equipo, comparte leads.
14. El miembro del equipo entra a su cuenta y ve esos leads reflejados en su propio backoffice.
15. Las metricas del sistema se actualizan segun el uso.

### 4.2 Flujo del miembro de equipo

1. Se registra usando el codigo del lider.
2. Obtiene su propia cuenta.
3. Entra a su backoffice.
4. Solo ve sus datos y leads propios o compartidos.
5. Trabaja los leads.
6. Sus acciones deben quedar trazadas.

### 4.3 Flujo del admin global

1. Entra con credenciales maestras.
2. Ve dashboard global.
3. Revisa usuarios, captacion total y actividad.
4. Puede entrar en modo observador o administrativo a otras cuentas.
5. Puede detectar anomalías:

- cuentas sin actividad
- usuarios con errores
- duplicados masivos
- problemas de carga
- fallos de equipo

---

## 5. Comportamiento teorico correcto

Para que el software este bien al 100%, estas reglas deben cumplirse siempre:

### 5.1 Aislamiento de cuenta

- un cliente no debe ver leads de otro cliente
- un cliente no debe pisar configuracion de otro
- cada cuenta debe tener su propio espacio de trabajo

### 5.2 Excepcion controlada de equipo

- si un lider comparte leads a un miembro de su equipo, ese miembro si debe verlos
- eso no debe romper el aislamiento del resto de cuentas
- debe existir trazabilidad de que el lead fue compartido

### 5.3 Duplicados

- si un lead ya existe, no debe volver a entrar al directorio como nuevo
- debe detectarse aunque el numero venga con distinto formato
- debe detectarse contra:
  - leads activos
  - leads archivados en duplicados
  - el mismo lote importado

### 5.4 Paises y banderas

- el pais debe derivarse correctamente de la lada cuando exista
- la bandera debe corresponder al pais detectado
- el filtro por pais debe coincidir con el codigo guardado

### 5.5 Edicion de lead

- al dar click en un lead debe abrir su detalle
- debe permitir editar
- debe permitir guardar
- debe reflejar cambios en historial

### 5.6 Persistencia

- al recargar no debe perderse el trabajo
- login debe seguir activo si la sesion es valida
- preferencias deben mantenerse por usuario

### 5.7 Reportes

- las metricas personales deben ser personales
- las metricas del equipo deben reflejar solo lo que corresponde
- el admin debe ver la agregacion global real

---

## 6. Simulacion de uso real

### Caso A: Cliente nuevo sin equipo

1. Juan crea su cuenta.
2. Juan entra y tiene su backoffice vacio.
3. Juan importa 500 leads por CSV.
4. El sistema acepta 470 y manda 30 a duplicados.
5. Juan abre la pestaña de duplicados y depura.
6. Juan mueve 20 a prospeccion.
7. Juan abre 5, manda mensaje por WhatsApp y guarda notas.
8. Juan revisa reportes.

Resultado esperado:

- solo Juan ve esos leads
- sus metricas reflejan solo su trabajo

### Caso B: Lider con equipo

1. Ana tiene cuenta principal.
2. Ana comparte su codigo a Luis.
3. Luis se registra con ese codigo.
4. Luis entra a su cuenta y no debe ver toda la base de Ana.
5. Ana le comparte 25 leads.
6. Luis entra y ahora si ve esos 25 leads.
7. Luis trabaja 10.
8. Ana ve que compartio 25 y que parte de esos leads ya tienen actividad.

Resultado esperado:

- cuentas separadas
- leads compartidos visibles solo al destinatario
- trazabilidad clara

### Caso C: Duplicado por segunda importacion

1. Maria importa un CSV con 579 leads.
2. Todo entra bien la primera vez.
3. Maria sube el mismo archivo otra vez.
4. El sistema no debe volver a meter 579 al directorio.
5. Debe detectar que esos numeros ya existen.
6. Debe moverlos al archivo de duplicados.

Resultado esperado:

- segunda importacion no contamina el directorio

### Caso D: Admin global

1. Bigdata entra con credenciales maestras.
2. Ve total de usuarios, total de leads y actividad global.
3. Detecta cuentas con problemas.
4. Supervisa sin romper la separacion de clientes.

Resultado esperado:

- vision total solo para admin

---

## 7. Errores tipicos que el sistema no debe permitir

### Criticos

- que una cuenta vea leads de otra sin permiso
- que una segunda importacion meta duplicados como nuevos
- que compartir leads no los refleje al destinatario
- que el admin no vea correctamente lo global
- que editar un lead no guarde
- que al recargar se pierda la sesion o datos criticos

### Altos

- que el pais se detecte mal y rompa filtros
- que metricas usen datos de otra cuenta
- que team members aparezcan como asignables pero no reciban nada
- que el modal del lead deje de abrir

### Medios

- mensajes de resumen incorrectos
- botones presentes sin accion real
- textos que confunden al usuario

---

## 8. Auditoria del estado actual

### Cosas que ya van bien

- modularizacion del frontend
- base de backend local
- sesion persistente por token
- aislamiento por workspace en gran parte del sistema
- panel admin global
- reparto de leads a referidos contemplado
- modal de lead restaurado
- deteccion de pais mejorada

### Cosas que aun deben pulirse hasta sentirlo “100%”

- importacion CSV y deteccion de duplicados en casos reales
- consistencia total entre frontend local y backend al compartir leads
- claridad de la logica de equipo
- pruebas de flujo extremo
- limpieza tecnica de codigo ya obsoleto
- migracion futura a base de datos real

---

## 9. Recomendacion de pulido por fases

### Fase 1. Estabilidad funcional

- dejar 100% estable importacion
- dejar 100% estable duplicados
- dejar 100% estable compartir leads
- dejar 100% estable modal de detalle

### Fase 2. Coherencia de negocio

- definir bien equipo, lider y referido
- definir si hay pool compartido real o no
- definir metricas exactas por rol

### Fase 3. Produccion tecnica

- quitar codigo muerto
- consolidar servicios
- base de datos real
- variables de entorno
- pruebas de despliegue

### Fase 4. Hosting

- exportar frontend
- desplegar backend
- conectar dominio
- conectar DB

---

## 10. Conclusión

La idea del software es correcta y tiene potencial real como producto.

La teoria funcional sana es esta:

- cada cliente entra a su propio CRM
- capta leads por varias vias
- los organiza, trabaja y mide
- comparte parte de esos leads con su equipo
- el equipo trabaja solo lo que le corresponde
- el admin global vigila todo desde arriba

Si esa teoria se respeta de punta a punta, el sistema deja de ser un prototipo bonito y se convierte en un software comercial serio.

La auditoria debe perseguir una sola meta:

que cada flujo importante funcione igual de bien en la primera, segunda y vigesima vez, sin mezclar datos, sin duplicar basura y sin perder trazabilidad.
