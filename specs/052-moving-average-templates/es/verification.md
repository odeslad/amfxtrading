# 052 — Plantillas de medias móviles por broker · Verificación

## Tarea 1 · [db] Tablas de plantillas y migración de datos

- **Mecanismo:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` desde producción por el túnel SSH; la migración ejecutada en producción dentro de una transacción deshecha al final.
- **Pasos:** migración `20261119100000_ma_templates`: `ma_templates` (`userId` FK, `name`, `isDefault`, `averages` JSONB, fechas, índice en `userId`), `ma_template_brokers` (PK `userId` + `broker`, `templateId` FK con borrado en cascada), y un `INSERT … SELECT` que convierte cada `chart_indicators.emas` en una plantilla por defecto «Default» con `type: 'ema'` añadido a cada media. Modelos `MaTemplate`, `MaTemplateBroker`.
- **Datos de producción:** una fila (usuario 1): EMA 24 (#e05c5c, sólida, 2), EMA 48 (#3a7bd5, sólida, 2), EMA 288 (#4caf84, punteada, 1), EMA 576 (#f5a623, punteada, 1).
- **Ejecución deshecha en producción:** tablas creadas; una plantilla «Default», `isDefault` verdadero, las cuatro medias con sus ids, colores, estilos, grosores y periodos sin cambios y `"type": "ema"` añadido; tras el `ROLLBACK` `ma_templates` no existe.
- **Cambio durante la tarea:** la primera versión tenía un índice único parcial (una por defecto por usuario). Funcionaba (rechazó una segunda por defecto), pero Prisma 5 no puede expresarlo, así que `prisma migrate diff` contra producción no volvería a salir vacío; se quitó y la regla pasa a las rutas (tarea 2, en una transacción). El diff contiene ahora exactamente las tablas, el índice y las claves ajenas de la migración (el `INSERT` de datos no es esquema).
- **Resultado:** ✅
- **Est vs Actual:** 1 SP · 0.75 SP.
