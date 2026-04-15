# Kuoro

Plataforma para asambleas virtuales de propiedad horizontal en Colombia. Dominio público: [kuoro.io](https://kuoro.io).

## Estructura

- `apps/web`: frontend para administradores y participantes
- `apps/api`: backend, reglas de negocio y tiempo real
- `packages/contracts`: contratos y tipos compartidos del dominio
- `docs/AI_HANDOFF.md`: guia de continuidad para retomar el proyecto con contexto actualizado
- `PRD.md`: definicion de producto
- `ARCHITECTURE.md`: arquitectura inicial del MVP

## Enfoque inicial

La primera meta es construir bien estos flujos:

1. Registro e inicio de sesion del administrador.
2. Registro de copropiedad.
3. Carga de unidades y propietarios.
4. Preparacion de asamblea.
5. Ejecucion de la asamblea con asistencia, quórum y votaciones.

## Estado actual importante

El modulo de asambleas es un flujo SaaS de preparacion donde el paso 02 es un generador de presentaciones, no un simple orden del dia. El administrador define lo que quiere compartir y el sistema construye diapositivas con contenido visible para propietarios, notas para el administrador y momentos de votacion.

Antes de retomar trabajo, leer `docs/AI_HANDOFF.md`, `MEMORY.md` y la memoria diaria mas reciente en `memory/`.

## Proximos pasos sugeridos

1. Conectar IA real al generador de diapositivas de asamblea.
2. Persistir y controlar la diapositiva activa durante la sala en vivo.
3. Mantener convocatoria y poderes como alertas/reportes externos, no como pasos editables de preparacion.
4. Si tienes datos antiguos con `conferenceService = quorum_live`, ejecuta `node apps/api/scripts/migrate-quorum-live-to-kuoro-live.mjs` una vez.
5. Seguir verificando con `npm --workspace @kuoro/web run typecheck`, `npm --workspace @kuoro/api run typecheck` y `npm --workspace @kuoro/web run build`.

## Despliegue staging (Vercel + Railway + Neon)

Stack previsto: **front Vercel**, **API Railway (Node)**, **PostgreSQL** (Neon u otro), **Resend**, **LiveKit**, DNS en **Cloudflare** (`kuoro.io`). Almacenamiento **R2** queda preparado en variables comentadas en `apps/api/.env.example` (sin implementación aún).

### Variables clave

| Variable | Dónde | Uso |
|----------|--------|-----|
| `APP_BASE_URL` | Railway (API) | Origen del SPA en enlaces de correo (`/asistente/...`, CTAs). Sin barra final. |
| `API_BASE_URL` | Railway (opcional) | Origen público del API; logs y scripts. Debe incluir `/api/v1` si aplica. |
| `VITE_API_BASE_URL` | Vercel (build del front) | Misma idea: URL absoluta del API **con** `/api/v1` al final. En local se deja vacío (proxy Vite). |
| `DATABASE_URL` | Railway | PostgreSQL. |
| `ALLOWED_ORIGINS` | Railway | Orígenes CORS separados por coma (incluye la URL del front en Vercel). |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Railway | Correo transaccional. |
| `LIVEKIT_*` | Railway | Conferencia. |
| `NODE_ENV` | Railway | `staging` o `production` (activa CORS estricto y oculta detalles de error 500). |

### Build y arranque (monorepo)

1. **Node**: el repo declara **Node ≥ 22.12** (Prisma 7.7+ rechaza 22.11). En local y en CI, usa la versión de `.node-version` en la raíz.
2. **Prisma** (desde la raíz del repo): `npx prisma generate`; esquema en BD: `npm run db:push` en local o **`npm run db:push:deploy`** en el pre-deploy de Railway (`railway.json`). Cuando pases a historial de migraciones, sustituye por `prisma migrate deploy`.
3. **API**: `npm run build:api` (equivale a `prisma generate` + build del workspace `@kuoro/api`).
4. **Arranque API**: `npm run start:api` → `node apps/api/dist/server.js` (bundle ESM con esbuild). Railway debe usar `PORT` inyectado (ya soportado en `config.ts`).

### Railway (backend)

- **Dockerfile (por defecto)**: `railway.json` usa el builder **DOCKERFILE**. La imagen fija **Node 22** oficial (`node:22-bookworm-slim`), OpenSSL, prebuild, `npm ci` y `build:api`. Evita versiones intermedias de Nixpacks (p. ej. 22.11) que rompen Prisma 7.7.
- **Pre-deploy**: antes de arrancar el contenedor se ejecuta **`npm run db:push:deploy`** (`prisma db push`) para crear/actualizar tablas en Postgres. Requiere **`DATABASE_URL`** en el servicio del API.
- **Nixpacks (alternativa)**: si quitas el Dockerfile y `railway.json` vuelve a Nixpacks, usa `nixpacks.toml` y **`NIXPACKS_NODE_VERSION=22.12`** (o superior). No dupliques `npm ci` en el build del panel.
- **Start command**: `npm run start:api`
- **Root directory**: raíz del monorepo (o configura subpath si tu host lo exige).
- Define todas las variables de la tabla anterior. `APP_BASE_URL` debe ser la URL pública del front (Vercel).

### Vercel (frontend)

- **Build** (desde la raíz del repo): `npm run build:web` (equivale a `npm run build --workspace @kuoro/web`).
- **Environment**: `VITE_API_BASE_URL=https://<tu-servicio>.railway.app/api/v1` (ajusta al dominio real del API).

### Salud y comprobaciones

1. `GET https://<api>/health` o `GET https://<api>/api/v1/health` → `status`, `timestamp`, `version`, `commit` (si Railway/Git exponen SHA), `database`.
2. Login admin en el front desplegado.
3. Envío de convocatoria / campaña: el enlace del correo debe usar `APP_BASE_URL`.
4. Abrir enlace de asistente desde el correo (móvil u otro navegador).

### Datos demo

Script idempotente: `node apps/api/scripts/seed-demo.mjs`  
Variables opcionales: `API_SEED_BASE_URL`, `API_BASE_URL` (API), `APP_BASE_URL` (origen del front en los mensajes de consola). Credenciales por defecto: ver cabecera del script (`demo@kuoro.io` / `Kuoro2026!`).

### Notas

- No se ha añadido SMS/WhatsApp ni optimización de rendimiento.
- En `staging`/`production`, los errores **500** no devuelven el mensaje interno al cliente; el detalle queda en logs del servidor.
