# 064 — Live Day P&L without polling · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 0.75 SP |
| 2 | build + eslint + code review; production → task 4 🕐 | ✅ / 🕐 | 1 SP | 0.5 SP |
| 3 | lint/typecheck/test/build + grep | ✅ | 0.5 SP | 0.25 SP |
| 4 | deploy in three steps + user validation + log count | ✅ | 1 SP | 1 SP |
| 5 | close and archive | ✅ | 0.25 SP | 0.25 SP |
| **Total** | | | **4.75 SP** | **3.5 SP** (+ 0.5 SP for the offset fix) |

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

## Fix found on production — the broker offset drifts (2026-11-27)
- With task 1 deployed, the log showed about 2.4 `[DAYPNL]` recomputes a second across the brokers, about as many aggregates as the old polling.
- Cause: the EA sends `TimeCurrent() − TimeGMT()`, and `TimeCurrent()` is the time of the last quote, so the offset drifts by a few seconds from tick to tick. The cache compared the broker midnight to the second, so every drift looked like a new day.
- Fix: `brokerDayStart` rounds the offset to the nearest 15 minutes (real broker offsets are whole quarters of an hour). New test: drifts of −12…+7 s give no new aggregate ✅ (7 tests). Typecheck ✅ · eslint ✅ · build ✅.
- The frontend was not deployed while this was found, so the old polling was still the one in use.

## Task 4 — deploy, validation and measurement
- Deployed in order: backend 298 (task 1), frontend 346 (task 2), backend 300 (task 3 + the offset fix). The fix had to ship after the frontend because the history is linear and a mixed push breaks the backend deploy.
- **Measurement (AC 7)**, per hour with one Accounts tab open:

| | Before | After |
|---|---|---|
| Day P&L requests | ~720 | 0 |
| Database aggregates | ~9 360 (13 per request) | 13 at startup, then one per history with changes |
| Day P&L refresh | every 5 s | every 1 s, with the Profit |

  Log evidence: 15 `[DAYPNL]` lines in the first 100 s of backend 300 and still 15 after 752 s.
- Machine CPU after the deploys: 9–28 % instant, the backend process about 1 %. The 08:00–08:15 peak (avg 26–27 %, max 49 %) matches the three builds on the VPS, not this change.
- User validation on 2026-11-27: Accounts shows the same Day P&L, it moves with the Profit, and nothing is polled ✅.

## Task 5 — close
- `npm run build` backend ✅ and frontend ✅ before closing.
- Calibration: the code was faster than estimated (3.5 vs 4.75 SP). The offset drift, which no test could show, came out only on production: a cache keyed on a value sent by the EA needs that value checked live before it ships.
