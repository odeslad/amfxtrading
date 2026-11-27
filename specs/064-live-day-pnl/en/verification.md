# 064 — Live Day P&L without polling · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |

## Task 1 — [backend] closed today in memory and in the account message
- `store/closed-today.ts`: `brokerDayStart` (the broker's midnight as UTC, the same rule as `/balances/daily-pnl`); `createClosedToday(aggregate, now, log)` with a cache per broker `{ dayStart, value }`.
  - `get` answers `null` and starts a refresh when there is no value for the current broker day yet.
  - `refresh` runs one aggregate at a time per broker; a request meanwhile runs once more afterwards. It logs `[DAYPNL] <broker> recomputed`.
- `index.ts`: `closedToday.refresh` after `syncTrades` / `syncBalanceOperations` of a history with changes. Both account sources send `closedNow()`, which is `null` while the pipe is not live.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)`. `/balances/daily-pnl` is still there (task 3).
- `closed-today.test.ts`: 6 tests ✅ (broker midnight at UTC and UTC+2; null then value with a single aggregate; recompute after a history; new broker day; one at a time + one more; brokers kept apart).
- `npm run typecheck` ✅ · eslint ✅ · `npm run build` ✅ · `npm test` 252/252 ✅.
