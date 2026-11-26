# 063 — Split layouts · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend (with db) → frontend. The EA is not touched.

- [x] 1. [db] `SplitLayout` model (+ `User.splitLayouts`) and hand-written migration `split_layouts` · **Verify:** `prisma generate` + `npm run build`; `prisma migrate diff` from the previous schema gives the same SQL as the migration · **Est:** 0.5 SP
- [x] 2. [backend] `routes/split-layouts.ts`: `GET` and `PUT` of the whole list (transaction, ids kept), `parseLayouts` validation, WS `split_layouts` to the user; router and broadcaster wired · **Verify:** vitest of `parseLayouts` (valid list, name empty/duplicated/too long, unknown broker, bad timeframe, > 20) + `npm run lint/typecheck/test/build` · **Est:** 2 SP
- [x] 3. [docs] `.claude/CLAUDE.md` and `backend/docs/architecture.md`: route, WS message, model · **Verify:** manual read, the two documents agree · **Est:** 0.25 SP
- [x] 4. [frontend] `useSplitLayouts` and the Settings › Display "Split layouts" section in the Mirror presets pattern (Layout, Name, + New, Delete, Left/Right table, cards on mobile, autosave joined with `combineSaves`) · **Verify:** `npm run build` + eslint; review against the mockup · **Est:** 3 SP
- [ ] 5. [frontend] Chart: split layouts button in the left toolbar (desktop only), `SplitLayoutsPanel` (list, Active, Unavailable with the reason, empty state) and `applySplitLayout` (left broker/pair/timeframe, split on, linked when both sides share broker and pair, width untouched) · **Verify:** `npm run build` + eslint; review against the mockup · **Est:** 3 SP
- [ ] 6. [infra] Push `master`: backend first (alone, no other pipeline running), frontend when the user asks; **validate on production**: create, rename, edit and delete layouts in Settings › Display (autosave, also on mobile); the chart button opens the panel; applying a layout with the split closed opens it with both charts set; a layout with the same broker and pair is applied linked, another unlinked; the active layout is marked; a layout with a pair turned off is Unavailable; a change in Settings shows in an open chart tab without a reload; the same layouts on another device · **Verify:** manual (user validation) · **Est:** 1 SP
- [ ] 7. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 10 SP
