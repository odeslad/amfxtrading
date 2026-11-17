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

## Tarea 5 — Deploy en el sistema nuevo (en curso: falta la validación del usuario)

- **Resultado:** 🕐 pendiente de validación manual del usuario en `https://amfxtrading.com` (2026-11-17). Todo lo medible desde los servidores pasa.
- **Deploys (2026-11-16):**
  - `a86b7fb` subido con los cuatro commits pendientes de la spec 043. Pipeline del EA: correcto (compilado en el VPS nuevo, repartido, 13 terminales recargados). Pipeline del frontend: correcto. Pipeline del backend: el job `check` pasó y el job `deploy` falló al subir su script ("connection reset by peer" a través del túnel de Cloudflare, con tres pipelines entrando a la vez y el VPS al 94 % de CPU); el backend se desplegó ejecutando `deploy.ps1` por SSH y el usuario relanzó después el job desde GitHub: intento 2, correcto.
  - `fad0803` (suelo de velas 500 → 100) y `d3a6b0a` (regla de huérfanas): pipeline del backend correcto al primer intento.
- **Lo que mostraron los terminales reales, y lo que cambió por ello:**
  - *La profundidad depende del broker.* `Demo` (Axi) sirve unas 65.000 velas por gráfico; Darwinex y Solidary sirven por esta vía unas 4.350 velas M5 (dos semanas), 2.175 M15, 2.300–4.600 H1. Comprobado en `darwinex` borrando sus ficheros `.hst` antiguos y con una versión de prueba con esperas de 25 s: EURUSD M5 se quedó en 4.103. El usuario acepta lo que ofrezca MT4 ("un mes o años"); los ficheros de histórico antiguos de los demás terminales no se tocaron.
  - *Los terminales antiguos arrastran una isla de histórico detrás de un hueco*, así que el tramo sin huecos es el reciente y el backend borró lo que tenía guardado detrás. Solidary y Darwinex acabaron con menos histórico M5 y M15 del que tenían por la mañana (Darwinex EURUSD M5: 27.474 → 4.350).
  - *Suelo de velas.* `solidary alvaro` y `solidary mick` conservaban la isla de 2009 en EURUSD H4 porque el tramo posterior a su hueco tenía unas 460 velas, por debajo del suelo de 500. Bajado a 100; los dos terminales reiniciados; la isla y el hueco han desaparecido.
  - *Huérfanas.* FTMO conservaba 44 velas falsas que MT4 ya no enviaba. Con la regla de huérfanas y un reinicio del terminal de FTMO: 44 históricos completos informaron `orphaned` mayor que cero y las velas falsas han desaparecido.
  - *Siete cuentas Solidary exportan solo EURUSD y USDCAD* (`bridge/config.json`); sus otros 13 símbolos en la tabla son restos de ficheros copiados del VPS antiguo (190.667 velas, 91 combinaciones de broker y símbolo). No se han tocado: el usuario no lo ha decidido.
- **Incidencias causadas durante esta tarea:** el terminal de la cuenta `solidary` se paró por error durante unos minutos (un nombre de broker con espacio partido por la línea de comandos de SSH); relanzado con el watchdog. El terminal de `darwinex` se reinició tres veces y se borraron sus ficheros `.hst` de M5/M15/H1/H4 para la prueba de arriba.
- **Estado de la base nueva (2026-11-17 05:55 UTC), símbolos que exporta cada terminal, todos los brokers salvo `solidary isa`:**
  - días con vela D1 y sin velas en otra temporalidad: **0**;
  - velas con la apertura o el cierre fuera del máximo–mínimo: **0**;
  - profundidad por símbolo: `Demo` M5 65.129–65.609, M15 65.041–65.474, H1 21.851; FTMO M5 5.615–5.627, M15 35.311–65.414, H1 21.818, H4 7.403–9.170; Darwinex M5 4.350, M15 2.175, H1 4.608; cuentas Solidary M5 4.351, M15 2.175, H1 1.831–4.608;
  - 5.359.897 velas; base de datos 914 MB (candles 889 MB).
- **Máquina (VPS nuevo):** 13 terminales, 12 brokers conectados con `tickAgeS` 0; 3,4 GB de RAM libres de 8,2; CPU en régimen medida durante 20 s: terminales 27 %, node 2 %, PostgreSQL 1 %; ya no se exporta ningún histórico completo; encendido desde la prueba de reinicio de las 16:01 UTC. Durante la primera carga con 12 terminales a la vez la CPU estuvo al 93–97 % alrededor de una hora.
- **Límite conocido que queda:** FTMO tiene un hueco de una hora y cuarto el 20 de octubre de 2026 (13:45–15:00), tal como lo tiene MT4; la comprobación por días no lo ve.
- **A validar por el usuario:** gráficos de FTMO, una cuenta Solidary y Demo en EURUSD M5, M15 y H1 — sin mechas falsas, sin días que falten, y que abran igual de rápido que antes.
