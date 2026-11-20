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
