# Memoria del Proyecto

> Nota para agentes: esto resume **decisiones de producto y UX**. Para stack, rutas y persistencia vigentes, usa `docs/AGENT_CONTEXT.md` y `docs/AI_HANDOFF.md`. Las lineas que hablen de `/asambleas` como un solo editor o de archivos concretos pueden estar desfasadas respecto a `App.tsx`.

- El proyecto es una plataforma SaaS para administracion de propiedad horizontal, con foco inicial en preparacion y gestion de asambleas.
- El producto se esta orientando visualmente hacia un dashboard SaaS limpio inspirado en la referencia que el usuario creo en Figma Make, no hacia un collage de tarjetas.
- La marca del producto es **Kuoro** (dominio **kuoro.io**). El nombre anterior de trabajo era Quorum.
- La estructura principal acordada incluye: Panel de control, Copropiedad, Unidades y Propietarios, Asambleas, Comunicaciones, Reportes y Configuracion.
- El Panel de control debe ser la vista de mayor jerarquia para que el administrador entienda rapidamente el estado de su administracion.
- El usuario prefiere contrastes suaves, visual moderno y jerarquia clara; no le gustan iconos pequeños aislados, tarjetas con espacios vacios ni elementos que parezcan botones si no son acciones.
- Para el bloque principal del dashboard, se acordo que el estado operativo debe salir de datos reales, no de copy fijo.
- Los estados operativos principales definidos son: `Bloqueo operativo`, `Atencion prioritaria`, `En preparacion`, `Lista para convocar`, `Convocatoria en curso`, `Lista para abrir` y `Operacion estable`.
- El estado de copropiedad es distinto del estado de asamblea. Se preparo `operationalStatus` con `active`, `inactive_payment`, `suspended` y `pending_setup`.
- La base de datos de prueba quedo intencionalmente modificada para que la asamblea activa no tenga orden del dia asociado y el dashboard muestre `Bloqueo operativo` por una condicion real.
- La URL local usada para revisar el dashboard es `http://127.0.0.1:5173/dashboard`.
- El usuario dijo que le gusta como esta quedando el dashboard y no quiere sacrificar secciones por optimizacion. El enfoque acordado es optimizar jerarquia, consistencia, responsive y mantenimiento sin recortar contenido.
- El checklist de preparacion de asamblea debe tratar pasos reales de la asamblea, no prerrequisitos generales de la copropiedad. Pasos actuales del flujo visible: tipo/datos base, presentacion de la asamblea, acceso/identidad, revision final, sala en vivo, cierre/historico.
- El paso 02 debe ser un generador de presentaciones por diapositivas, no un orden del dia con descripcion. El administrador escribe lo que quiere compartir; el asistente debe crear `slideTitle`, `slideContent`, `speakerNotes` y `votePrompt` para lo que veran los propietarios.
- La generacion de diapositivas esta montada localmente/pre-IA. Siguiente paso natural: conectar un proveedor real de IA desde backend.
- `Convocatoria y destinatarios` no debe ser paso editable de preparacion; puede quedar como metrica o alerta. `Representacion y poderes` se gestiona fuera de la cabina, desde Comunicaciones, Reportes y Unidades.
- En el dashboard, las alertas deben ser visualmente claras y accionables. Si una alerta muestra una cantidad concreta, al hacer click debe llevar a una vista filtrada que coincida exactamente con esa cantidad; para unidades sin votante se resolvio pasando `unitIds` exactos a `/unidades`.
- Las filas de unidades deben mostrar etiquetas claras con tipo y agrupacion, por ejemplo `Torre 5 Apartamento 301`, y deben enlazar a la ficha de la unidad.
- La seccion inferior del dashboard debe funcionar como previews/accesos directos a areas importantes, no como tarjetas densas o desordenadas.
- Cuando el usuario mencione la "zona de los sitios web en la parte de abajo", se refiere al footer tipico de un sitio/app con datos de empresa/desarrollador/soporte, no a crear un modulo llamado Sitios web.
- El cronometro de proxima asamblea vive como componente aislado `AssemblyCountdown` para evitar que su tick de 1 segundo re-renderice todo el dashboard.
- Problema recurrente: la pagina local a veces no carga porque el frontend Vite no queda arriba o falla con `spawn EPERM` de esbuild. URLs y comandos utiles:
  - Dashboard: `http://127.0.0.1:5173/dashboard`
  - API health: `http://127.0.0.1:4000/health`
  - API dev: `npm --workspace @kuoro/api run dev`
  - Web dev recomendado: `npm --workspace @kuoro/web run dev -- --host 127.0.0.1 --port 5173 --strictPort`
  - Si Vite falla con `spawn EPERM`, reintentar el comando web con permisos elevados.
- Flujo principal de preparacion de asamblea: **`/asambleas/:assemblyId`** (`AssemblyHubPage`) con pestanas; listado en **`/asambleas`**. Debe mantener sidebar, topbar y Kuoro IA persistentes (via `PlatformShell`), pasos coherentes con el handoff, y cuidado visual (alineacion, sin bloques vacios ni botones redundantes).
