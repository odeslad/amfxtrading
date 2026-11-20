# 055 — Journal accounts · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: db + backend → frontend.

- [x] 1. [db] Migration adding `account_colors (broker PK, color)` and the `AccountColor` model · **Verify:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` from production shows only this table · **Est:** 0.25 SP
- [x] 2. [backend] `GET /balances` with `color`; `PATCH /balances/color` (upsert, empty clears) with tests · **Verify:** lint + typecheck + test + build · **Est:** 0.75 SP
- [x] 3. [frontend] `ColorBadge` with its own save function (positions and orders unchanged); colour badge on accounts (table and cards) · **Verify:** build + eslint; local: account colour cycles and survives a reload; position and order badges still work · **Est:** 1 SP
- [x] 4. [frontend] "Trades / Orders" per account from the live positions (desktop column, sortable; phone card in place of Number, Number in the details) · **Verify:** build + eslint; local: counts match the Positions and Orders tabs and change live · **Est:** 1 SP
- [ ] 5. [frontend] Account filters: `FiltersPanel` `fields`, Filters button on Accounts, Broker and Color, stored in `localStorage`, empty message · **Verify:** build + eslint; local: each filter, clear, active state, reload · **Est:** 1 SP
- [ ] 6. [docs] `.claude/CLAUDE.md` and `backend/docs/architecture.md`: `account_colors` and `PATCH /balances/color` · **Verify:** manual · **Est:** 0.25 SP
- [ ] 7. [infra] Push backend (tasks 1–2) alone, then frontend when the user asks; **validate on production**, desktop and phone: colours, filters, Trades / Orders, positions/orders badges unchanged · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 8. [specs] Est vs Actual in `verification.md` (both languages), close and archive under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 5 SP
