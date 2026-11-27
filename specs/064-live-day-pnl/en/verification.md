# 064 — Live Day P&L without polling · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |
| 2 | build + eslint + code review; production → task 4 🕐 | ✅ / 🕐 | 1 SP | 0.5 SP |
| 3 | lint/typecheck/test/build + grep | ✅ | 0.5 SP | 0.25 SP |

## Task 1 — [backend] closed today in memory and in the account message
- `store/closed-today.ts`: `brokerDayStart` (the broker's midnight as UTC, the same rule as `/balances/daily-pnl`); `createClosedToday(aggregate, now, log)` with a cache per broker `{ dayStart, value }`.
  - `get` answers `null` and starts a refresh when there is no value for the current broker day yet.
  - `refresh` runs one aggregate at a time per broker; a request meanwhile runs once more afterwards. It logs `[DAYPNL] <broker> recomputed`.
- `index.ts`: `closedToday.refresh` after `syncTrades` / `syncBalanceOperations` of a history with changes. Both account sources send `closedNow()`, which is `null` while the pipe is not live.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)`. `/balances/daily-pnl` is still there (task 3).
- `closed-today.test.ts`: 6 tests ✅ (broker midnight at UTC and UTC+2; null then value with a single aggregate; recompute after a history; new broker day; one at a time + one more; brokers kept apart).
- `npm run typecheck` ✅ · eslint ✅ · `npm run build` ✅ · `npm test` 252/252 ✅.

## Task 2 — [frontend] Accounts without polling
- `Accounts.tsx`: the 5 s polling effect, its visibility handling and `DAY_PNL_POLL_MS` are removed. The `account` WS handler stores `closedToday` per broker; `dayPnl` is a `useMemo` of `closedToday + equity − balance` over the live balances, so it changes in the same render as the Profit.
- Code review: no `setInterval` and no `daily-pnl` left in the file; the inactive row still depends on `dayPnl == null`; `AccountCard` (mobile) gets the same `dayPnl[b.broker]` as before.
- `npm run build` ✅ · eslint ✅.
- 🕐 The check on production (the same figure as before, moving with the Profit, no repeated request) is task 4.

## Task 3 — [backend] route removed, docs
- `routes/balances.ts`: `GET /balances/daily-pnl` removed, together with the imports only it used (`getAllPositions`, `isPipeLive`, `pipeStateOf`).
- `backend/docs/architecture.md`: the `/balances` row and the `account` WS message (`closedToday`, how it is kept). `.claude/CLAUDE.md`: the `account` message in the WebSocket list.
- `grep -rn daily-pnl frontend/src backend/src`: nothing ✅. Typecheck ✅ · eslint ✅ · build ✅ · `npm test` 251/252: the known `pipe-reader` timing flake, skipped in CI.
- Deploy after task 2, so no frontend still calls the route.
