# 053 — SMA en cruces · Verificación

## Tarea 1 · [db] Columnas de tipo de media

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde producción.
- **Pasos:** la migración `20261120000000_moving_average_types` añade `fastType`/`slowType` (`ema_cross_alerts`, `ema_notifications`) y `emaTradesFastType`/`emaTradesSlowType` (`settings_display`), todas `TEXT NOT NULL DEFAULT 'ema'`; campos equivalentes en `schema.prisma`.
- **Resultado:** ✅ esquema válido, cliente generado, build en verde; el diff desde producción son exactamente las seis columnas de la migración.
- **Est vs Real:** 0.5 SP · 0.25 SP.

## Tarea 2 · [backend] SMA y helper de medias

- **Mecanismo:** vitest + build + lint.
- **Pasos:** `indicators/sma.ts` (`calculateSma`, misma suma móvil que `calcSma` del gráfico); `indicators/moving-average.ts` (`MA_TYPES`, `isMaType`, `calculateMa`, `maLabel`); `moving-average.test.ts`.
- **Resultado:** ✅ 17 tests de indicadores en verde, build y lint limpios.
- **Est vs Real:** 0.5 SP · 0.25 SP.
