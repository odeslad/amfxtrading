# 056 — Broker symbols from the frontend · Design

## Approach
The bridge folder of each broker (`brokers.json` → `bridgePath`) is already shared by the EA and the backend, so everything goes through files there: the EA writes the broker's symbol list, the backend reads it and reads/writes `config.json`, and the EA re-reads `config.json` when it changes. The frontend's "hidden symbols" becomes "symbols not in `config.json`", so there is a single setting. No new table.

## ea (both EAs; EA contract change, backwards compatible)
- **Available symbols:** `HttpBridgeState` writes `bridge/symbols-available.json` `{ "symbols": [...] }` with `SymbolsTotal(false)` / `SymbolName(i, false)` at start and whenever that count changes (checked every 60 s, with the state writes).
- **Live config:** both EAs keep the `config.json` modification time; every 5 s they compare it and, when it changed, re-run `LoadConfig()` + `ParseSymbols()`. `HttpBridgeState` calls `SymbolSelect(sym, true)` for each symbol so it is in Market Watch and ticks; the next tick batch and candle writes use the new list. `brokerName` is re-read but the pipe is not reopened (the backend never changes it).
- **Sync of some symbols:** `sync-command.json` gains an optional `symbols` array; when present, `HttpBridgeCommands` syncs only those symbols (the rest of the flow is spec 049's).
- An older backend ignores the new file and field; an older EA ignores the new field (it would sync every symbol), so the EA ships after the backend.

## backend
- `services/broker-symbols.ts`: per broker, `available()` (reads `symbols-available.json`, `null` when missing), `configured()` (reads `config.json`'s `symbols`), `write(symbols)` (reads the file, replaces only `symbols`, writes `config.json.tmp` + rename, like `command.json`; throws a clear error when the folder or file cannot be written).
- Routes (`routes/broker-symbols.ts`, under `requireAuth`):
  - `GET /broker-symbols` → `[{ broker, available: string[] | null, active: string[] }]`, where `available` keeps only the crosses of AUD, EUR, NZD, USD, CAD, GBP and JPY (the first six letters, any broker suffix kept) for every broker in `brokers.json`.
  - `PUT /broker-symbols/:broker { symbols }` → validates the broker, that every symbol is in `available` (when known), and that no symbol being turned off has open positions or pending orders (`store/positions`; `409` with the symbols); writes `config.json`; then queues a candle sync of the newly turned-on symbols (below); broadcasts `broker_symbols` over WS; returns the new state.
- **Sync of new symbols:** `routes/candle-sync.ts`' sync entry takes an optional `symbols`; the request waits until the EA streams the symbol (first tick seen, at most 2 min) and then writes `sync-command.json` with every Data timeframe at its configured target and `symbols`. `sync-watcher.ts` replaces only those symbols in its transaction (`deleteMany({ broker, timeframe, symbol: { in } })`) when the command had them. Progress goes through the existing `candle_sync` WS message.
- **Rollout of hidden symbols (AC 7):** at backend start, if `settings_display.hiddenSymbols` is not empty, for each broker the hidden symbols are removed from its `config.json` (skipping symbols with open positions, which stay on) and `hiddenSymbols` is cleared. Idempotent; logged.
- `/settings` keeps accepting `visibility.hiddenSymbols` but ignores it (old clients); `hiddenBrokers` unchanged.

## db
No schema change; `hiddenSymbols` becomes unused (dropped in a later spec once the rollout has run, like `chart_indicators`).

## frontend
- `lib/visibility.ts`: `Visibility` gains `activeSymbols: Record<string, string[]>` from `GET /broker-symbols` (and the `broker_symbols` WS message); `isSymbolVisible` = broker visible and (no list for that broker yet, or the symbol is in it). Every place that already filters with it (chart lists, journal, alerts, notifications…) follows without changes.
- Settings › Visibility: the table's Symbols column shows "N on · M off" (or "list pending" when the EA has not reported); the existing `SymbolsPanel` lists those pairs (at most 21) in alphabetical order on a 3-column grid, each on or off, All on / All off, symbols with open positions locked on (with the reason), and **Save to EA** (`PUT /broker-symbols/:broker`); errors as in the mockup. The broker on/off toggle stays.

## Data flow
EA → `symbols-available.json` → backend → `GET /broker-symbols` → Settings. Save → `PUT` → `config.json` → EA (5 s) → new ticks → backend sees the first tick → `sync-command.json { symbols }` → EA → sync files → candles of that symbol replaced → `candle_sync` WS.

## Alternatives
- Keep three states (on / hidden / off): rejected by the operator; one setting.
- Store the symbol lists in the DB and push them to the EA: duplicates `config.json`, which the EA must read anyway.
- Restart the terminal after each change: no EA change, but a restart drops the pipe and orders for a minute; rejected.

## Risks
- Writing `config.json` while the EA reads it: write to `.tmp` + rename (atomic on NTFS); the EA reads the whole file and keeps the old config if parsing fails.
- A broker with dozens of symbols on adds pipe and file load; the panel shows the count, and the operator decides.
- The rollout edits live EA configs once; it skips symbols with open positions and logs every change.

## Mockup
https://claude.ai/artifact/2n7KMYqaWDh9TytC7iiejw — artboards: Settings › Visibility (brokers with on/off counts, list pending); Symbols panel (on/off chips, locked symbols, Save to EA); Save failed; Phone sheet.
