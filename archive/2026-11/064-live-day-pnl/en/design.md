# 064 — Live Day P&L without polling · Design

> Status: **approved**

## Approach

Split the Day P&L into its two parts where each one already lives:

- **Closed today**: changes only when a trade closes. The backend keeps it in memory per broker, recomputes it once per change and sends it inside the `account` WebSocket message.
- **Floating**: `equity − balance` of the `account` message, which already arrives every second and moves the Profit column. It includes swap and commission, like today's sum over the open positions.

The frontend adds the two when each `account` message arrives. Nothing polls any more.

### Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| **A. Closed today cached in the backend, sent in `account`; floating = equity − balance (chosen)** | No polling, almost no database work, the Day P&L moves with the Profit, no new message type | The `account` message gains one field |
| B. Keep the polling, cache the aggregate in the backend | One small backend change | Still about 720 requests an hour per tab; the Day P&L still moves every 5 s |
| C. Frontend sums the open positions from the `positions` feed | Same figure as today's floating part | The live positions feed only runs on the Journal page; equity − balance is already in the message and is the broker's own figure |

## Data flow

```
watcher: history.json with changes → syncTrades → closedToday.refresh(broker)   (1 aggregate)
broker day rollover (checked when an account message is sent) → closedToday.refresh(broker)
startup → the first account message of each broker triggers its refresh
pipe / watcher account → wss.broadcastAccount(broker, account)
   → { type: "account", broker, account, closedToday: number | null }   (null while the pipe is not live or the value is not ready)
Accounts → dayPnl[broker] = closedToday == null ? undefined : closedToday + equity − balance
```

## Per-layer changes

### [backend]
- `store/closed-today.ts` (new): `createClosedToday(aggregate, now)` with a per-broker cache `{ dayStart, value }`.
  - `get(broker, brokerOffset)` returns the cached value for the current broker day. With no value yet or a new day, it starts a refresh: one at a time per broker, and the value is `null` until it lands.
  - `refresh(broker, brokerOffset)` runs the same aggregate as `/balances/daily-pnl` today (profit + swap + commission of the trades with `closeTime` ≥ the broker's midnight). It logs `[DAYPNL] <broker> recomputed` for the measurement.
  - The day boundary is the same code as today, moved here: `brokerOffset`, `setUTCHours(0,0,0,0)`.
- `index.ts`:
  - `watcher.onHistory` calls `closedToday.refresh(broker, brokerOffset)` after `syncTrades` (AC 3);
  - both account sources go through `broadcastAccount`, as today.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)` adds `closedToday` at the root, `null` when `isPipeLive` is false (AC 6), whichever source sent the message.
- `routes/balances.ts`: `GET /balances/daily-pnl` is removed once the frontend no longer uses it (task 3; it has no other consumer).

### [frontend]
- `Accounts.tsx`: the polling effect and its visibility handling are removed (AC 1). The `account` WS handler stores `closedToday` per broker; `dayPnl` is derived from it as `closedToday + equity − balance` (AC 2). The inactive row stays driven by `dayPnl == null` (AC 6). `AccountCard` (mobile) receives the same value.

No new dependencies. No visual change, so no mockup: the table and the cards look exactly as today.

## Contract
- EA ↔ backend: unchanged.
- WS `account`: gains `closedToday` (a number or `null`); its other fields are unchanged.
- HTTP: `GET /balances/daily-pnl` disappears (only Accounts used it).

## Measurement (AC 7)
- **Before**, from the code and the logs: one Accounts tab means 720 requests an hour, each with one aggregate per live broker (13) = about 9 360 aggregates an hour.
- **After**: count the `[DAYPNL]` lines in the pm2 log over one hour with an Accounts tab open, and confirm in the browser's network tab that no request repeats.

## Files to touch
- backend: `src/store/closed-today.ts` (+ test), `src/index.ts`, `src/ws/ws.ts`, `src/routes/balances.ts`
- frontend: `src/features/journal/Accounts.tsx`
- docs: `backend/docs/architecture.md` and `.claude/CLAUDE.md` (the `account` message, the route removed)

## Risks
- **Order of the deploys:** the backend first adds `closedToday` and keeps the old route, so the current frontend keeps working. The frontend switches over next, and only then is the route removed (task 3).
- **A trade closed between two history files:** the closed part waits for the next history, as today (out of scope).
- **The equity of a broker whose EA stops:** its pipe is no longer live, so `closedToday` is `null` and the row goes inactive, as today.
