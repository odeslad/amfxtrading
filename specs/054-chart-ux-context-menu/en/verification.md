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

## Task 4 · [frontend] Order type and quick order plan

- **Mechanism:** `npm run build` + eslint; the two modules run with `tsx` on sample prices (a throwaway script outside the repo, `commands.ts` stubbed because `api.ts` needs Vite).
- **Steps:** `lib/orderType.ts` (`orderTypeAt`); `buildQuickOrder` in `lib/quickOrders.ts` (entry = clicked price or ask/bid, SL from pips, TP from pips or R, one command per enabled preset broker with its own size, refuses risk % without SL and a preset with no enabled broker).
- **Checked (EURUSD bid 1.0830 / ask 1.0831, SL 15 p, TP 2R):** buy market → buy, SL 1.0816, TP 1.0861; sell market → SL 1.0845, TP 1.0800; buy at 1.0800 → buylimit; sell at 1.0800 → sellstop; buy at 1.0900 → buystop; USDJPY sell, TP 30 p → SL 150.25, TP 149.80; preset → two commands with each broker's size, disabled broker left out; risk % without SL → refused.
- **Outcome:** ✅ build and lint clean, every case as New Trade would compute it.
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Task 5 · [frontend] Context menu by right click

- **Mechanism:** `npm run build` + eslint; local check on desktop (Vite 5174 against the production API).
- **Steps:** `ChartContextMenu` (sections of items, rendered inside the chart, clamped to it; closes on Esc, outside pointer down, wheel, resize, blur and on choosing); `LightweightChart` reports right clicks in the pane (`ChartContextRequest`: position, price at the pointer, bid/ask) and blocks the browser menu, ignoring the price scale and interactive labels; `chartMenu.ts` builds Buy at / Sell at (type from `orderTypeAt`), New trade and Price alert at; `ChartSlot` holds the menu; `NewTradePanel.initialOrder` applies the chosen action and price once per request; `ChartPage` passes the order and `createAlert`.
- **Outcome:** ✅ build and lint clean; the operator checked every item and the closing rules.
- **Est vs Actual:** 2.5 SP · 1 SP.

## Task 6 · [frontend] Menu targets and floating buttons removed

- **Mechanism:** `npm run build` + eslint; local check on desktop.
- **Steps:** `LightweightChart` records every position/order line (entry, SL, TP) and resolves the target under the pointer (line within 6 px, else a drawing via the new `TrendlineManager.drawingAt`); the request carries the drawing count and the delete / clear actions; `chartMenu.ts` adds the position section (Edit, Remove SL / TP when present, Close / Cancel; hidden when locked) and the drawing section (Delete drawing, Clear all drawings… with a `ConfirmPanel`); right mouse button no longer starts a level drag or a drawing anchor; the floating "+ New Trade", "Delete" and "Clear all" buttons and their CSS are gone (the Delete key stays).
- **Outcome:** ✅ build and lint clean; the operator checked the position and drawing actions.
- **Est vs Actual:** 2 SP · 1 SP.

## Task 7 · [frontend] Long press on touch

- **Mechanism:** `npm run build` + eslint; local check in Chrome DevTools device mode (the phone cannot reach the local Vite); the real iPhone check moves to task 11 (production), as the spec already planned.
- **Steps:** `LightweightChart` arms a 500 ms timer on a single-finger touch (not while a drawing tool is active), cancelled by a move over 8 px, a second finger, touchend or touchcancel; when it fires it opens the menu 24 px below the finger (wider 18 px hit tolerance for lines and drawings) and swallows the rest of the touch (no click on a menu item, no drag); Android's own long-press `contextmenu` is ignored for touch pointers; the chart has `user-select: none` and `-webkit-touch-callout: none`. Shared `openMenuAt` for mouse and touch.
- **Fixes during the check:** menu items fire on pointer up (only when pressed inside the same item), because a chart touch handler could cancel the synthetic click; the chart's touch handlers ignore touches that start in the menu; the long-press listeners moved to the document so a touch on a drawing still arms it; the menu offers "Delete selected drawing" when the click is not exactly on the line (hit precision left as it is, at the operator's request).
- **Outcome:** ✅ build and lint clean; the operator checked it in device mode. 🕐 iPhone gestures pending until task 11.
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Task 8 · [frontend] Quick orders in the menu

- **Mechanism:** `npm run build` + eslint; local check of the menu and the confirmation (Cancel only; sending is validated in production, task 11).
- **Steps:** `lib/useQuickOrders.ts` reads the configuration and the presets; `chartMenu.ts` adds Quick buy / Quick sell (market, with the size or preset name) and Quick buy / sell at the clicked price (limit or stop), hidden when not configured, locked or without a quote; `ChartSlot` builds the plan with `buildQuickOrder` (errors as toasts); `QuickOrderConfirm` (on `ConfirmPanel`, detail on several lines) shows type, price, each broker with its size, preset, SL and TP, and sends one command per broker on Confirm; the result toast comes from `AppLayout`. The confirmation is the existing right-side `ConfirmPanel` rather than the centred card of the mockup, to reuse the pattern of the other confirmations.
- **Outcome:** ✅ build and lint clean; the operator checked the menu and the confirmation. 🕐 Sending pending until task 11.
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Task 9 · [frontend] Docked New Trade and position edit panels

- **Mechanism:** `npm run build` + eslint; local check on desktop.
- **Steps:** `shared/ui/DockedPanel.module.css` (`docked`: in the flow, 320 px, no transform; `hidden` when closed; on the phone 50dvh at full width); `NewTradePanel` and `BulkEditPanel` take `docked` (no backdrop); `ChartPage` lays out `.workspace` = chart area + the two docked panels (a column on the phone), and opening one closes the other. The Journal keeps the overlay. The charts resize through their own `ResizeObserver`.
- **Outcome:** ✅ build and lint clean; the operator checked it on desktop (single and split view). 🕐 Phone bottom sheet pending until task 11.
- **Est vs Actual:** 2.5 SP · 0.75 SP.

## Task 10 · [docs] Architecture docs

- **Mechanism:** manual review of the diff.
- **Steps:** `backend/docs/architecture.md` (`/settings` and `settings_display` with `quickOrders`); `.claude/CLAUDE.md` (`SettingsDisplay.quickOrders` and a "Menú contextual del gráfico" section).
- **Outcome:** ✅ both documents agree.
- **Est vs Actual:** 0.25 SP · 0.15 SP.
