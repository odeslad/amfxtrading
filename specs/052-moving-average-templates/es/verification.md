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
