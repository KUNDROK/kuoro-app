# AI Handoff - Kuoro (propiedad horizontal)

Este documento es el punto de entrada para una IA o desarrollador que retome el proyecto.

## Contexto de producto

Kuoro es una plataforma SaaS para administracion de propiedad horizontal en Colombia, con foco actual en la preparacion y gestion de asambleas. Dominio: kuoro.io.

El usuario quiere una experiencia de dashboard limpia, moderna y operativa. Evitar pantallas con tarjetas enormes vacias, controles que parezcan editables si son datos de sistema, botones redundantes y formularios improvisados.

La prioridad actual es el modulo de asambleas, especialmente el flujo de preparacion:

1. Tipo y datos base
2. Presentacion de la asamblea
3. Acceso e identidad
4. Revision final
5. Sala en vivo
6. Cierre e historico

`Convocatoria y destinatarios` ya no debe ser un paso editable de preparacion. Puede aparecer como metrica o alerta de sistema, pero no como pantalla de destinatarios parciales.

`Representacion y poderes` tampoco se gestiona desde la cabina de preparacion. Se revisa desde Comunicaciones, Reportes y Unidades; en preparacion solo puede aparecer como alerta de alistamiento.

## Decision clave: paso 02

El paso 02 NO debe sentirse como un "orden del dia" simple. El usuario fue claro: quiere un generador de presentaciones.

La idea correcta:

- El administrador escribe los puntos o ideas que quiere compartir.
- El asistente interpreta esos puntos.
- El sistema ayuda a crear diapositivas que veran los propietarios durante la asamblea.
- Cada diapositiva puede incluir momento de votacion.
- La sala en vivo debe seguir esa presentacion en orden.

Campos actuales por punto/diapositiva:

- `title`: lo que quiere tratar o compartir el administrador.
- `description`: contexto base para que el asistente construya la diapositiva.
- `slideTitle`: titulo visible de la diapositiva.
- `slideContent`: texto visible para los propietarios.
- `speakerNotes`: notas para el administrador/moderador.
- `votePrompt`: pregunta de votacion cuando aplique.
- `type`: informativo, deliberativo, votacion o eleccion.
- `votingRule`: ninguna, simple, calificada_70 o unanimidad.
- `requiresAttachment`: si requiere soporte o anexo.

La generacion actual es local/pre-IA. Ya existe la estructura mental y de datos correcta, pero falta conectar una llamada real a un modelo de IA para generar diapositivas con mayor calidad.

## Arquitectura actual del repo

Monorepo npm workspaces:

- `apps/web`: frontend React + TypeScript + Vite + React Router.
- `apps/api`: API TypeScript sobre HTTP nativo de Node. No es NestJS todavia.
- `packages/contracts`: tipos y contratos compartidos entre web y API.
- `apps/api/data/app-db.json`: almacenamiento de datos de desarrollo/demo.
- `prisma/schema.prisma`: esquema Prisma en transicion; no asumir que todo el runtime ya depende de Prisma.

Comandos utiles:

- `npm --workspace @kuoro/web run dev -- --host 127.0.0.1 --port 5173 --strictPort`
- `npm --workspace @kuoro/api run dev`
- `npm --workspace @kuoro/web run typecheck`
- `npm --workspace @kuoro/api run typecheck`
- `npm --workspace @kuoro/web run build`

URLs locales frecuentes:

- Web: `http://127.0.0.1:5173`
- Asambleas: `http://127.0.0.1:5173/asambleas`
- Preparacion legacy: `http://127.0.0.1:5173/asamblea/preparacion?step=1`
- Sala demo: `http://127.0.0.1:5173/asamblea/asm-demo`
- API health: `http://127.0.0.1:4000/health`

## Archivos clave

- `apps/web/src/pages/AssembliesPage.tsx`: flujo principal editable de asambleas. Aqui vive el nuevo generador de presentaciones del paso 02.
- `apps/web/src/pages/AssemblyPreparationPage.tsx`: cabina legacy de preparacion. Debe mantenerse coherente con `/asambleas` mientras exista.
- `apps/web/src/pages/AssemblyRoomPage.tsx`: sala en vivo; consume `slideTitle`, `slideContent`, `speakerNotes` y `votePrompt`.
- `apps/web/src/pages/AdminDashboardPage.tsx`: dashboard principal y checklist de preparacion.
- `apps/web/src/styles.css`: estilos globales; incluye clases `assemblies-*`.
- `apps/web/src/lib/api.ts`: cliente HTTP del frontend.
- `apps/api/src/routes.ts`: rutas HTTP y validaciones principales.
- `apps/api/src/db.ts`: tipos y funciones de persistencia JSON.
- `apps/api/src/domain/assembly.ts`: builders de dashboard/sala y fallback demo de agenda/presentacion.
- `packages/contracts/src/index.ts`: contratos compartidos; actualizar aqui antes de usar nuevos campos en web/API.
- `memory/2026-04-13.md`: bitacora detallada de decisiones recientes.
- `MEMORY.md`: memoria de largo plazo del proyecto.

## Decisiones del paso 01

En `Tipo` ya no debe existir `Mixta`; `Mixta` pertenece a `Modalidad`.

Reglas actuales:

- `no_presencial` y `comunicacion_escrita` fuerzan modalidad virtual.
- `derecho_propio` fuerza modalidad presencial.
- `ordinaria`, `extraordinaria` y `segunda_convocatoria` pueden usar presencial, virtual o mixta segun aplique.
- `allowsSecondCall` debe guardarse como `false`; si se necesita segunda convocatoria, se crea una nueva asamblea con `Tipo: Segunda convocatoria`.
- `Estado`, `Servicio virtual` y `Enlace de reunion` son datos de sistema, no inputs del administrador.
- El enlace virtual lo generara el proveedor embebido futuro. Por eso API ya no exige `virtualAccessUrl` para modalidad virtual/mixta.
- Fecha y hora se separaron en inputs `date` y `time` para evitar la friccion del `datetime-local`.

## Que falta despues de este commit

1. Conectar un proveedor real de IA para generar diapositivas desde `description`/intencion del administrador.
2. Definir el contrato backend para solicitar generacion: probablemente `POST /assembly-presentation/generate-slide` y/o `POST /assembly-presentation/generate-deck`.
3. Convertir la presentacion en una experiencia mas visual durante la sala en vivo: controles de avanzar diapositiva, abrir votacion desde una diapositiva y estado activo persistente.
4. Revisar si `AssemblyPreparationPage.tsx` debe sobrevivir o si `/asambleas` sera la unica experiencia principal.
5. Mantener `Convocatoria` y `Poderes` fuera del flujo editable de preparacion, salvo como alertas/enlaces.

## Verificacion reciente

Ultima verificacion conocida:

- `npm --workspace @kuoro/web run typecheck`
- `npm --workspace @kuoro/api run typecheck`
- `npm --workspace @kuoro/web run build`
- `http://127.0.0.1:5173/asambleas` respondio `200`
- `http://127.0.0.1:5173/asamblea/preparacion?step=1` respondio `200`
- `http://127.0.0.1:5173/asamblea/asm-demo` respondio `200`
- `http://127.0.0.1:4000/health` respondio `200`
