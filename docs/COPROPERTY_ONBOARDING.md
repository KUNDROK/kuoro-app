# Onboarding de Copropiedad

## Objetivo

Diseñar un flujo de alta de copropiedad que capture de forma precisa la composicion real de la propiedad horizontal administrada en Colombia, para que despues el formulario de carga de unidades y propietarios se genere de forma personalizada.

## Base legal colombiana

La referencia principal es la Ley 675 de 2001, expedida el 3 de agosto de 2001, que regula el regimen de propiedad horizontal en Colombia.

Puntos clave del marco legal:

- El articulo 3 define:
  - `edificio`
  - `conjunto`
  - `edificio o conjunto de uso residencial`
  - `edificio o conjunto de uso comercial`
  - `edificio o conjunto de uso mixto`
  - `bienes privados o de dominio particular`
  - `coeficientes de copropiedad`
  - `modulos de contribucion`
- El articulo 5 exige que el reglamento de propiedad horizontal contenga, entre otros:
  - identificacion de bienes de dominio particular
  - determinacion de bienes comunes
  - coeficientes de copropiedad y modulos de contribucion
  - destinacion de los bienes privados
- El articulo 27 establece especial tratamiento para edificios o conjuntos de uso mixto y comercial, donde los coeficientes y modulos pueden variar segun destinacion y caracteristicas.

## Implicacion para el producto

No basta con preguntar solo "nombre del conjunto" y "numero de unidades". Para generar formularios correctos de unidades y propietarios, el sistema debe entender:

- el tipo legal de la copropiedad
- la forma fisica del desarrollo
- la mezcla de destinos de las unidades
- si la composicion se organiza por torres, bloques, manzanas, etapas o sectores
- si hay unidades con reglas de contribucion diferentes

## Clasificacion que debe capturar el sistema

### 1. Tipo legal principal

Opciones:

- `Residencial`
- `Comercial`
- `Mixto`

### 2. Configuracion fisica principal

Opciones:

- `Edificio`
- `Conjunto`
- `Conjunto por etapas`

### 3. Composicion habitacional o funcional

Esta capa describe como estan organizadas las unidades privadas.

#### Si es residencial

Opciones posibles:

- `Edificio de apartamentos`
- `Conjunto de casas`
- `Conjunto de torres de apartamentos`
- `Conjunto con casas y apartamentos`
- `Residencial con locales comerciales`
- `Residencial con oficinas o consultorios`

#### Si es comercial

Opciones posibles:

- `Centro comercial o galerias`
- `Edificio de oficinas`
- `Parque empresarial`
- `Conjunto de bodegas`
- `Complejo de locales comerciales`
- `Comercial mixto por sectores`

#### Si es mixto

Opciones posibles:

- `Vivienda + locales`
- `Vivienda + oficinas`
- `Vivienda + comercio + oficinas`
- `Vivienda + bodegas`
- `Otra mezcla sectorizada`

## Principio de UX

El administrador no deberia enfrentarse a un formulario largo y rigido desde el inicio.

El flujo debe ser conversacional y progresivo:

1. Primero clasificar la copropiedad.
2. Luego describir su estructura fisica.
3. Luego detallar los tipos de unidades que existen.
4. Finalmente generar la plantilla personalizada para carga masiva o manual.

## Flujo organico propuesto

### Paso 1. Identidad basica de la copropiedad

Campos:

- nombre de la copropiedad
- ciudad
- direccion
- NIT
- numero de matricula o dato interno opcional

### Paso 2. Tipo legal de propiedad horizontal

Pregunta:

- `Que tipo de propiedad horizontal administras?`

Opciones:

- residencial
- comercial
- mixta

Este paso define reglas posteriores del flujo.

### Paso 3. Forma del desarrollo

Pregunta:

- `Como esta conformada fisicamente la copropiedad?`

Opciones:

- un solo edificio
- varios edificios o torres
- conjunto de casas
- conjunto mixto de casas y edificios
- parque empresarial o de bodegas
- otra configuracion

### Paso 4. Estructura organizativa interna

Pregunta:

- `Como se identifican las unidades dentro de la copropiedad?`

Opciones dinamicas:

- por torres y apartamentos
- por bloques y apartamentos
- por manzanas y casas
- por etapas, torres y apartamentos
- por bodegas
- por locales
- por oficinas
- combinacion personalizada

Este paso es critico porque de aqui sale la estructura del formulario de unidades.

### Paso 5. Composicion de unidades

En lugar de pedir solo un numero total, el sistema debe pedir una matriz de composicion.

Ejemplos:

- `3 torres de apartamentos`
- `2 manzanas de casas`
- `12 locales comerciales en primer piso`
- `18 oficinas en torre empresarial`
- `24 bodegas sector logistico`

Cada bloque de composicion debe capturar:

- nombre del sector o agrupacion
- tipo de unidad
- cantidad
- patron de identificacion
- si aporta coeficiente propio
- si tiene reglas especiales de administracion

### Paso 6. Destinacion de las unidades privadas

El sistema debe preguntar:

- `Que tipos de bienes privados existen en esta copropiedad?`

Opciones multiples:

- apartamento
- casa
- local comercial
- oficina
- consultorio
- bodega
- parqueadero privado
- deposito
- otro

Esto permite definir campos especializados mas adelante.

### Paso 7. Regla de identificacion de unidades

Necesitamos saber como se nombran o numeran.

Ejemplos:

- apartamento por torre + piso + numero
- casa por manzana + numero
- local por bloque + local
- bodega por lote o modulo
- oficina por torre + oficina

Con esto podemos autogenerar una plantilla inicial de unidades.

### Paso 8. Regla de propiedad y representacion

Preguntas:

- una unidad puede tener varios propietarios?
- un propietario puede tener varias unidades?
- manejaras apoderados?
- usaras coeficientes desde el inicio?
- existen modulos de contribucion sectorizados?

Estas respuestas afectan el modulo posterior de propietarios y votacion.

## Resultado esperado del onboarding

Al terminar este flujo, el sistema no solo guarda "una copropiedad", sino una configuracion estructural que permita crear formularios inteligentes.

## Ejemplos de salidas estructuradas

### Caso A. Residencial simple

- tipo legal: residencial
- forma: edificio
- composicion:
  - torre unica
  - 48 apartamentos
- identificacion: apartamento
- plantilla generada:
  - torre
  - apartamento
  - piso
  - area privada
  - coeficiente

### Caso B. Residencial con comercio

- tipo legal: mixto
- forma: edificio
- composicion:
  - 72 apartamentos
  - 8 locales
- identificacion por sectores
- plantilla generada:
  - sector residencial
  - sector comercial
  - tipo de unidad
  - codigo de unidad
  - coeficiente
  - modulo de contribucion

### Caso C. Conjunto mixto de casas y torres

- tipo legal: residencial o mixto segun reglamento
- forma: conjunto
- composicion:
  - 2 torres de apartamentos
  - 36 casas
  - 6 locales
- plantilla generada:
  - sector
  - tipo de unidad
  - torre o manzana
  - numero de unidad
  - area
  - coeficiente

### Caso D. Comercial de bodegas

- tipo legal: comercial
- forma: conjunto
- composicion:
  - 24 bodegas
  - 6 locales de servicio
- plantilla generada:
  - tipo de unidad
  - modulo o bodega
  - area
  - actividad
  - coeficiente
  - modulo de contribucion

## Modelo conceptual recomendado

La entidad `Property` ya no deberia quedarse corta. Debe evolucionar para guardar:

- `legalType`
- `developmentShape`
- `structureMode`
- `hasSectors`
- `usesCoefficients`
- `usesContributionModules`
- `supportsProxies`

Y adicionalmente una tabla o coleccion de composicion:

- `PropertyComposition`
  - propertyId
  - label
  - unitType
  - count
  - groupingType
  - identifierPattern
  - sectorName

## Consecuencia directa en el modulo de unidades

Con esta informacion, el sistema podra construir formularios realmente adaptados:

- formulario de apartamentos si detecta torres
- formulario de casas si detecta manzanas
- formulario de locales si detecta sector comercial
- formulario mixto cuando la copropiedad combine varios tipos

## Recomendacion de producto

No pedir toda la informacion en una sola pantalla. Recomiendo un wizard de 5 bloques:

1. Datos generales
2. Clasificacion legal
3. Forma y estructura
4. Composicion de unidades
5. Reglas para propietarios y votacion

## Decision recomendada

La copropiedad debe ser modelada no solo como un registro administrativo, sino como una plantilla estructural del universo de unidades privadas.

Eso es lo que despues nos va a permitir que el cargue de unidades y propietarios sea verdaderamente personalizado y que las asambleas reflejen la realidad juridica y operativa de cada propiedad horizontal.

## Fuentes oficiales

- Ley 675 de 2001 en la Secretaria Juridica Distrital de Bogota:
  https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=4162
- Compilatorio normativo relacionado con Ley 675 de 2001:
  https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=115718
- Concepto de Minvivienda sobre contenido del reglamento y desarrollo de la Ley 675:
  https://www.minvivienda.gov.co/concepto_juridico/concepto-001436-del-29-de-enero-de-2009-reglamentacion-ley-675-de-2001
