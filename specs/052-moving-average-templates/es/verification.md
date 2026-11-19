# 052 — Plantillas de medias móviles por broker · Verificación

## Tarea 1 · [db] Tablas de plantillas y migración de datos

- **Mecanismo:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` desde producción por el túnel SSH; la migración ejecutada en producción dentro de una transacción deshecha al final.
- **Pasos:** migración `20261119100000_ma_templates`: `ma_templates` (`userId` FK, `name`, `isDefault`, `averages` JSONB, fechas, índice en `userId`), `ma_template_brokers` (PK `userId` + `broker`, `templateId` FK con borrado en cascada), y un `INSERT … SELECT` que convierte cada `chart_indicators.emas` en una plantilla por defecto «Default» con `type: 'ema'` añadido a cada media. Modelos `MaTemplate`, `MaTemplateBroker`.
- **Datos de producción:** una fila (usuario 1): EMA 24 (#e05c5c, sólida, 2), EMA 48 (#3a7bd5, sólida, 2), EMA 288 (#4caf84, punteada, 1), EMA 576 (#f5a623, punteada, 1).
- **Ejecución deshecha en producción:** tablas creadas; una plantilla «Default», `isDefault` verdadero, las cuatro medias con sus ids, colores, estilos, grosores y periodos sin cambios y `"type": "ema"` añadido; tras el `ROLLBACK` `ma_templates` no existe.
- **Cambio durante la tarea:** la primera versión tenía un índice único parcial (una por defecto por usuario). Funcionaba (rechazó una segunda por defecto), pero Prisma 5 no puede expresarlo, así que `prisma migrate diff` contra producción no volvería a salir vacío; se quitó y la regla pasa a las rutas (tarea 2, en una transacción). El diff contiene ahora exactamente las tablas, el índice y las claves ajenas de la migración (el `INSERT` de datos no es esquema).
- **Resultado:** ✅
- **Est vs Actual:** 1 SP · 0.75 SP.

## Tarea 2 · [backend] Rutas /ma-templates

- **Mecanismo:** vitest sobre un servidor Express de usar y tirar con `requireAuth` y una cookie JWT real + lint + typecheck + build.
- **Pasos:** `src/routes/ma-templates.ts` montado como `/ma-templates` detrás de `requireAuth`: `GET` (plantillas + asignaciones; crea una «Default» vacía si el usuario no tiene plantilla por defecto), `POST`, `PUT /:id` (nombre y/o medias), `PUT /:id/default` (una transacción: desmarca la anterior y marca la nueva — la regla que habría mantenido el índice parcial quitado), `DELETE /:id` (`409` para la de por defecto; las filas de los brokers van en cascada), `PUT /assignments` (`templateId` asigna, `null` vuelve a la de por defecto). Todas las consultas limitadas al usuario; una plantilla de otro usuario responde `404`. Validación: nombre de 1 a 40 caracteres (recortado); cada media con `type` ema/sma, `period` entero ≥ 1 sin límite superior, `color` `#rrggbb`, `style` solid/dashed/dotted, `width` 1–3, `id` único. Tras cada escritura sale `ma_templates` por el WebSocket a los clientes de ese usuario (`ws.broadcastMaTemplates`, conectado en `index.ts` como los envíos de las alertas).
- **Tests:** 10 nuevos en `ma-templates.test.ts` (validación de cada campo incluido periodo 1 y 5 000 aceptados y 0 / 2,5 rechazados, reglas del nombre, 401, lista con la de por defecto creada, crear + aviso, actualizar limitado al usuario + 404 + 400 sin nada que cambiar, cambio de la de por defecto en una transacción, la de por defecto no se borra + borrado, asignación puesta / quitada / 404). Suite completa 201 tests en verde. `pipe-reader.test.ts` (pipe real, tiempos) falló una vez en la suite completa y pasó 3 de 3 solo y en la siguiente suite completa: intermitente, no lo toca esta tarea.
- **Resultado:** ✅
- **Est vs Actual:** 2.5 SP · 1.25 SP.

## Deploy del backend (parte de la tarea 7, adelantado para comprobar el gráfico con datos reales)

- **19-nov-2026:** `7b335a4`, `9511462`, `3acb4a7` subidos solos (`backend/` y `specs/`); pipeline del backend en verde, reiniciado. En producción: migración `20261119100000_ma_templates` aplicada; `ma_templates` tiene la plantilla 1 «Default», por defecto, 4 medias, la primera de tipo `ema`. El frontend desplegado sigue usando `/chart-indicators`, sin tocar.

## Tarea 3 · [frontend] Plantillas y SMA en el gráfico

- **Mecanismo:** `npm run build` + eslint; comprobación local en `https://local.amfxtrading.com:5174` con Vite y proxy al API de producción.
- **Pasos:** `chart.types.ts`: `MovingAverage` con `type: 'ema' | 'sma'` (sustituye a `Ema`). `LightweightChart.tsx`: `calcSma` (suma móvil) junto a `calcEma`, las dos sobre las mismas velas válidas; la vela en curso da un paso de EMA, o para una SMA los últimos `period − 1` cierres cerrados más el cierre en vivo, así que el punto no salta al cerrar la vela. `src/lib/useMaTemplates.ts`: carga `/ma-templates`, recarga con el WS `ma_templates`, `templateFor(broker)` (la asignada, si no la de por defecto), `averagesFor(broker)` sin las medias ocultas en el dispositivo (`localStorage` `chart.maHidden`). `ChartPage` / `ChartSlot`: cada lado dibuja `averagesFor(su broker)`; fuera la carga y el guardado de `/chart-indicators`. `IndicatorsPanel`: la plantilla del broker con una casilla de mostrar/ocultar por media (el selector de plantilla y el enlace a Settings llegan en la tarea 4). El selector de color y la paleta pasan a `ColorPicker.tsx` y `movingAverages.ts` (con `maLabel`, «EMA 24») para el editor de Settings.
- **Comprobación del operador (19-nov-2026):** los gráficos muestran las mismas cuatro EMAs (24, 48, 288, 576) con sus colores y estilos; el panel muestra «Default» y las cuatro medias; ocultar una la quita y sigue oculta al recargar; vista partida bien.
- **Pendiente:** una SMA en el gráfico solo se puede añadir cuando exista el editor de Settings — se comprueba en la tarea 5.
- **Resultado:** ✅ (comprobación de SMA en la tarea 5)
- **Est vs Actual:** 3 SP · 1.5 SP.

## Tarea 4 · [frontend] Plantilla del broker desde el gráfico

- **Mecanismo:** `npm run build` + eslint; comprobación local del operador contra producción.
- **Pasos:** `IndicatorsPanel`: selector «Template for <broker>» (todas las plantillas, «Default (★ nombre)») que llama a `PUT /ma-templates/assignments`; las medias de la plantilla con mostrar/ocultar; enlace «Edit in Settings › Display» a `/settings?tab=display` (`SettingsPage` abre ahora la pestaña que dice la dirección). En el código la vista partida comparte un broker entre sus dos lados (solo cambia la temporalidad), así que el AC 8 (dos brokers lado a lado) no puede darse hoy; cada lado sigue resolviendo su plantilla.
- **Comprobación del operador (19-nov-2026):** asignar una plantilla nueva a un broker desde el gráfico redibujó ese gráfico al momento; el enlace abre Settings › Display.
- **Resultado:** ✅
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Tarea 5 · [frontend] Sección de plantillas en Settings › Display

- **Mecanismo:** `npm run build` + eslint; comprobación local del operador contra producción (escribe plantillas reales).
- **Pasos:** `MaTemplatesSection` al final de `DisplayTab`: lista (★ por defecto, número de medias, brokers que la usan), editor (EMA/SMA, periodo sin flechitas y en rojo si no es un entero ≥ 1, selector de color, estilo, grosor, quitar, añadir), *New template*, nombre, *★ Make default*, *Delete* con `ConfirmPanel` que nombra los brokers que pasan a la de por defecto, *Save template* (activo solo con cambios y periodos válidos); en móvil un selector de plantilla y tarjetas. La edición en curso se guarda por plantilla y si no se muestra la guardada (el lint de React prohíbe copiar props al estado en un efecto).
- **Comprobación del operador (19-nov-2026):** una plantilla nueva con una SMA 50 y una EMA 9 guardada y asignada desde el gráfico; la SMA más suave que la EMA y moviéndose con la vela en curso sin saltar al cerrarse; un cambio guardado en Settings llegó a un gráfico abierto en otra pestaña sin recargar; borrar la plantilla en uso nombró el broker y devolvió su gráfico a las cuatro EMAs de la de por defecto.
- **Cambio pedido tras esta comprobación:** una plantilla por broker **y temporalidad** (AC 12) — añadidas las tareas 6 a 8.
- **Resultado:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.
