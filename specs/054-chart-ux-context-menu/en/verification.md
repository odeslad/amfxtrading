# 054 — Chart UX · Verification

## Task 1 · [db] Quick orders column

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from production.
- **Steps:** migration `20261120100000_quick_orders` adds `settings_display."quickOrders" JSONB` (nullable); `quickOrders Json?` in `SettingsDisplay`.
- **Outcome:** ✅ schema valid, client generated, build green; the diff from production is exactly this column.
- **Est vs Actual:** 0.5 SP · 0.2 SP.

## Task 2 · [backend] Quick orders in `/settings`

- **Mechanism:** lint + typecheck + test + build.
- **Steps:** `routes/quick-orders.ts` (`parseQuickOrders`: undefined keeps, null clears; size > 0, SL/TP > 0, tpMode and tp together, R and risk % need an SL; `readQuickOrders`: a deleted preset reads as none, a broken value as not configured); `/settings` reads and writes `display.quickOrders` and rejects a preset that does not exist; `quick-orders.test.ts`.
- **Outcome:** ✅ 212 tests green, typecheck, build and lint clean.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 3 · [frontend] Quick market / orders settings

- **Mechanism:** `npm run build` + eslint; local check (Vite 5174 against the production API).
- **Steps:** `lib/quickOrders.ts` (type, default, `quickOrdersError` with the backend rules); `QuickOrdersSection` at the end of Settings › Mirror ("Quick market / orders": size Lots / Risk %, SL pips, TP pips / R, mirror preset, Set up / Clear), saved with the display settings; Save refuses an invalid configuration with a toast. Agreed during the check: the size is disabled when a preset is chosen (each preset broker uses its own size), and the title and hint say market vs pending. `useQuickOrders` (read from the chart) moved to task 8, where it is used.
- **Outcome:** ✅ build and lint clean; the operator checked the section.
- **Est vs Actual:** 1.5 SP · 0.75 SP.
