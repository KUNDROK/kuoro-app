# Contexto para agentes (IA y desarrolladores)

## Qué leer primero (fuente de verdad)

1. **`docs/AI_HANDOFF.md`** — producto, flujos de asamblea, archivos clave y stack **actual**.
2. **`README.md`** — despliegue (Vercel, Railway, variables), comandos de build y Prisma.
3. **Código y `packages/contracts`** — si algo discrepa con un doc, gana el código.

## Qué tratar como histórico (no como estado actual)

- **`memory/*.md`** — bitácora por fecha; útil para entender *por qué* se hizo un cambio, **no** para asumir que el repo sigue igual (rutas, archivos, JSON demo, etc.).
- **`MEMORY.md`** — preferencias de producto y UX de largo plazo; puede mencionar pantallas o rutas antiguas: **comprueba en `apps/web/src/App.tsx`** antes de editar.
- **`ARCHITECTURE.md`** — mezcla visión objetivo (NestJS, Socket.IO) con sección **19** de implementación; la sección 19 debe estar alineada con el repo; lo aspiracional está etiquetado arriba en el mismo archivo.

Si un documento habla de **`apps/api/data/app-db.json`** como persistencia de runtime, está **desactualizado**: la API usa **PostgreSQL + Prisma** (`DATABASE_URL`, `apps/api/src/lib/prisma.ts`, `apps/api/src/db.ts`).

## Rutas web reales (admin asambleas)

Definidas en `apps/web/src/App.tsx`:

- Listado: `/asambleas` → `AssemblyListPage`.
- Preparación / hub: `/asambleas/:assemblyId` → `AssemblyHubPage`.
- Sala admin: `/sala/:propertyId/:assemblyId` → `AssemblyRoomPage`.
- Asistente: `/asistente/:propertyId/:assemblyId` → `AttendeeRoomPage`.

No hay ruta montada para `AssembliesPage` ni `AssemblyPreparationPage` en `App.tsx`; si los archivos existen bajo `pages/`, son **legacy no enlazados** hasta que se borren o se vuelvan a usar.

## CI

`.github/workflows/ci.yml` ejecuta typecheck en workspaces y tests del API tras `prisma generate`.
