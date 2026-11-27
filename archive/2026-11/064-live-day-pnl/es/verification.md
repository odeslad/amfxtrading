# 064 — Day P&L en vivo sin consultas periódicas · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |
| 2 | build + eslint + revisión de código; producción → tarea 4 🕐 | ✅ / 🕐 | 1 SP | 0.5 SP |
| 3 | lint/typecheck/test/build + grep | ✅ | 0.5 SP | 0.25 SP |
| 4 | despliegue en tres pasos + validación del usuario + recuento del log | ✅ | 1 SP | 1 SP |
| 5 | cierre y archivo | ✅ | 0.25 SP | 0.25 SP |
| **Total** | | | **4.75 SP** | **3.5 SP** (+ 0.5 SP del arreglo del desfase) |

## Tarea 1 — [backend] cerrado hoy en memoria y en el mensaje de cuenta
- `store/closed-today.ts`: `brokerDayStart` (la medianoche del broker en UTC, la misma regla que `/balances/daily-pnl`); `createClosedToday(aggregate, now, log)` con una caché por broker `{ dayStart, value }`.
  - `get` responde `null` y lanza un recálculo cuando aún no hay valor para el día actual del broker.
  - `refresh` hace una suma a la vez por broker; una petición mientras tanto se ejecuta una vez más después. Escribe `[DAYPNL] <broker> recomputed` en el log.
- `index.ts`: `closedToday.refresh` después de `syncTrades` / `syncBalanceOperations` de un historial con cambios. Los dos orígenes del mensaje de cuenta envían `closedNow()`, que es `null` mientras el pipe no está vivo.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)`. `/balances/daily-pnl` sigue ahí (tarea 3).
- `closed-today.test.ts`: 6 tests ✅ (medianoche del broker en UTC y UTC+2; null y luego valor con una sola suma; recálculo tras un historial; nuevo día del broker; una a la vez + una más; brokers separados).
- `npm run typecheck` ✅ · eslint ✅ · `npm run build` ✅ · `npm test` 252/252 ✅.

## Tarea 2 — [frontend] Accounts sin consultas periódicas
- `Accounts.tsx`: se eliminan el efecto que consultaba cada 5 s, su gestión de visibilidad y `DAY_PNL_POLL_MS`. El manejador WS de `account` guarda `closedToday` por broker; `dayPnl` es un `useMemo` de `closedToday + equity − balance` sobre los balances en vivo, así que cambia en el mismo render que el Profit.
- Revisión de código: no queda ningún `setInterval` ni `daily-pnl` en el archivo; la fila inactiva sigue dependiendo de `dayPnl == null`; `AccountCard` (móvil) recibe el mismo `dayPnl[b.broker]` que antes.
- `npm run build` ✅ · eslint ✅.
- 🕐 La prueba en producción (la misma cifra que antes, moviéndose con el Profit, sin peticiones repetidas) es la tarea 4.

## Tarea 3 — [backend] ruta eliminada, documentación
- `routes/balances.ts`: se elimina `GET /balances/daily-pnl`, junto con los imports que solo usaba ella (`getAllPositions`, `isPipeLive`, `pipeStateOf`).
- `backend/docs/architecture.md`: la fila de `/balances` y el mensaje WS `account` (`closedToday` y cómo se mantiene). `.claude/CLAUDE.md`: el mensaje `account` en la lista del WebSocket.
- `grep -rn daily-pnl frontend/src backend/src`: nada ✅. Typecheck ✅ · eslint ✅ · build ✅ · `npm test` 251/252: el fallo intermitente conocido de `pipe-reader`, que en CI se salta.
- Se despliega después de la tarea 2, para que ningún frontend siga llamando a la ruta.

## Arreglo encontrado en producción — el desfase del broker varía (2026-11-27)
- Con la tarea 1 desplegada, el log mostraba unos 2,4 recálculos `[DAYPNL]` por segundo entre todos los brokers, más o menos tantas sumas como la consulta periódica antigua.
- Causa: el EA envía `TimeCurrent() − TimeGMT()`, y `TimeCurrent()` es la hora del último precio, así que el desfase varía unos segundos de un tick a otro. La caché comparaba la medianoche del broker al segundo, así que cada variación parecía un día nuevo.
- Arreglo: `brokerDayStart` redondea el desfase al cuarto de hora más cercano (los desfases reales de los brokers son cuartos de hora exactos). Test nuevo: variaciones de −12…+7 s no lanzan ninguna suma nueva ✅ (7 tests). Typecheck ✅ · eslint ✅ · build ✅.
- El frontend no estaba desplegado cuando se encontró, así que seguía en uso la consulta periódica antigua.

## Tarea 4 — despliegue, validación y medición
- Desplegado en orden: backend 298 (tarea 1), frontend 346 (tarea 2), backend 300 (tarea 3 + el arreglo del desfase). El arreglo tuvo que salir después del frontend porque el historial es lineal y un push mixto rompe el deploy del backend.
- **Medición (AC 7)**, por hora con una pestaña de Accounts abierta:

| | Antes | Después |
|---|---|---|
| Peticiones del Day P&L | ~720 | 0 |
| Sumas en la base de datos | ~9 360 (13 por petición) | 13 al arrancar, y luego una por historial con cambios |
| Refresco del Day P&L | cada 5 s | cada 1 s, con el Profit |

  Evidencia en el log: 15 líneas `[DAYPNL]` en los primeros 100 s del backend 300 y seguían siendo 15 a los 752 s.
- CPU de la máquina tras los despliegues: 9–28 % instantánea, el proceso del backend alrededor del 1 %. El pico de 08:00–08:15 (media 26–27 %, máximo 49 %) coincide con las tres compilaciones en el VPS, no con este cambio.
- Validación del usuario el 2026-11-27: Accounts muestra el mismo Day P&L, se mueve con el Profit y no hay consultas periódicas ✅.

## Tarea 5 — cierre
- `npm run build` backend ✅ y frontend ✅ antes de cerrar.
- Calibración: el código fue más rápido de lo estimado (3,5 frente a 4,75 SP). La variación del desfase, que ningún test podía mostrar, solo salió en producción: una caché basada en un valor que envía el EA necesita comprobar ese valor en vivo antes de salir.
