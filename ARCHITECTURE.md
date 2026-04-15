# Arquitectura Inicial del MVP

## 1. Objetivo

Definir una arquitectura tecnica inicial para construir el MVP de la plataforma de asambleas virtuales para propiedad horizontal en Colombia. La arquitectura debe priorizar velocidad de desarrollo, claridad de dominio, trazabilidad de eventos y soporte en tiempo real durante la asamblea.

## 2. Principios de arquitectura

- Empezar simple, pero con una estructura que permita crecer.
- Separar claramente administracion, asamblea en vivo y reportes.
- Diseñar el dominio alrededor de la trazabilidad de eventos.
- Priorizar consistencia de datos en votos, asistencia y quorum.
- Mantener el frontend web responsivo como cliente principal del MVP.

## 3. Stack recomendado

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand para estado de UI y sesion en vivo
- Socket.IO client para eventos en tiempo real
- Tailwind CSS o CSS modular segun preferencia del proyecto

### Backend

- NestJS
- TypeScript
- REST para operaciones de gestion
- Socket.IO para asamblea en tiempo real
- Zod o class-validator para validacion de entrada

### Base de datos

- PostgreSQL
- Prisma ORM

### Infraestructura inicial

- Frontend desplegado en Vercel o similar
- Backend desplegado en Railway, Render o Fly.io
- Base de datos PostgreSQL administrada
- Almacenamiento de archivos opcional en version posterior

## 4. Arquitectura general

Se recomienda una arquitectura de monorepo con dos aplicaciones principales:

- `apps/web`: interfaz del administrador y de los participantes
- `apps/api`: API, autenticacion, negocio y tiempo real

Y paquetes compartidos:

- `packages/types`: tipos y contratos compartidos
- `packages/config`: configuraciones compartidas
- `packages/ui`: componentes reutilizables en el futuro si conviene

Para el MVP tambien es valido comenzar con dos carpetas simples:

- `frontend`
- `backend`

La prioridad es conservar una separacion clara entre cliente y servidor.

## 5. Modulos del sistema

### 5.1 Autenticacion de administrador

Responsable de:

- registro
- login
- recuperacion de contrasena
- validacion de correo
- gestion de sesion

Este modulo solo aplica al administrador y equipo interno.

### 5.2 Gestion de copropiedades

Responsable de:

- crear copropiedad
- editar datos generales
- asociar unidades privadas
- configurar reglas basicas del conjunto

### 5.3 Gestion de propietarios y apoderados

Responsable de:

- registrar propietarios
- asociarlos con unidades
- definir estado de habilitacion
- registrar apoderados
- preparar base de datos para convocatorias y votacion

### 5.4 Gestion de asambleas

Responsable de:

- crear asamblea
- definir fecha y hora
- registrar orden del dia
- preparar puntos de votacion
- cambiar estado de la asamblea

### 5.5 Convocatorias

Responsable de:

- generar invitaciones
- emitir enlaces unicos de acceso
- registrar estado de envio
- reenviar invitaciones

### 5.6 Sala de asamblea en vivo

Responsable de:

- ingreso de participantes
- presencia y conexion
- control de asistencia
- actualizacion de quorum
- sincronizacion del punto actual del orden del dia

### 5.7 Votaciones en tiempo real

Responsable de:

- apertura y cierre de votaciones
- emision de voto
- prevencion de duplicados
- agregacion de resultados
- difusion de resultados en tiempo real

### 5.8 Participacion y turnos

Responsable de:

- solicitud de palabra
- cola de intervenciones
- concesion de turno
- temporizador por intervencion

### 5.9 Acta y reportes

Responsable de:

- consolidar datos de la sesion
- generar borrador de acta
- presentar dashboard de asistencia, quorum y resultados

## 6. Roles y permisos

### Administrador

- puede crear y configurar copropiedades
- puede crear y moderar asambleas
- puede abrir y cerrar votaciones
- puede gestionar participantes, cola de palabra y acta

### Propietario

- puede ingresar con enlace seguro
- puede registrar asistencia
- puede votar si esta habilitado
- puede solicitar la palabra

### Apoderado

- puede actuar como participante autorizado
- puede votar en representacion de un propietario o unidad

### Moderador

- puede operar funciones en vivo sin acceso total a configuracion

## 7. Modelo de datos inicial

### Entidades principales

- `AdminUser`
- `Property`
- `Unit`
- `Owner`
- `Proxy`
- `Ownership`
- `Assembly`
- `AgendaItem`
- `AssemblyParticipant`
- `Invitation`
- `AttendanceEvent`
- `VoteSession`
- `Vote`
- `SpeakerQueueItem`
- `AssemblyEvent`
- `MinutesDraft`

### Relaciones clave

- un `AdminUser` puede administrar varias `Property`
- una `Property` tiene muchas `Unit`
- una `Unit` puede tener uno o varios `Owner`
- una `Assembly` pertenece a una `Property`
- una `Assembly` tiene muchos `AgendaItem`
- una `Assembly` tiene muchos `AssemblyParticipant`
- una `Assembly` tiene muchas `VoteSession`
- una `VoteSession` pertenece a un `AgendaItem`
- una `VoteSession` tiene muchos `Vote`
- una `Assembly` tiene muchos `AssemblyEvent`
- una `Assembly` tiene un `MinutesDraft` principal

## 8. Estados principales

### Estado de asamblea

- `draft`
- `scheduled`
- `invitation_sent`
- `in_progress`
- `closed`
- `archived`

### Estado de participante

- `invited`
- `connected`
- `present`
- `disconnected`
- `excluded`

### Estado de votacion

- `pending`
- `open`
- `closed`
- `published`

## 9. Diseño de APIs

### REST para gestion administrativa

Ejemplos:

- `POST /auth/register`
- `POST /auth/login`
- `POST /properties`
- `GET /properties/:id`
- `POST /properties/:id/units`
- `POST /properties/:id/owners`
- `POST /assemblies`
- `POST /assemblies/:id/agenda-items`
- `POST /assemblies/:id/invitations/send`
- `GET /assemblies/:id/dashboard`
- `GET /assemblies/:id/minutes`

### WebSockets para la sesion en vivo

Eventos sugeridos:

- `assembly:join`
- `assembly:presence.updated`
- `assembly:quorum.updated`
- `agenda:item.changed`
- `vote:opened`
- `vote:submitted`
- `vote:results.updated`
- `speaker:requested`
- `speaker:started`
- `speaker:timer.updated`
- `assembly:closed`

## 10. Tiempo real y consistencia

La sala de asamblea requiere sincronizacion inmediata. Para eso:

- REST se usa para crear, editar y consultar datos persistentes.
- WebSockets se usa para presencia, votaciones, quorum y cola de palabra.
- El backend es la fuente unica de verdad.
- Cada accion importante debe persistirse antes o junto con su emision por socket.

Puntos criticos:

- un participante no debe poder votar dos veces
- el quorum debe recalcularse al entrar o salir participantes
- los resultados visibles deben derivarse siempre de votos persistidos

## 11. Seguridad inicial

- contrasenas hasheadas con algoritmo moderno como bcrypt o argon2
- JWT o cookie segura para sesion del administrador
- enlaces firmados y con expiracion para participantes invitados
- validacion de permisos por asamblea
- auditoria minima de acciones sensibles
- proteccion de datos personales en logs y respuestas

## 12. Auditoria y trazabilidad

El sistema debe registrar eventos clave en `AssemblyEvent`:

- invitacion enviada
- participante conectado
- participante marcado como presente
- votacion abierta
- voto recibido
- votacion cerrada
- palabra solicitada
- turno iniciado
- asamblea cerrada

Esta bitacora sera vital para el dashboard, el acta y eventuales disputas.

## 13. Generacion del acta

En el MVP, el acta no debe depender de IA para existir. Debe generarse a partir de datos estructurados:

- datos de la copropiedad
- fecha y hora
- lista de asistentes
- quorum alcanzado
- puntos del orden del dia
- resultados por votacion
- decisiones tomadas

Luego se puede añadir una capa de resumen asistido para redactar mejor el contenido narrativo.

## 14. Decisiones de producto que impactan la arquitectura

### Video de la reunion

Para el MVP recomiendo no construir videollamada propia. Hay dos caminos:

- opcion A: la plataforma administra la asamblea y se integra con un enlace externo de Meet o Zoom
- opcion B: la plataforma inicialmente funciona sin video integrado y se concentra en votacion y control formal

Recomendacion inicial:

usar enlace externo para videollamada y enfocar el desarrollo en asistencia, quorum, votacion, turnos y acta.

### Voto ponderado

La arquitectura debe quedar preparada para soportarlo aunque el primer release use voto simple. Por eso `Vote` y `AssemblyParticipant` deben conservar referencia a unidad, propietario y peso aplicable.

## 15. Estructura sugerida de pantallas

### Administrador

- registro
- login
- recuperar contrasena
- dashboard general
- crear copropiedad
- detalle de copropiedad
- unidades
- propietarios
- asambleas
- detalle y preparacion de asamblea
- sala de control en vivo
- dashboard post-asamblea
- editor de acta

### Participante

- acceso por invitacion
- verificacion de identidad basica
- sala de asamblea
- panel de votacion
- resultados en tiempo real

## 16. Orden recomendado de implementacion

### Etapa 1

- autenticacion de administrador
- estructura base del backend
- modelo de datos principal
- CRUD de copropiedad, unidades y propietarios

### Etapa 2

- CRUD de asambleas
- agenda
- invitaciones
- acceso de participantes por enlace

### Etapa 3

- presencia en tiempo real
- asistencia
- quorum
- cambio de punto del orden del dia

### Etapa 4

- votaciones en tiempo real
- resultados en vivo
- proteccion contra votos duplicados

### Etapa 5

- cola de palabra
- temporizador
- dashboard final
- borrador automatico de acta

## 17. Riesgos tecnicos iniciales

- manejo correcto de concurrencia en votaciones
- validacion confiable del derecho a voto
- soporte de reconexion en sesiones en vivo
- claridad juridica sobre trazabilidad y evidencias
- experiencia movil para propietarios con bajo nivel tecnico

## 18. Recomendacion final

Para este producto conviene iniciar con una arquitectura sencilla pero estricta en dominio:

- React + Vite en frontend
- NestJS + PostgreSQL + Prisma en backend
- Socket.IO para tiempo real
- acta basada en datos estructurados
- videollamada externa en MVP

Eso nos permite construir rapido, mantener control sobre lo importante y dejar espacio para crecer sin rehacer la base.

## 19. Estado actual de implementacion

La arquitectura descrita arriba sigue siendo una referencia de direccion, pero el repo actual ya tiene una implementacion de MVP con estas decisiones:

- Monorepo npm workspaces.
- `apps/web`: React + TypeScript + Vite + React Router.
- `apps/api`: API TypeScript sobre HTTP nativo de Node. Todavia no se migro a NestJS.
- `packages/contracts`: contratos compartidos entre web y API.
- Persistencia de desarrollo en `apps/api/data/app-db.json`; Prisma existe en `prisma/schema.prisma` como camino de evolucion, pero no asumir que todo el runtime ya depende de Prisma.

El foco funcional actual esta en asambleas:

- `/asambleas` es el flujo principal editable.
- `/asamblea/preparacion` existe como cabina legacy y debe mantenerse coherente mientras no se retire.
- `/asamblea/:assemblyId` muestra la sala en vivo.

El flujo de preparacion visible queda en 6 pasos:

1. Tipo y datos base
2. Presentacion de la asamblea
3. Acceso e identidad
4. Revision final
5. Sala en vivo
6. Cierre e historico

El paso 02 es un generador de diapositivas asistido. Los campos de presentacion (`slideTitle`, `slideContent`, `speakerNotes`, `votePrompt`) ya existen en contratos, persistencia, API, UI de preparacion y sala en vivo.

La generacion aun es local/pre-IA. El siguiente salto arquitectonico es agregar un endpoint de generacion y conectar un proveedor real de IA, manteniendo al backend como fuente de verdad de la presentacion guardada.

## 20. Landing publica y flujo de compra (web)

Rutas en `apps/web` (`App.tsx`). El catalogo de planes vive en `apps/web/src/data/pricingPlans.ts` y se reutiliza en el landing y en `/contratar`.

### 20.1 Pagina de inicio `/` (`LandingPage.tsx`)

Orden aproximado de bloques:

1. **Nav fijo** — enlaces ancla (`#features`, `#pricing`, `#how`, `#faq`), enlace a **Contratar** (`/contratar`), Ingresar, CTA **Ver planes** (`/contratar`).
2. **Hero** — titulo, CTA principal a `/contratar`, enlace secundario a `#how`, indicador de scroll.
3. **Marquee** — franja de texto en movimiento.
4. **Barra de estadisticas** — cuatro metricas de apoyo.
5. **Problema / solucion** — split narrativo.
6. **Caracteristicas** (`#features`) — historia en filas con mini-escenas interactivas (prep, sala, votacion, poderes, quorum, IA) y `active` por scroll (`useInView`).
7. **Como funciona** (`#how`) — pasos del producto.
8. **Bloque propietarios** — mensaje para copropietarios.
9. **Precios** (`#pricing`) — toggle mensual/anual; tarjetas enlazan a `/contratar/resumen?plan=…&cycle=…` (Starter/Profesional) o a `/contacto-ventas` (Empresarial).
10. **FAQ** (`#faq`).
11. **CTA final** — enlace a `/contratar`.
12. **Pie** — enlaces a `/contratar`, `/contacto-ventas`, `/login-admin`, `/registro-admin`, `/legal/terminos`, `/legal/privacidad`, anclas internas.

### 20.2 Flujo de compra (autogestion + ventas)

| Paso | Ruta | Rol |
|------|------|-----|
| Elegir plan | `/contratar` | Misma grilla que precios; query opcional `?plan=&cycle=` para pre-resaltar o alinear ciclo. |
| Resumen | `/contratar/resumen?plan=` + `starter` o `professional` + `&cycle=` + `monthly` o `annual` | Confirma plan y ciclo; enlaces legales; CTA a registro con la misma query. `plan=enterprise` redirige a ventas. |
| Registro | `/registro-admin?plan=…&cycle=…` | Muestra cinta con plan elegido (no aplica cobro aun). Empresarial en query muestra aviso + enlace a ventas. |
| Ventas | `/contacto-ventas` | Formulario de lead (demo sin envio real a backend). |
| Legal | `/legal/terminos`, `/legal/privacidad` | Textos placeholder hasta redaccion juridica final. |

Pendiente de producto/backend: pasarela de pago, persistencia de leads, correo transaccional y texto legal definitivo.
