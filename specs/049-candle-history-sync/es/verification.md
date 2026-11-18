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
