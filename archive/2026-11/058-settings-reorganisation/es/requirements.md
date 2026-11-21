# 058 — Reorganización de Settings

> Estado: **cerrada**
> Sigue a: [057 — Sistema de diseño](../../057-design-system/es/requirements.md)

## Contexto
Settings tiene seis pestañas con el nombre de dónde se añadió cada ajuste por primera vez (Mirror, Display, Notifications, Visibility, Data, Server), así que ajustes relacionados están dispersos: los setup levels viven en Display, las órdenes rápidas en Mirror, la visibilidad de brokers y los pares en Visibility, el histórico de velas en Data. El guardado también cambia según la pestaña: un Save para Mirror, Display y Visibility, Save targets en Data, Save template dentro de las plantillas de medias, Save to EA para los pares y guardado inmediato en el resto. La spec 057 rehízo cada pestaña con el sistema de diseño compartido; esta spec reagrupa los ajustes por para qué sirven, da a Settings su propia navegación y unifica el guardado.

## Capas afectadas
- frontend

## Historias de usuario
- Como operador, quiero los ajustes agrupados por su propósito, para encontrar cada uno sin recordar en qué pestaña se añadió.
- Como operador, quiero que cada cambio se guarde al hacerlo, para no perder nunca un cambio al salir de la página.
- Como operador en el móvil, quiero una lista de secciones y una página por sección, para usar Settings con una mano.

## Criterios de aceptación
- CA 1. CUANDO se abre Settings ENTONCES muestra seis secciones, cada una con sus subsecciones en este orden:
  - **Trading**: Mirror presets · Quick orders · New trade (setup levels).
  - **Chart**: P&L · Drawings (trendlines, rectángulos, Fibonacci) · Price (spread).
  - **Indicators**: plantillas de medias · Cross trades (con sus etiquetas de SL / TP).
  - **Alerts & notifications**: Rules · Devices.
  - **Brokers & data**: Brokers (visibilidad) · Pairs · Candle history.
  - **System**: Server.
- CA 2. CUANDO la pantalla mide más de 768 px ENTONCES un menú lateral lista las seis secciones y la elegida muestra sus subsecciones una debajo de otra, cada una como Section con título; el menú marca la sección actual.
- CA 3. CUANDO la pantalla mide 768 px o menos ENTONCES Settings muestra primero la lista de secciones (cada una con un resumen de una línea de sus subsecciones) y al tocar una se abre su página con un botón para volver a la lista.
- CA 4. CUANDO cambia un ajuste (presets, órdenes rápidas, ajustes de display, setup levels, visibilidad de brokers, objetivos de velas, plantillas de medias) ENTONCES se guarda solo poco después del último cambio, sin botón Save, y un indicador "Saved" lo confirma; un cambio no válido (p. ej. órdenes rápidas sin un stop loss necesario, un periodo de plantilla menor que 1) no se guarda y muestra su error donde está.
- CA 5. CUANDO falla un guardado ENTONCES el indicador muestra el error y el cambio sigue en pantalla para reintentarlo.
- CA 6. CUANDO se editan los pares ENTONCES conservan su **Save to EA** explícito (cada guardado reescribe el config.json del EA).
- CA 7. CUANDO un enlace abre Settings con una sección (`/settings?section=indicators`) ENTONCES se muestra esa sección; los enlaces antiguos `?tab=` (`display`, `mirror`, `notifications`, `visibility`, `data`, `server`) siguen llevando a la sección que ahora los contiene.
- CA 8. CUANDO se dibuja cualquier parte de Settings ENTONCES usa solo los componentes compartidos de `shared/ui`; un tipo de elemento nuevo se añade ahí, nunca se dibuja en Settings.
- CA 9. CUANDO termina la reorganización ENTONCES cada ajuste conserva su comportamiento, su endpoint y su valor guardado; nada se pierde ni se reinicia.

## Fuera de alcance
- Ajustes nuevos o cambios en lo que hace un ajuste.
- Cambios de backend o de datos (se reutilizan `PUT /settings` y los endpoints de cada función).
- Otras pantallas de la app.
