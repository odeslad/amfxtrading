# 051 — Monitor del servidor en Settings · Verificación

## Tarea 1 · [db] Tabla server_samples

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde el esquema de producción (leído por el túnel SSH al XL+, sin escribir nada) al modelo nuevo.
- **Pasos:** migración `20261119000000_server_samples` (`time` timestamp PK, `cpu` real, `memUsedMb` y `memTotalMb` int, `pageFileMb` int nulo, `terminals` smallint nulo); modelo de Prisma `ServerSample`.
- **Resultado:** ✅ esquema válido, cliente generado, build limpio. El diff de producción al modelo es exactamente el `CREATE TABLE "server_samples"` de la migración, así que queda vacío cuando la migración se ejecute con el deploy del backend.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 2 · [backend] Script de la sonda y servicio del monitor

- **Mecanismo:** vitest + lint + typecheck + build; la sonda ejecutada a mano en el XL+.
- **Pasos:** `backend/scripts/server-probe.ps1` (solo lectura; brokers relacionados con terminales como en `startup.ps1`; evento 41 de 30 días → `bugcheck` con código y primer parámetro, o `unexpected` si el código es 0; número de reinicios de pm2 sacado de `pm2 jlist` con una expresión regular, porque `ConvertFrom-Json` de PowerShell 5.1 rechaza el entorno de pm2, que tiene `Path` y `PATH`). `src/services/server-monitor.ts`: % de CPU por diferencias de `os.cpus()` y memoria cada 15 s, sonda cada 60 s, eventos y reinicios cada 10 min, una fila por minuto con la CPU media de sus muestras rápidas, limpieza de filas de más de 7 días al arrancar y cada día; una sonda que falla o devuelve algo inesperado mantiene los datos anteriores. Arrancado en `index.ts` detrás de `FEATURE_SERVER_MONITOR` (en `.env.example`); añadido `config.brokersFile`.
- **Sonda en el XL+ (19-nov-2026):** ejecución normal 548 ms, con `-Events` 1 181–1 248 ms (menos de los 2 s de la tarea), salida 0, JSON válido: equipo, sistema, último arranque 10:31:59 UTC, fichero de paginación 1 064 MB, C: 448,9 de 479,4 GB libres, los 4 servicios `running`, los 13 brokers con su terminal en marcha y 23–32 MB cada uno, 0 eventos (el XL+ no se ha colgado; su único reinicio fue la prueba limpia), `backendRestarts` 1.
- **Tests:** 14 nuevos en `server-monitor.test.ts` (% de CPU sobre todos los núcleos, nada si no pasó tiempo, media, lectura de la sonda incluidas las listas de un solo objeto de PowerShell y salidas ajenas, fila por minuto con CPU media y datos de la sonda, ninguna fila antes de la primera lectura, sonda anterior conservada si falla, eventos solo de una ejecución con eventos, corte de limpieza de 7 días, error de base de datos superado). Suite completa 180 tests en verde; lint, typecheck y build limpios.
- **Resultado:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.

## Tarea 3 · [backend] Rutas /server

- **Mecanismo:** vitest sobre un servidor Express de usar y tirar con `requireAuth` y una cookie JWT real + lint + typecheck + build; la consulta de 7 días ejecutada en el PostgreSQL 17 de producción por el túnel SSH con filas en línea (sin escribir nada).
- **Pasos:** `src/routes/server.ts`, montado en `app.ts` como `/server` detrás de `requireAuth`. `GET /server` une la foto del monitor con cada broker de `brokers.json` (terminal en marcha y memoria de la sonda, pipe y antigüedad del tick de `store/liveness`); `lastBootAfterCrash` cuando hay un evento 41 entre 1 min antes y 15 min después del último arranque; `staleS` = antigüedad de la última sonda; `503` con el monitor apagado. `GET /server/history?range=24h|7d`: 24h las filas por minuto, 7d medias con `date_bin('10 minutes')` en SQL; otro rango `400`.
- **Comprobación SQL:** tres filas en línea a las 12:01, 12:07 y 12:12 → tramos 12:00 (CPU 15, memoria 3 050, fichero de paginación 900 — el nulo ignorado) y 12:10 (30, 3 200, 950).
- **Tests:** 9 nuevos en `server.test.ts` (lectura del rango, ventana de arranque tras cuelgue, 401 sin sesión en las dos rutas, 503 con el monitor apagado, el informe unido, el informe antes de la primera sonda, filas de 24h y su corte, consulta de tramos de 7d, 400 para otro rango). Una primera ejecución falló en la suite completa por una antigüedad de tick exacta (la suite va más lenta que el fichero solo); la comprobación usa ahora un límite. Suite completa 189 tests en verde; lint, typecheck y build limpios.
- **Resultado:** ✅
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Deploy del backend (parte de la tarea 7, adelantado para que se acumule historial)

- **19-nov-2026:** commits `8b2a10c`…`c7b9d05` subidos solos (solo `backend/` y `specs/`); pipeline del backend en verde. En el XL+: migración `20261119000000_server_samples` aplicada; una fila por minuto desde las 13:46:40 UTC (memoria total 16 374 MB, 13 terminales); sin errores `[MONITOR]` en el log de pm2.
- **Comprobación de CPU:** el monitor marcaba 27–29 % donde el contador de Windows de la mañana había dado 13 %. Medidos a la vez: `% Processor Time` de Windows 31,9 % y `% Processor Utility` 32,2 % en 30 s, filas del monitor 26,4–27,6 % — el monitor acierta; los 13 terminales habían pasado del 11,6 % al 22 % (horario de mercado), el backend con el monitor 0,8 %.
- **Lección para la comprobación local:** un backend local con el monitor encendido escribe las muestras de su propio PC en la tabla de producción por el túnel de la BD. Se paró dentro del primer minuto; todas las filas desde el deploy tienen los 16 374 MB del XL+ y el ritmo exacto de 60 s, así que ninguna vino del PC. Las comprobaciones locales de la pestaña usan Vite con proxy al API de producción (`DEV_API_TARGET=https://api.amfxtrading.com`).

## Tarea 4 · [frontend] Pestaña Server

- **Mecanismo:** `npm run build` + eslint; comprobación local en `https://local.amfxtrading.com:5174` con Vite y proxy al API de producción (datos reales del XL+, sin escribir nada).
- **Pasos:** `src/lib/useServerStatus.ts` (pide `/server` cada 15 s y el historial cada minuto mientras la pestaña está abierta; mantiene el último informe si una consulta falla; historial asociado a su rango). `src/features/settings/ServerTab.tsx` + `.module.css`: cabecera de la máquina con punto de estado y marca de cuelgue, cuatro indicadores (verde < 70 %, dorado < 90 %, rojo), servicios y backend, terminales con los problemas primero (parados, en marcha sin ticks recientes, sanos, sin ticks), tabla en escritorio y tarjetas a ≤ 768 px, lista de cuelgues, secciones plegables recordadas en `localStorage` (`amfx.server.collapsed`), estados de carga y de datos antiguos. Pestaña `Server` en `SettingsPage`. Las reglas de lint de React prohíben `Date.now()` en el render y un `setState` síncrono en un efecto: el hook expone la hora de la última consulta y asocia el historial a su rango.
- **Comprobación del operador (19-nov-2026):** `WIN-5SSFL41HHDI`, Windows Server 2025, 8 núcleos, 16 GB; último arranque 19 nov 11:31 hora local, encendido 3 h 31 m; CPU 28,1 %, memoria 3,1 / 16 GB, fichero de paginación 1,0 GB, disco 449 / 479 GB; servicios 4 / 4; backend 17 m, 183 MB, 0 reinicios (el contador de pm2 vuelve a cero con cada deploy, que borra y vuelve a crear el proceso); terminales 13 / 13, 12 conectadas a 0 s y `solidary isa` al final en gris como «no ticks»; cuelgues «None in the last 30 days».
- **Resultado:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.

## Tarea 5 · [frontend] Gráficas

- **Mecanismo:** `npm run build` + eslint; comprobación local con Vite y proxy al API de producción.
- **Pasos:** `ServerCharts.tsx` + `.module.css` con `lightweight-charts` (ya era dependencia): % de CPU en la escala izquierda (0–100), memoria y fichero de paginación en GB a la derecha, horas locales; un tramo sin datos de más de 2,5 muestras se convierte en un punto vacío, así que la línea se corta en vez de unirse; los cuelgues y apagados inesperados de la lista de eventos se dibujan sobre la gráfica como una capa HTML colocada con `timeToCoordinate` (línea roja o ámbar donde terminan las muestras, hueco rayado hasta la primera muestra posterior, línea verde discontinua en el arranque, etiqueta con tipo, código, hora y minutos caído), recolocada al cambiar de tamaño; selector 24H / 7D; estados de carga y «No samples yet». Es la primera sección plegable de la pestaña. Añadido a petición del operador: un tirador bajo la gráfica cambia su altura (140–600 px, también con las flechas del teclado), recordada por dispositivo.
- **Comprobación del operador (19-nov-2026):** gráfica con CPU, memoria y fichero de paginación desde el deploy del backend a las 14:46 hora local; el tirador funciona.
- **Pendiente de ver:** un hueco real y una marca de cuelgue — el historial no tiene huecos desde el deploy y el XL+ no se ha colgado. El hueco se comprueba en la tarea 7 tras el próximo reinicio del backend; una marca de cuelgue solo se verá si ocurre uno.
- **Resultado:** ✅ (hueco pendiente en la tarea 7)
- **Est vs Actual:** 2 SP · 1 SP.
