# 054 — Chart UX · Verification

## Task 1 · [db] Quick orders column

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from production.
- **Steps:** migration `20261120100000_quick_orders` adds `settings_display."quickOrders" JSONB` (nullable); `quickOrders Json?` in `SettingsDisplay`.
- **Outcome:** ✅ schema valid, client generated, build green; the diff from production is exactly this column.
- **Est vs Actual:** 0.5 SP · 0.2 SP.
