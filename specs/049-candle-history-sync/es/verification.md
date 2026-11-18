# 049 — Sincronización del histórico de velas desde Settings · Verificación

## Tarea 1 · [ea] Prueba: descarga de histórico en el terminal Demo

- **Mecanismo:** manual, script desechable `SyncSpike049` lanzado por el operador en el terminal Demo (2026-11-18).
- **Pasadas:**
  1. `ChartOpen` + `ChartNavigate(CHART_BEGIN)`: EURUSD M5 2 621 → 2 621, D1 2 050 → 2 050; gráficos cerrados. No descarga nada.
  2. Lo mismo más la tecla Inicio (`PostMessageW`): parado por «DLL is not allowed» (el script necesita *Allow DLL imports*).
  3. Tecla Inicio con DLL permitidas: M5 10 341 → 10 341, D1 2 875 → 2 875. Las barras previas venían de que el operador retrocedió a mano con la flecha izquierda.
  4. Gráfico al frente + teclas Re Pág, Inicio y flecha izquierda, 30 s de paciencia: los gráficos retroceden a la vista, pero M5 24 869 → 24 869 y después 33 950 → 33 950 (cargadas otra vez a mano antes de cada pasada).
- **Resultado:** no concluyente como script — todo el crecimiento vino de retroceder a mano, así que el broker sí da más histórico, pero un script bloqueado en `Sleep` no lo consiguió. Decisión del operador: implementarlo exactamente como la spec 044 (commit archivado `a86b7fb`), con la que el mismo terminal pasó de 2 065 a 65 425 barras en EURUSD M15: el EA, en cada vuelta del temporizador, abre el gráfico temporal, `ChartNavigate(CHART_BEGIN)` + Inicio con `PostMessageW` a `CHART_WINDOW_HANDLE`, devuelve el control y decide en las vueltas siguientes (espera mientras haya `ERR_HISTORY_UPDATING` o sigan llegando barras; se rinde tras un rato sin cambios o un máximo por gráfico). La prueba pasa a la tarea 6 en el terminal Demo.
- **Nota:** el script siempre probaba su input `SPIKE_SYMBOL` (EURUSD), fuera cual fuera el gráfico donde se soltara (GBPCHF, USDCNH); no se le explicó al operador. EURUSD M5 creció entre las pasadas 3 → 4 → 5 (10 341 → 24 869 → 33 950) mientras el operador trabajaba en otros gráficos: los bloques pedidos con las teclas llegaron después de que el script se rindiera, lo que apunta a una espera demasiado corta, no a un método equivocado.
- **Impacto en el diseño:** `HttpBridgeCommands` necesita `user32.dll` (`PostMessageW`), así que *Allow DLL imports* debe estar activado también en ese EA (ya lo está en `HttpBridgeState`, que usa `kernel32.dll` para el pipe).
- Ficheros de la prueba borrados del terminal Demo.
- **Est vs Actual:** 1 SP · 1 SP.

## Tarea 2 · [db] Migración: tabla antigua, tabla de velas nueva, candle_syncs

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build` + lint + typecheck; `prisma migrate diff` desde el esquema de producción (leído por un túnel SSH, sin escribir nada) hasta el datamodel nuevo.
- **Pasos:** migración `20261118000000_candle_sync`: `candles` renombrada a `candles_legacy` (y `candles_pkey` a `candles_legacy_pkey`), `candles` nueva y vacía con las mismas columnas y clave, `candle_syncs` nueva (clave broker + temporalidad, `target` 10 000 por defecto, `state` `idle` por defecto). Modelos Prisma `CandleLegacy` y `CandleSync`.
- **Resultado:** ✅ esquema válido, cliente generado, build, lint y typecheck limpios. La diferencia de producción al datamodel es exactamente `candles_legacy` (mismas columnas y clave que la `candles` de hoy) más `candle_syncs`, con `candles` sin cambios — el estado final de la migración. `prisma migrate status` en producción: solo esta migración pendiente (sin aplicar; se ejecuta con el deploy del backend). El renombrado solo cambia el catálogo: no lee las páginas dañadas. No había credenciales de un PostgreSQL local, así que la migración no se ejecutó en una BD de pruebas.
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Tarea 3 · [backend] Tabla antigua o nueva por broker y temporalidad

- **Mecanismo:** vitest + lint + typecheck + build.
- **Pasos:** `services/candle-store.ts`: conjunto en memoria de parejas migradas cargado al arrancar desde `candle_syncs` (`lastSyncAt` con valor), `markMigrated`, `candleTable(broker, timeframe)` → `db.candle` o `db.candleLegacy`, `storedSymbols` (DISTINCT de las dos tablas). Visto al implementar: además del watcher, el cierre en el tick y `GET /candles`, otros tres lectores usan velas — el evaluador de alertas de EMA, el de notificaciones de EMA y `GET /setup-levels` — más `GET /symbols`; todos pasan por el store (diseño actualizado).
- **Resultado:** ✅ 5 tests nuevos (pareja sin sincronizar → antigua; pareja marcada → nueva, solo esa; parejas cargadas al arrancar; recargar olvida; símbolos de las dos tablas, una vez cada uno, ordenados); suite completa 18 ficheros / 151 tests; lint, typecheck y build limpios. Sin parejas migradas el backend lee y escribe `candles_legacy`, las mismas filas que hoy.
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Tarea 4 · [backend] Rutas /candle-sync

- **Mecanismo:** vitest (router montado en un Express de prueba, `fetch` contra él; BD, config y liveness simulados) + lint + typecheck + build.
- **Pasos:** `routes/candle-sync.ts` montado en `/candle-sync` detrás de `requireAuth`: `GET /` (crea las filas que falten con objetivo 10 000; cada broker con `connected` y sus cinco temporalidades en orden M5 → D1), `PUT /targets` (100 … 50 000), `POST /` (404 broker desconocido, 503 EA sin conectar, 409 sincronización en cola o en curso; si no, filas → `queued` con un `requestId` nuevo y `sync-command.json` escrito, 202). `bridge/sync-io.ts`: `writeSyncCommand` (temporal + rename) y `withdrawSyncCommand` para la tarea 5.
- **Resultado:** ✅ 10 tests nuevos (rango del objetivo, temporalidad desconocida, lista vacía; temporalidades sin duplicados y ordenadas; el POST encola y escribe el comando con cada objetivo; 409 y 503 no escriben nada; 404; orden y conexión del GET; el PUT guarda el objetivo); suite completa 19 ficheros / 161 tests; lint, typecheck y build limpios.
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Tarea 5 · [backend] Seguimiento de la sincronización

- **Mecanismo:** vitest con ficheros de prueba en una carpeta de bridge temporal (BD y store de velas simulados) + lint + typecheck + build.
- **Pasos:** `bridge/sync-watcher.ts`: un `SyncWatcher` por broker (arranca con el file watcher), lee `sync-status.json` cada segundo y solo atiende un estado cuando cambia y pertenece a una petición en curso. `running` → fila `running` con «SÍMBOLO hechos/total»; `complete` → lee los `sync/<SYM>_<TF>.json` de esa temporalidad y, en una transacción (10 min de margen), borra la pareja de la tabla nueva, inserta las velas por lotes y fija `done`, `candleCount` (las velas del símbolo con menos), `detail` y `lastSyncAt`; después marca la pareja como migrada y borra sus ficheros. `error` / `finished` con temporalidades aún ocupadas → `error`. Vigilancia de bloqueo: 5 min sin cambios → se retira `sync-command.json`, filas en `error`. WS `candle_sync` `{ broker, timeframe, state, detail, candleCount, lastSyncAt, done?, total? }` (`ws.broadcastCandleSync`).
- **Resultado:** ✅ 8 tests nuevos (lectura del estado; progreso en curso; completa → una transacción, 16 212 filas de dos símbolos, `candleCount` 6 212, pareja migrada, solo se borran los ficheros de esa temporalidad; transacción fallida → error, sin migrar, se conserva el número anterior; sin ficheros → error, no se borra nada; error del EA → todas las temporalidades ocupadas en error; estado antiguo o repetido ignorado; bloqueo → comando retirado y error); suite completa 20 ficheros / 169 tests; lint, typecheck y build limpios.
- **Anotado:** las velas que cierran entre que el EA escribe los ficheros de sincronización y el cambio van a la tabla antigua (la pareja aún no está migrada); el fichero de velas normal del EA (últimas 100 barras cada 60 s) las escribe en la tabla nueva en menos de un minuto tras el cambio, así que no queda hueco.
- **Est vs Actual:** 2.5 SP · 1 SP.
