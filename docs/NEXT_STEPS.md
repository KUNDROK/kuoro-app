# Siguientes Pasos

## 1. Presentacion asistida por IA

- Reemplazar la generacion local de diapositivas por una llamada real a IA.
- Crear endpoint backend para generar una diapositiva o una presentacion completa desde la intencion del administrador.
- Mantener separados `description` como contexto del administrador y `slideContent` como texto visible para propietarios.
- Agregar controles para avanzar diapositiva activa en la sala en vivo.

## 2. Asamblea en vivo

- Persistir la diapositiva activa y conectarla con los momentos de votacion.
- Abrir votaciones desde una diapositiva con `votePrompt` y `votingRule`.
- Preparar cierre, acta y resultados historicos.

## 3. Arquitectura tecnica

- Evaluar migracion posterior de la API HTTP nativa a NestJS, sin romper el MVP actual.
- Avanzar la persistencia desde JSON demo hacia Prisma/DB real cuando el dominio este mas estable.
- Introducir Socket.IO.
- Disenar eventos de presencia, quorum y votacion.
- Anadir reconexion y tolerancia a refrescos del navegador.

## 4. Producto

- Mantener `Convocatoria y destinatarios` fuera del flujo editable de preparacion; usarlo como metrica, alerta o modulo separado.
- Mantener `Representacion y poderes` en Comunicaciones, Reportes y Unidades, no como tarea de la cabina de preparacion.
- Convertir el PRD en historias de usuario actualizadas.
- Definir reglas de negocio para apoderados y voto ponderado.
- Decidir el proveedor embebido de reunion virtual; el enlace de reunion debe ser generado por ese proveedor, no escrito por el administrador.
