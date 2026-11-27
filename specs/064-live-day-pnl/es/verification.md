# 064 — Day P&L en vivo sin consultas periódicas · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |
| 2 | build + eslint + revisión de código; producción → tarea 4 🕐 | ✅ / 🕐 | 1 SP | 0.5 SP |
| 3 | lint/typecheck/test/build + grep | ✅ | 0.5 SP | 0.25 SP |

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
