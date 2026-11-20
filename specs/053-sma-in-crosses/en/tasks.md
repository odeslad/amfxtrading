# 053 — SMA in crosses · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: db + backend → frontend.

- [x] 1. [db] Migration adding `fastType`/`slowType` to `ema_cross_alerts` and `ema_notifications`, and `emaTradesFastType`/`emaTradesSlowType` to `settings_display` (default `'ema'`) · **Verify:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` from production shows only these columns · **Est:** 0.5 SP
- [x] 2. [backend] `calculateSma` + `calculateMa` with tests (same series as the chart) · **Verify:** vitest · **Est:** 0.5 SP
- [x] 3. [backend] `ema-cross.ts` and `/setup-levels` with the types (optional, default ema) · **Verify:** vitest + build · **Est:** 0.75 SP
- [x] 4. [backend] Alerts and notifications: routes validate the types, evaluators use `calculateMa`, push texts with the labels · **Verify:** lint + typecheck + test · **Est:** 1.5 SP
- [x] 5. [backend] `/settings` overlay type fields · **Verify:** lint + typecheck + test · **Est:** 0.25 SP
- [x] 6. [frontend] `MaTypeToggle` + types in `useEmaAlerts` and `AlertsPanel` (desktop and mobile) · **Verify:** `npm run build` + local check against production API · **Est:** 1.25 SP
- [x] 7. [frontend] Notifications: `useEmaNotifications`, `NotificationPanel`, table/cards and delete confirmation · **Verify:** `npm run build` + local check · **Est:** 1 SP
- [x] 8. [frontend] Overlay: `useEmaTradesSettings`, `DisplayTab`, `useEmaCrossTrades` sending the types to `/setup-levels` · **Verify:** `npm run build` + local check · **Est:** 0.75 SP
- [x] 9. [docs] `backend/docs/architecture.md` and `.claude/CLAUDE.md` (also drop the stale `/chart-indicators` router) · **Verify:** manual · **Est:** 0.25 SP
- [ ] 10. [infra] Push backend (tasks 1–5) alone, then frontend when the user asks; **validate on production**: existing alerts/rules/overlay unchanged (AC 7); an alert and a rule with SMA created and fired with the right text; overlay with SMA matching the chart; mobile · **Verify:** manual (user validation) · **Est:** 1 SP
- [ ] 11. [specs] Est vs Actual in `verification.md` (both languages), close and archive under `archive/2026-11/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 8 SP
