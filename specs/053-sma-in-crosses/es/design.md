# 053 — SMA en cruces · Diseño

## Enfoque
Cada lado de un cruce lleva un tipo junto a su periodo: `fastType` / `slowType`, `'ema' | 'sma'`, por defecto `'ema'`. Un solo helper, `calculateMa(candles, type, period)`, sustituye las llamadas directas a `calculateEma` en todos los evaluadores. Los nombres de tablas y rutas (`ema_cross_alerts`, `/ema-alerts`, …) se mantienen: renombrarlos es trabajo sin beneficio.

## Por capa
### db
Una migración que añade columnas `TEXT NOT NULL DEFAULT 'ema'`:
- `ema_cross_alerts.fastType`, `slowType`
- `ema_notifications.fastType`, `slowType`
- `settings_display.emaTradesFastType`, `emaTradesSlowType`

Las filas existentes quedan EMA/EMA por el valor por defecto (AC 7). Sin relleno.

### backend
- `indicators/sma.ts` — `calculateSma` (misma forma `(number|null)[]` que `calculateEma`, null hasta tener `period` velas), e `indicators/moving-average.ts` con `calculateMa`. Tests al lado.
- `indicators/ema-cross.ts` — `EmaCrossContext` añade `fastType`, `slowType` (opcionales, por defecto ema). El setup level `EMA` conserva su nombre: es el valor de la media lenta.
- `alerts/ema-alert-evaluator.ts`, `ema-notification-evaluator.ts` — usan `calculateMa`; los títulos y textos del push usan `maLabel` → "EMA 24 / SMA 50". Velas de calentamiento sin cambios (`max(period)+2`; una SMA necesita menos que una EMA).
- `routes/ema-alerts.ts`, `ema-notifications.ts` — aceptan y validan `fastType`/`slowType` (opcionales, `ema|sma`, 400 si no); la regla de "periodos distintos" solo aplica si los dos tipos coinciden (EMA 20 / SMA 20 es un cruce válido).
- `routes/setup-levels.ts` — parámetros opcionales `fastType`/`slowType`, por defecto ema.
- `routes/settings.ts` — los dos campos del overlay, validados igual.

La API sigue siendo compatible: un cliente que no envía tipos recibe EMA. Sin cambios en el contrato con el EA.

### frontend
- Componente compartido `MaTypeToggle` (control segmentado EMA | SMA) delante de cada campo de periodo (maqueta).
- `AlertsPanel`, `NotificationPanel`, `DisplayTab` (sección del overlay): el selector en cada lado; las listas, la confirmación de borrado y la tabla de notificaciones muestran "EMA 24 / SMA 50" con `maLabel` de `movingAverages.ts`.
- `useEmaAlerts`, `useEmaNotifications`, `useEmaTradesSettings`, `useEmaCrossTrades` llevan los tipos; el overlay los pasa a `/setup-levels`.
- `NewTradePanel` sigue con EMA 24/48 (no se ha pedido).

## Flujo de datos
Frontend → REST (tipos en body/query) → BD → evaluadores al cierre de vela → WS `ema_alert` / push con las etiquetas. Nada cambia entre EA y backend.

## Alternativas
- Una columna JSON `averages` en vez de dos columnas de tipo: más flexible, pero pierde validación y consultas sencillas. Descartada.
- Renombrar las tablas a `ma_*`: nombres más limpios, pero migración arriesgada y muchos cambios. Descartada.

## Riesgos
- Los valores de SMA y EMA deben coincidir con el gráfico: `calculateSma` del backend replica `calcSma` del frontend (media simple de los últimos `period` cierres); cubierto con un test con la misma serie.

## Maqueta
https://claude.ai/artifact/VBvyuXQesrLvCMuex1jG1y — artboards: Chart › Alerts (escritorio), Settings › Notifications, Settings › Display overlay, Alerts (móvil).
