# 064 — Live Day P&L without polling · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend (task 1) → frontend (task 2) → backend (task 3). The EA is not touched.

- [x] 1. [backend] `store/closed-today.ts` (cache per broker and broker day, one refresh at a time, `[DAYPNL]` log), refresh after a history with changes, `closedToday` in the WS `account` message (`null` while the pipe is not live or the value is not ready); `/balances/daily-pnl` kept for now · **Verify:** vitest (first get → null then value, same day → no new aggregate, day rollover → refresh, refresh after a history, one refresh at a time) + `npm run lint/typecheck/test/build` · **Est:** 2 SP
- [x] 2. [frontend] Accounts: remove the 5 s polling; Day P&L = `closedToday + equity − balance` from each `account` message, in the table and the cards; inactive row when `closedToday` is null · **Verify:** `npm run build` + eslint; code review (no interval left, the same value reaches `AccountCard`) · **Est:** 1 SP
- [x] 3. [backend] Remove `GET /balances/daily-pnl`, and update `backend/docs/architecture.md` and `.claude/CLAUDE.md` (the `account` message, the route removed) · **Verify:** `npm run lint/typecheck/test/build`; `grep` finds no use of `daily-pnl` in `frontend/` · **Est:** 0.5 SP
- [ ] 4. [infra] Push in order: task 1 (backend alone), task 2 (frontend), task 3 (backend alone); **validate on production**: Journal › Accounts shows the same Day P&L as before and it moves together with the Profit; a trade closed today reaches the Day P&L after the next history file; an inactive broker keeps its row grey; the browser's network tab shows no repeated request; **measurement**: count the `[DAYPNL]` lines over one hour with Accounts open and record before/after in `verification.md` · **Verify:** manual (user validation + log count) · **Est:** 1 SP
- [ ] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 4.75 SP
