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
