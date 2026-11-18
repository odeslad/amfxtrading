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
