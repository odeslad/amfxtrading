# 044 — MT4 como fuente completa y única de velas · Verificación

## Tarea 1 — Vela de cambio de barra solo desde una barra en curso

- **Mecanismo:** vitest + `npm run build` (más `npm run lint` y la batería completa).
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `services/candle-close.ts`: el snapshot guarda `serverNow = tick.time + tick.broker_offset × 1000`; solo se emite una vela cuando `time <= serverNow < time + 2 × periodo` y `low <= bid <= high`.
  - `npx vitest run src/services/candle-close.test.ts`: pasan 8 tests. Los 4 que había no cambian (cambio de barra normal, varias temporalidades a la vez, brokers y símbolos separados, hora de barra ausente). Nuevos: una barra atrasada del 20 de octubre que llega con la hora de servidor del 16 de noviembre no emite nada; un bid fuera del rango de la barra no emite nada; una barra cuyo símbolo siguió sin cotizar al entrar en el periodo siguiente se sigue cerrando; la última barra H1 del viernes se cierra en la apertura del lunes con el reloj del servidor parado durante el fin de semana.
  - `npm run build` y `npm run lint` limpios; `npm test`: 17 ficheros, 150 tests pasan.
- **Desviación respecto al primer borrador del diseño:** la ventana es de dos periodos, no de uno. Con un periodo, un símbolo sin cotización en el primer segundo de una barra nueva perdería su vela de cambio de barra en casi todas las barras (el reloj del servidor es común a todos los símbolos). El diseño se ha actualizado.
- **Aún sin probar:** el comportamiento en terminales reales — tarea 7.
- **Est vs Actual:** 1,5 SP vs 1 SP.

## Tarea 2 — El fichero del EA tiene autoridad sobre todas las velas cerradas

- **Mecanismo:** vitest + `npm run build` + ejecución manual contra una base de datos desechable.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `services/candles.ts`: `createMany … skipDuplicates` y el upsert de las dos últimas velas sustituidos por un `INSERT … ON CONFLICT DO UPDATE … WHERE … IS DISTINCT FROM` por bloque, con `db.$executeRaw` y `unnest` de cinco arrays. `upsertCandles` devuelve ahora las filas escritas.
  - `npx vitest run src/services/candles.test.ts`: pasan 4 tests (se descarta la barra en formación; ficheros vacíos y de una sola barra; una hora repetida en el fichero conserva sus últimos valores; columnas alineadas por posición).
  - Manual, contra una base `amfx_spec044` creada en el VPS nuevo solo con la tabla `candles` (esquema copiado de `amfxtrading`) y borrada después; el `upsertCandles` real ejecutado desde el PC del desarrollador por una redirección de puertos SSH:
    1. fichero con 3 velas cerradas → 3 filas escritas;
    2. la vela del medio cambiada a mano a cierre 1,10031 (una vela falsa), el mismo fichero otra vez → **1 fila escrita**, los cierres vuelven a 1,1211, 1,1212, 1,1213;
    3. el mismo fichero otra vez → **0 filas escritas**;
    4. fichero con una vela cerrada más → 1 fila escrita; la barra en formación no se guarda nunca; horas guardadas en UTC (`2026-10-20T13:00:00.000Z`);
    5. fichero de 27.000 velas cerradas → 27.000 filas en 1,4 s; el mismo fichero otra vez → **0 filas en 1,1 s**.
  - `npm run build` y `npm run lint` limpios. `backend/docs/architecture.md` y `.claude/CLAUDE.md` actualizados en el mismo commit.
- **Hallazgo fuera de esta tarea:** `npm test` pasó 154 de 154 en unas ejecuciones y falló un test en otras, siempre el mismo: `src/bridge/pipe-reader.test.ts > PipeReader on a real named pipe > retries a busy pipe with backoff…`. Pasa 5 veces de 5 ejecutado solo, sus ficheros no los ha tocado esta spec, y depende de tiempos reales sobre un named pipe, así que parece sensible a la carga cuando corre toda la batería en paralelo. Puede hacer fallar al azar el check del pipeline del backend; no se arregla aquí.
- **Est vs Actual:** 2 SP vs 1,5 SP.
