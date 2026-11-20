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

## Tarea 3 · [backend] Cruces y setup levels con tipos

- **Mecanismo:** vitest + build + lint.
- **Pasos:** `ema-cross.ts` admite `fastType`/`slowType` opcionales (por defecto ema) y usa `calculateMa`; `/setup-levels` acepta `fastType`/`slowType` (400 si no es ema|sma; periodos iguales permitidos si los tipos difieren); test nuevo con la media lenta SMA.
- **Resultado:** ✅ 207 tests en verde, build y lint limpios.
- **Est vs Real:** 0.75 SP · 0.25 SP.

## Tarea 4 · [backend] Alertas y notificaciones con tipos

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `/ema-alerts` y `/ema-notifications` aceptan y validan `fastType`/`slowType` (ema|sma, por defecto ema; periodos iguales solo se rechazan con el mismo tipo); los stores cargan los tipos; los evaluadores usan `calculateMa`; los push dicen "EMA 24 / SMA 50" (título de la alerta "MA cross"); el payload WS de la notificación lleva los tipos.
- **Resultado:** ✅ 207 tests en verde (el test inestable conocido de `pipe-reader` falló una vez y pasó al repetir), typecheck, build y lint limpios.
- **Est vs Real:** 1.5 SP · 0.5 SP.

## Tarea 5 · [backend] Tipos de las medias del overlay en `/settings`

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `EmaTradesSettings` añade `fastType`/`slowType` (opcionales al recibir, por defecto ema; periodos iguales solo se rechazan con el mismo tipo), leídos y escritos en `emaTradesFastType`/`emaTradesSlowType`; tests de los tipos, el valor por defecto y la regla de periodos iguales.
- **Resultado:** ✅ 207 tests en verde (el inestable `pipe-reader` pasó de nuevo al repetir), typecheck, build y lint limpios.
- **Est vs Real:** 0.25 SP · 0.25 SP.

## Tarea 6 · [frontend] Tipos de media en el panel de alertas de cruce

- **Mecanismo:** `npm run build` + eslint; prueba local (Vite 5174 contra el API de producción).
- **Pasos:** componente compartido `MaTypeToggle` (EMA | SMA); `useEmaAlerts` lleva `fastType`/`slowType`; `AlertsPanel` tiene un selector delante de cada periodo, el umbral en su propia fila, pestaña "MA cross", filas de la lista con `maLabel` ("EMA 24 / SMA 48 ≤2p").
- **Resultado:** ✅ build y lint limpios; el operador creó una alerta EMA 24 / SMA 48 en FTMO EURUSD H1 y la vio en la lista con la etiqueta correcta.
- **Est vs Real:** 1.25 SP · 0.5 SP.

## Tarea 7 · [frontend] Tipos de media en las reglas de notificación

- **Mecanismo:** `npm run build` + eslint; prueba local (Vite 5174 contra el API de producción).
- **Pasos:** `useEmaNotifications` lleva `fastType`/`slowType` y añade `averagesLabel`; `NotificationPanel` tiene un `MaTypeToggle` delante de cada periodo; la tabla (columna "Averages"), las tarjetas del móvil y la confirmación de borrado muestran "SMA 20 / EMA 48". Arreglado además un fallo de maquetación previo visto en la prueba: los campos del panel se estiraban a todo el alto (`.field { flex: 1 }` compartido); el panel ahora los deja a su altura sin tocar el panel del diario.
- **Resultado:** ✅ build y lint limpios; el operador revisó el formulario y el arreglo.
- **Est vs Real:** 1 SP · 0.5 SP.
