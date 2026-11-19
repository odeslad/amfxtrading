# 051 — Monitor del servidor en Settings · Verificación

## Tarea 1 · [db] Tabla server_samples

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde el esquema de producción (leído por el túnel SSH al XL+, sin escribir nada) al modelo nuevo.
- **Pasos:** migración `20261119000000_server_samples` (`time` timestamp PK, `cpu` real, `memUsedMb` y `memTotalMb` int, `pageFileMb` int nulo, `terminals` smallint nulo); modelo de Prisma `ServerSample`.
- **Resultado:** ✅ esquema válido, cliente generado, build limpio. El diff de producción al modelo es exactamente el `CREATE TABLE "server_samples"` de la migración, así que queda vacío cuando la migración se ejecute con el deploy del backend.
- **Est vs Actual:** 0.5 SP · 0.25 SP.
