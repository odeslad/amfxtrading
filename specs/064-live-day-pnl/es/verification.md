# 064 — Day P&L en vivo sin consultas periódicas · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |

## Tarea 1 — [backend] cerrado hoy en memoria y en el mensaje de cuenta
- `store/closed-today.ts`: `brokerDayStart` (la medianoche del broker en UTC, la misma regla que `/balances/daily-pnl`); `createClosedToday(aggregate, now, log)` con una caché por broker `{ dayStart, value }`.
  - `get` responde `null` y lanza un recálculo cuando aún no hay valor para el día actual del broker.
  - `refresh` hace una suma a la vez por broker; una petición mientras tanto se ejecuta una vez más después. Escribe `[DAYPNL] <broker> recomputed` en el log.
- `index.ts`: `closedToday.refresh` después de `syncTrades` / `syncBalanceOperations` de un historial con cambios. Los dos orígenes del mensaje de cuenta envían `closedNow()`, que es `null` mientras el pipe no está vivo.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)`. `/balances/daily-pnl` sigue ahí (tarea 3).
- `closed-today.test.ts`: 6 tests ✅ (medianoche del broker en UTC y UTC+2; null y luego valor con una sola suma; recálculo tras un historial; nuevo día del broker; una a la vez + una más; brokers separados).
- `npm run typecheck` ✅ · eslint ✅ · `npm run build` ✅ · `npm test` 252/252 ✅.
