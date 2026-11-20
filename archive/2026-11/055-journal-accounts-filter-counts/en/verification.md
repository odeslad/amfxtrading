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

## Task 5 · [frontend] Account filters

- **Mechanism:** `npm run build` + eslint; local check against the production API.
- **Steps:** `FiltersPanel` takes `fields` (default unchanged) and a `name` text field; `JournalPage` shows the Filters button on every tab, keeps `journal.accountFilters` (`broker`, `name`, `color`) in `localStorage` and opens the same panel for Accounts with Broker, Name and Color; `Accounts` filters (broker exact, name contains, case-insensitive; colour exact), reports the broker and colour options, and says "No accounts match the filters". Agreed with the operator: Name added to the panel, as a text field that matches as you type.
- **Outcome:** ✅ build and lint clean; the operator checked the filters.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 6 · [docs] Architecture docs

- **Mechanism:** manual review of the diff.
- **Steps:** `backend/docs/architecture.md` (`/balances` with `PATCH /color`, `account_colors` table); `.claude/CLAUDE.md` (`AccountColor` model).
- **Outcome:** ✅ both documents agree.
- **Est vs Actual:** 0.25 SP · 0.1 SP.

## Changes agreed during the production check (task 7)

- Phone cards: same columns on every card, long broker names wrap inside their column, card never wider than the screen, tighter left padding (`f597e51`).
- Name filter: text field without the select arrow (`38aa1cc`).
- AC 10: multi-colour filter on Accounts, Positions and Orders (`ColorFilterField`, `utils/colorFilter.ts`; the filter keeps its string shape as "orange,blue", so stored filters still work).

## Task 7 · [infra] Deploy and production validation

- **Pushes (2026-11-20):** backend + db `cb306dd` + `ae57ab7` (tasks 1–2); frontend `139b009`…`aeadb4b` (tasks 3–5); then, at the operator's request, docs `7a207c3` with the fixes `f597e51` and `38aa1cc` in one push (both pipelines), and `777bde4` (multi-colour filter) alone.
- **Operator validation on `amfxtrading.com`, desktop and phone:** account colours, Broker / Name / multi-colour filters, Tr. / Or. against Positions and Orders, aligned phone cards, positions and orders badges and filters.
- **Outcome:** ✅ AC 1–10.
- **Est vs Actual:** 0.5 SP · 0.75 SP (the phone card fixes and the multi-colour filter were added during the check).

## Task 8 · [specs] Close

- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Est vs Actual

| Task | Est | Actual |
|---|---|---|
| 1 | 0.25 | 0.15 |
| 2 | 0.75 | 0.25 |
| 3 | 1 | 0.5 |
| 4 | 1 | 0.35 |
| 5 | 1 | 0.5 |
| 6 | 0.25 | 0.1 |
| 7 | 0.5 | 0.75 |
| 8 | 0.25 | 0.25 |
| **Total** | **5** | **2.85** |

Calibration: small frontend tasks on existing components ran at about half the estimate; the validation took longer than planned because the layout was tuned on the phone with the operator.
