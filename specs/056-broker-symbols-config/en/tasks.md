# 056 — Broker symbols from the frontend · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend → EA → frontend (the EA changes are backwards compatible; the frontend needs both).

- [x] 1. [backend] `services/broker-symbols.ts` (read `symbols-available.json` filtered to the crosses of AUD, EUR, NZD, USD, CAD, GBP, JPY; read `config.json`; write only `symbols` via `.tmp` + rename) with tests on a temporary folder · **Verify:** lint + typecheck + test + build · **Est:** 1.5 SP
- [x] 2. [backend] `GET /broker-symbols` and `PUT /broker-symbols/:broker` (validation, 409 for symbols with open positions/orders, WS `broker_symbols`) with tests · **Verify:** lint + typecheck + test + build · **Est:** 1.5 SP
- [x] 3. [backend] Candle sync of some symbols: `symbols` in the sync request and `sync-command.json`, wait for the first tick, `sync-watcher` replaces only those symbols; triggered by `PUT` for newly turned-on pairs · **Verify:** lint + typecheck + test + build · **Est:** 2 SP
- [x] 4. [backend] Rollout of `hiddenSymbols` at start (remove from `config.json` except symbols with positions, clear the field, log); `/settings` ignores incoming `hiddenSymbols` · **Verify:** lint + typecheck + test + build · **Est:** 1 SP
- [x] 5. [ea] `HttpBridgeState`: write `symbols-available.json` at start and when the count changes; both EAs: reload `config.json` when its modification time changes (5 s), `SymbolSelect` new symbols; `HttpBridgeCommands`: honour `symbols` in `sync-command.json` · **Verify:** compiled by the EA pipeline; manual check on one terminal (file written, a config change applied without restart, a one-symbol sync) · **Est:** 3 SP
- [x] 6. [frontend] `lib/visibility.ts` with `activeSymbols` (from `GET /broker-symbols` and WS) replacing `hiddenSymbols` in `isSymbolVisible` · **Verify:** build + eslint; local: lists follow the active pairs · **Est:** 1 SP
- [x] 7. [frontend] Settings › Visibility: on/off counts per broker, pairs panel (3 columns, locked pairs, All on / All off, Save to EA, errors, phone sheet) · **Verify:** build + eslint; local against production (no save until task 9) · **Est:** 2 SP
- [ ] 8. [docs] `.claude/CLAUDE.md`, `backend/docs/architecture.md`, `ea/docs/deploy.md` (config.json now managed from Settings; new bridge files) · **Verify:** manual · **Est:** 0.5 SP
- [ ] 9. [infra] Push backend (tasks 1–4) alone and check the rollout log; push the EA (task 5) and let the pipeline reload the terminals; push the frontend when the user asks; **validate on production**: every broker lists its pairs; a pair turned on starts streaming without restart and its history syncs; a pair turned off disappears; a pair with positions cannot be turned off; the previously hidden symbols stay hidden; hiding a broker still works · **Verify:** manual (user validation) · **Est:** 1.5 SP
- [ ] 10. [specs] Est vs Actual in `verification.md` (both languages), close and archive under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 14.25 SP
