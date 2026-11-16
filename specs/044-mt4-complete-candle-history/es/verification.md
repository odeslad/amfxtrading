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

## Tareas 3 y 4 — Histórico completo desde MT4, sin huecos (backend + EA)

- **Mecanismo:** vitest + `npm run build` para el backend; para el EA, compilación en el VPS nuevo y cuatro pasadas en el terminal `Demo`, cada una iniciada por el usuario recargando el EA por RDP, medidas en el log del EA, el log del backend y la base de datos.
- **Resultado:** ✅ pasa (2026-11-16)
- **Cómo carga MT4 el histórico (medido, EURUSD M15 en `Demo`):** peticiones de serie temporal 2.065 → 2.065; `ChartOpen` + `ChartNavigate` 2.064 → 2.064; `ChartOpen` + tecla Inicio 2.065 → **65.425** (hasta el 1 de abril de 2024).
- **Pasadas en `Demo`:**
  1. *Petición + `ChartNavigate`:* no cargó nada (cifras de arriba). Descartada.
  2. *Tecla Inicio, histórico completo en el fichero normal:* 75 pares en unos 75 minutos, `Demo` de 263.588 a 2.273.428 velas, 0 timeouts del pipe. Dos defectos encontrados: exportaciones completas pisadas por el ciclo de 60 s antes de que el backend las leyera (CADJPY M15: 65.430 velas en el log del EA, 2.070 en la base de datos; también GBPAUD H1 y GBPCAD D1), y un hueco en H4 en EURUSD, GBPUSD (676 días de mercado, octubre de 2015 – mayo de 2022) y USDJPY (1.500 días, hasta julio de 2025) detrás de una isla antigua de histórico de 2009.
  3. *Fichero propio + tramo sin huecos + recorte:* unos 16 s por par con el histórico ya en disco; ficheros guardados y borrados por el backend; EURUSD H4 exportado como "6998 without holes of 19075" y 12.077 velas más antiguas borradas. Defecto encontrado: el recorte era incondicional y cortó también el borde más antiguo de pares sin hueco (EURUSD M5 29 velas, M15 432; EURGBP M5 480, M15 432 — **no se han repuesto**). Corregido con la marca `cutAtHole`: el backend solo recorta cuando el EA ha cortado en un hueco.
  4. *Versión final (sin fase de petición, espera corta cuando no llega nada):* unos 7 s por par, los 75 pares en unos 12 minutos, 0 timeouts del pipe.
- **Base de datos tras la pasada 4 (`Demo`, 2.430.054 velas):**
  - días con vela D1 y sin velas en M5, M15, H1 o H4, dentro del rango de cada temporalidad: **0** en los 15 símbolos; saltos de D1 de más de cinco días: **0**;
  - velas con la apertura o el cierre fuera del máximo–mínimo: **0** (41 antes);
  - profundidad por símbolo: M5 65.004–65.484 (desde enero de 2026); M15 65.000–65.433 (abril de 2024); H1 21.841 en todos (mayo de 2023); H4 6.997 (mayo de 2022) salvo USDJPY 2.053 (julio de 2025, hasta donde llegaba su hueco); D1 2.515–2.872 (2015–2017);
  - los pares perdidos en la pasada 2 están presentes: CADJPY M15 65.000, GBPAUD H1 21.841, GBPCAD D1 2.872.
- **Backend:** `npx vitest run src/bridge/file-watcher.test.ts src/services/candles.test.ts`: pasan 15 tests (4 nuevos del fichero de histórico completo, 2 del inicio del histórico); `npm run build` y `npm run lint` limpios. Para las pasadas en `Demo` el backend del VPS nuevo se compiló con estos fuentes copiados a mano; el deploy por pipeline es la tarea 5.
- **Límites conocidos:** un par solo es tan profundo como su tramo sin huecos (H4 de USDJPY); la primera carga de un terminal tarda alrededor de una hora y abre y cierra gráficos sola; con unos 2,4 millones de velas por broker se espera que la tabla crezca de 7,8 a unos 29 millones de filas — el tiempo de carga de un gráfico con ese volumen se mide en la tarea 5.
- **Est vs Actual:** previsto 2 (medición) + 3 (EA) + 1,5 + 2 (fichero de estado y `/health`, retirados) = 8,5 SP; real unos 6 SP para las tareas 3 y 4 tal como quedaron redefinidas.
