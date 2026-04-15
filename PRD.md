# PRD - Plataforma de Asambleas Virtuales para Propiedad Horizontal

## 1. Resumen

Este producto es una plataforma web dirigida a administradores de propiedad horizontal en Colombia. Su objetivo es digitalizar el ciclo completo de una asamblea: registro del administrador, configuración de la copropiedad, carga de propietarios y unidades, convocatoria, reunión virtual, votaciones en tiempo real, control de participación y generación automática del acta.

El problema principal que resuelve es la dificultad operativa de las asambleas presenciales, que suelen ser lentas, poco trazables y difíciles de documentar. La plataforma busca que la asamblea pueda realizarse de forma virtual, organizada y con evidencia clara de asistencia, participación y votación.

## 2. Objetivo del MVP

Permitir que un administrador:

1. Cree su cuenta en la plataforma.
2. Registre una copropiedad.
3. Cargue unidades privadas, propietarios y coeficientes.
4. Programe una asamblea con orden del dia.
5. Envie convocatorias a los participantes.
6. Ejecute una asamblea virtual con control de asistencia y quorum.
7. Abra y cierre votaciones por cada punto.
8. Muestre resultados en tiempo real.
9. Gestione la participacion mediante cola de palabra y temporizador.
10. Genere automaticamente un acta con resumen y resultados.

## 3. Usuarios

### 3.1 Administrador

Usuario principal del sistema. Es responsable de configurar la copropiedad, mantener la base de datos, preparar la asamblea, moderar la sesion y cerrar el proceso con acta y reportes.

### 3.2 Propietario

Usuario invitado a la asamblea. Puede ingresar a la reunion, registrar asistencia, votar, consultar resultados y solicitar la palabra.

### 3.3 Apoderado

Usuario autorizado para participar y votar en nombre de un propietario, sujeto a validacion previa por parte del administrador.

### 3.4 Moderador

Rol opcional de apoyo durante la asamblea para controlar el turno de intervenciones, el temporizador y la operacion de la sesion.

## 4. Problemas que resuelve

- Dificultad para convocar y organizar asambleas presenciales.
- Falta de trazabilidad sobre asistencia, quorum y votaciones.
- Demoras al contar votos manualmente.
- Dificultad para ordenar intervenciones y tiempos de participacion.
- Carga administrativa para redactar el acta al finalizar.
- Base de datos dispersa o desactualizada de unidades y propietarios.

## 5. Propuesta de valor

La plataforma convierte la asamblea en un proceso digital, verificable y facil de administrar desde un solo lugar. Reduce tareas manuales, mejora la transparencia y permite una experiencia mas practica tanto para el administrador como para los propietarios.

## 6. Alcance del MVP

### 6.1 Modulos incluidos

- Registro e inicio de sesion del administrador.
- Registro de copropiedad.
- Gestion de unidades privadas y propietarios.
- Programacion y preparacion de asambleas.
- Envio de convocatorias.
- Sala de asamblea virtual.
- Control de asistencia y quorum.
- Votaciones en tiempo real.
- Cola de palabra con temporizador de un minuto.
- Dashboard posterior a la asamblea.
- Generacion automatica de acta en borrador.

### 6.2 Fuera de alcance inicial

- Integraciones avanzadas con WhatsApp.
- Firma electronica del acta.
- Grabacion de audio o video.
- Transcripcion automatica.
- Facturacion o contabilidad.
- Aplicacion movil nativa.
- Multiples niveles complejos de permisos corporativos.

## 7. Flujo principal del producto

1. El administrador se registra en la plataforma.
2. Valida su cuenta e inicia sesion.
3. Registra la copropiedad que administra.
4. Carga unidades, propietarios, coeficientes y datos de contacto.
5. Crea una nueva asamblea.
6. Define fecha, hora, orden del dia y participantes habilitados.
7. Envia invitaciones con enlace de acceso.
8. Los participantes ingresan a la sala virtual.
9. El sistema registra asistencia y calcula quorum en tiempo real.
10. El administrador presenta cada punto del orden del dia.
11. Abre votaciones y los participantes emiten su voto desde la interfaz.
12. El sistema muestra resultados en tiempo real.
13. Los participantes solicitan la palabra y entran en cola.
14. El administrador concede el turno y corre el temporizador de un minuto.
15. Al cerrar la sesion, el sistema genera el acta y el dashboard final.

## 8. Requisitos funcionales

### 8.1 Registro y acceso del administrador

- El sistema debe permitir que un administrador cree una cuenta con nombre, correo, telefono y contrasena.
- El sistema debe permitir inicio de sesion y recuperacion de contrasena.
- El sistema debe permitir validacion de correo electronico.
- El sistema debe permitir que un mismo administrador gestione una o varias copropiedades en el futuro.

### 8.2 Registro de copropiedad

- El administrador debe poder registrar nombre de la copropiedad, NIT si aplica, direccion, ciudad y datos generales.
- El sistema debe permitir asociar unidades privadas a la copropiedad.
- El sistema debe permitir definir coeficientes o peso de voto por unidad o propietario, segun las reglas del negocio.

### 8.3 Base de datos de unidades y propietarios

- El administrador debe poder crear, editar y desactivar unidades.
- El administrador debe poder crear, editar y desactivar propietarios.
- El sistema debe permitir asociar uno o varios propietarios a una unidad.
- El sistema debe permitir registrar correo, telefono, documento y estado de habilitacion.
- El sistema debe permitir registrar apoderados.

### 8.4 Preparacion de asamblea

- El administrador debe poder crear una asamblea con fecha, hora y nombre.
- El sistema debe permitir definir el orden del dia.
- El sistema debe permitir marcar puntos que requieren votacion.
- El sistema debe permitir adjuntar documentos de soporte en versiones futuras cercanas.
- El administrador debe poder dejar lista la secuencia de puntos para la sesion.

### 8.5 Convocatorias

- El sistema debe permitir enviar invitaciones a los participantes habilitados.
- Cada invitacion debe incluir informacion de fecha, hora y enlace de acceso.
- El sistema debe registrar si la invitacion fue enviada.
- El sistema debe permitir reenvio de invitaciones.

### 8.6 Sala virtual de asamblea

- Los participantes deben poder ingresar mediante un enlace seguro.
- El sistema debe registrar hora de ingreso y salida.
- El administrador debe visualizar quienes estan conectados.
- El sistema debe mostrar el punto actual del orden del dia.
- El sistema debe reflejar el quorum en tiempo real.

### 8.7 Votaciones

- El administrador debe poder abrir una votacion para un punto especifico.
- Los participantes habilitados deben poder votar desde la misma interfaz.
- El sistema debe impedir votos duplicados por participante o representacion.
- El sistema debe cerrar la votacion manualmente o por tiempo en una version posterior.
- El sistema debe mostrar resultados agregados en tiempo real.
- El sistema debe registrar evidencia de cada voto para auditoria.

### 8.8 Participacion y uso de la palabra

- Los participantes deben poder solicitar la palabra.
- El sistema debe crear una cola visible para el administrador.
- El administrador debe poder conceder, omitir o cerrar turnos.
- Cada intervencion debe contar con un temporizador de un minuto.
- El sistema debe mostrar visualmente el tiempo restante.

### 8.9 Dashboard post-asamblea

- El administrador debe poder consultar asistencia total.
- El administrador debe poder consultar quorum alcanzado.
- El administrador debe poder consultar resultados por votacion.
- El administrador debe poder consultar decisiones aprobadas y rechazadas.
- El sistema debe presentar informacion clara para seguimiento posterior.

### 8.10 Acta automatica

- El sistema debe generar un borrador automatico del acta al finalizar la asamblea.
- El acta debe incluir datos de la copropiedad, fecha, asistentes, quorum, orden del dia, votaciones y decisiones.
- El administrador debe poder revisar y editar el borrador antes de cerrar la version final.

## 9. Requisitos no funcionales

- La plataforma debe ser web y responsive.
- Debe funcionar correctamente en computador y movil.
- Debe soportar actualizacion en tiempo real durante la asamblea.
- Debe mantener trazabilidad de eventos clave: ingreso, salida, voto, apertura y cierre de votaciones.
- Debe proteger datos personales de propietarios y administradores.
- Debe ofrecer una experiencia sencilla para usuarios no tecnicos.

## 10. Reglas de negocio iniciales

- Solo un administrador autenticado puede crear y gestionar una copropiedad.
- Solo participantes habilitados pueden ingresar a la asamblea.
- Solo participantes con derecho a voto pueden votar.
- Cada voto debe asociarse a una unidad, propietario o representacion valida.
- El resultado visible para todos debe ser agregado, no necesariamente el detalle individual.
- El acta automatica se genera al cierre, pero queda en estado de borrador editable.

## 11. Riesgos y temas a validar

- Como se verificara la identidad del propietario o apoderado.
- Si el voto sera simple o ponderado por coeficiente desde la primera version.
- Como se manejara la representacion de varias unidades por una misma persona.
- Que nivel de validez juridica se espera para el acta y las evidencias.
- Si la reunion virtual incluira video en vivo propio o se integrara con otra herramienta.

## 12. Prioridades de desarrollo

### Fase 1

- Registro e inicio de sesion del administrador.
- Registro de copropiedad.
- Carga de unidades y propietarios.
- Creacion de asamblea y orden del dia.

### Fase 2

- Invitaciones.
- Sala virtual.
- Asistencia y quorum.
- Votacion en tiempo real.

### Fase 3

- Cola de palabra.
- Temporizador.
- Dashboard.
- Acta automatica.

## 13. Criterio de exito del MVP

El MVP sera exitoso si un administrador puede organizar y ejecutar una asamblea real de principio a fin dentro de la plataforma, sin depender de hojas de calculo, conteo manual de votos ni redaccion completa manual del acta.
