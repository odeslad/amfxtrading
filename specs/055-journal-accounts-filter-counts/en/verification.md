# 055 — Journal accounts · Verification

## Task 1 · [db] Account colours table

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from production.
- **Steps:** migration `20261120200000_account_colors` (`account_colors`: `broker` primary key, `color`); model `AccountColor`.
- **Outcome:** ✅ schema valid, client generated, build green; the diff from production is exactly this table.
- **Est vs Actual:** 0.25 SP · 0.15 SP.

## Task 2 · [backend] Account colour in `/balances`

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `GET /balances` adds `color` (`''` when none) from one `accountColor.findMany`; `PATCH /balances/color` (`parseAccountColor`: non-empty broker, colour a string of at most 20 characters; empty deletes the row, else upsert); `balances.test.ts`.
- **Outcome:** ✅ 214 tests green, typecheck, build and lint clean.
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Task 3 · [frontend] Account colour badge

- **Mechanism:** `npm run build` + eslint; local check against the production API (after the backend deploy).
- **Steps:** `ColorBadge.tsx` exports `ColorSwatchButton` (the dot, `nextColor`, optimistic change, rollback and toast; a double click on it no longer reaches the row) and keeps `ColorBadge` for positions/orders on top of it; `Accounts` keeps `color` from `/balances` (also across the live `account` messages), saves with `PATCH /balances/color`, and shows the dot in the second column, beside the account name, as Positions does beside the symbol and beside the summary on the phone card. Spacing adjusted with the operator.
- **Outcome:** ✅ build and lint clean; the operator checked the colour cycle, the reload and the layout.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 4 · [frontend] Trades / Orders per account

- **Mechanism:** `npm run build` + eslint; local check against the production API.
- **Steps:** `Accounts` counts, from `useLivePositions()`, the market positions and the pending orders of each broker, skipping hidden symbols (`isVisible`); desktop column "Trades / Orders" after Number, sortable by positions, header shortened to "Tr. / Or." at the operator's request; `AccountCard` shows it in place of Number, and Number opens the expanded details.
- **Outcome:** ✅ build and lint clean; the operator checked the counts against Positions and Orders.
- **Est vs Actual:** 1 SP · 0.35 SP.
