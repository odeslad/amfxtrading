# 054 — Chart UX · Design

## Approach
Three independent pieces that ship in this order: (1) the quick order settings (db + backend + Settings), (2) the chart context menu with its actions, replacing the floating buttons, (3) docking New Trade and the position edit panel next to the chart. No new dependency.

## db
Migration adding `settings_display."quickOrders" JSONB NULL` (null = not configured). Shape:

```ts
{ lotsMode: 'fixed' | 'risk_pct'; size: number; slPips: number | null;
  tpMode: 'pips' | 'r' | null; tp: number | null; mirrorPresetId: number | null }
```

It lives with the other display settings (one row), so it is the same on every device, like the overlay settings.

## backend
`routes/settings.ts`: `display.quickOrders` read and written with the rest; validated: `size > 0`; `slPips > 0` or null; `tpMode`/`tp` both null or both set with `tp > 0`; `tpMode: 'r'` and `lotsMode: 'risk_pct'` need `slPips`; `mirrorPresetId` an existing preset or null (a deleted preset falls back to null on read). `null` clears it. Tests next to the existing `parseDisplay` tests. No change to `/commands`: quick orders send the same commands New Trade sends.

## frontend

### Context menu
- `features/chart/ChartContextMenu.tsx` (+ module CSS): a positioned list of `{ label, hint, tone, onSelect }` sections, rendered inside the chart container (so it also works in fullscreen), clamped to the container; closes on Esc, outside pointer down, choosing an item, and chart scroll/zoom (`subscribeVisibleLogicalRangeChange`).
- `LightweightChart.tsx` opens it:
  - Desktop: `contextmenu` on the chart container → `preventDefault` and open at the pointer.
  - Touch: a long-press timer (500 ms) started on a single-finger `touchstart` in the pane; cancelled by a move > 8 px, a second finger, or `touchend`. It is not armed while a drawing tool or the ruler is active, nor when the touch starts a level drag. When it fires it swallows the rest of that touch, so no click, selection or drag follows. Double tap and pinch stay as they are.
  - Target under the pointer, in this order: a position/order line (the existing level hit test with `HIT_PX`/`TOUCH_HIT_PX`, extended to entry lines), a drawing (`TrendlineManager` exposes its private `hitTest` as `drawingAt(clientX, clientY)`), else the empty pane. The price is `series.coordinateToPrice(y)` rounded to the symbol precision.
- Items (mockup): quick orders (when configured and the chart is not locked) → Buy at / Sell at / New trade → Price alert at → target actions (position: Edit, Remove SL, Remove TP, Close / Cancel order — hidden when locked; drawing: Delete drawing) → Clear all drawings (when there are any, with a confirmation).
- Limit or stop: `orderTypeAt(side, price, bid, ask)` in `lib/orderType.ts`: buy → `price < ask ? 'buylimit' : 'buystop'`; sell → `price > bid ? 'selllimit' : 'sellstop'`. Unit-tested.
- Actions reuse what exists: Edit → `onEditPosition`; Close → the `ClosePositionPanel` confirmation; Remove SL/TP → `onModifyPosition(ticket, 0, tp)` / `(ticket, sl, 0)`; Price alert → `useAlerts.create` with `direction = price > bid ? 'above' : 'below'`; Buy/Sell at → `onNewTrade` with `{ action, price }`; drawings → `deleteSelected` / `clearAll` on the manager.
- The `.drawingActions` floating buttons and their CSS are removed; the Delete/Backspace key stays in `DrawingTools`.

### Order at a price
`NewTradePanel` gets an optional `initialOrder?: { action: CommandAction; price?: number }`; when it changes with the panel open, the form takes that action and price (SL/TP untouched). `ChartPage.newTradeTimeframe` becomes `newTradeRequest { timeframe, action?, price? }`.

### Quick orders
- `lib/useQuickOrders.ts`: reads `display.quickOrders` from `/settings`; `buildQuickOrder(config, { side, broker, symbol, price | null, bid, ask, presets })` returns the commands and a summary. SL price = entry ∓ `slPips × pipSize(symbol)`; TP from pips, or `entry ± R × SL distance`; entry = clicked price, or ask/bid at market. Mirror: one command per enabled broker of the preset, with the preset's lots and `lotsMode` (as New Trade's mirror mode); otherwise the chart's broker with the configured size. Unit-tested.
- `QuickOrderConfirm.tsx`: a small centred confirmation (mockup) built on `ConfirmPanel`; Confirm calls `sendCommand` for each command. The result toast already comes from `AppLayout`, which toasts every `command_result`.
- Settings: a "Quick orders" section at the end of the Mirror tab (next to the presets it may use): size mode + size, SL pips, TP mode + value, preset select, a "Clear" button. Saved with the display settings.

### Docked panels
- `NewTradePanel` and `BulkEditPanel` get a `docked?: boolean` prop. Docked, the panel drops its backdrop and `position: fixed`, and is rendered by `ChartPage` as a sibling of `.chartArea` inside a new flex row (`.workspace`). Desktop: the row lays out chart + 320 px panel; the chart's `ResizeObserver` already resizes the charts (and the split view shares the remaining width). Phone (≤ 768 px): the row becomes a column and the panel takes `50dvh` with its own scroll, the chart keeps the top half.
- Only one docked panel at a time: opening New Trade closes the edit panel and vice versa.
- `JournalPage` keeps the overlay (no `docked`). Alerts, indicators and filters panels are untouched.

## Data flow
Settings (frontend) → `PUT /settings` (`display.quickOrders`) → `settings_display`. Chart menu → `POST /commands` (unchanged) → EA → `command_result` over WS → `AppLayout` toast. No EA contract change.

## Alternatives
- Quick order settings in `localStorage` (like the mirror preset choice): no backend work, but different on the phone and the desktop. Rejected (user asked for Settings).
- A table for quick orders: only useful with several named configurations, which were not asked for.
- Portal the menu to `document.body`: simpler clamping, but it would disappear in fullscreen. Rejected.
- Long press via lightweight-charts events: the library has no long-press event and its touch handling would scroll the chart; our own listener in capture phase, as `DrawingTools` does, gives control.

## Risks
- Gesture conflicts on touch (long press vs. pan, drawing, level drag, iOS text selection callout). Mitigation: cancel on move, not armed while drawing or dragging, `-webkit-touch-callout: none` and `user-select: none` on the chart; checked on iPhone in the validation.
- A quick order is a real order sent in two taps: always confirmed, hidden when locked.
- Docking changes the chart width when a panel opens; the chart keeps the same visible range on resize (lightweight-charts default); verified in the validation.

## Mockup
https://claude.ai/artifact/Qox8veBEwiDiFfrN8dcty7 — artboards: Desktop · menu on empty area; Desktop · menu on a position line; Desktop · menu on a drawing; Desktop · quick order confirmation; Desktop · New Trade docked, chart narrowed; Phone · long press menu; Phone · New Trade as bottom sheet; Settings · Quick orders (desktop); Settings · Quick orders (phone).
