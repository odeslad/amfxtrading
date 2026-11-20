# 054 — Chart UX: context menu, quick orders and side panels

> Status: **approved**

## Context
Placing an order from the chart means opening New Trade with the "+ New Trade" button and typing every price by hand. The right-side panels (New Trade, position edit, alerts, indicators, filters) are fixed overlays with a dark backdrop that cover the right part of the chart, including the latest candles and the price scale. Over the chart, top right, there are three floating buttons ("+ New Trade", "Delete" for the selected drawing, "Clear all" drawings). There is no context menu, right click or long press anywhere in the chart.

## Affected layers
- frontend · backend · db (the quick order settings are stored per user, like the other Settings, so they are the same on every device)

## User stories
- As the operator, I want to right-click (long-press on the phone) on the chart and get the actions for that point, so that I don't hunt for buttons.
- As the operator, I want to place a buy or sell order at the price I clicked, so that I don't type the entry price.
- As the operator, I want quick buy/sell orders in the menu, sent with sizes and stops configured once in Settings, so that I can enter in a couple of clicks.
- As the operator, I want the chart to stay fully visible while a side panel is open, so that I can see the price and the levels I am setting.

## Acceptance criteria
- AC 1. WHEN I right-click on the chart pane (desktop) or press and hold ~0.5 s without moving (phone) THEN a context menu opens at that point, showing the price under the pointer; the browser's own menu does not appear.
- AC 2. The menu closes on Esc, on a click or tap outside it, on choosing an option, and when the chart scrolls or zooms; it always fits inside the screen.
- AC 3. WHEN I choose "Buy at <price>" or "Sell at <price>" THEN New Trade opens with the chart's broker, symbol and timeframe, the side, and that price as the entry; the order type follows the market: a buy below the ask is a buy limit, above it a buy stop; a sell above the bid is a sell limit, below it a sell stop.
- AC 4. WHEN I choose "New trade" THEN New Trade opens as the "+ New Trade" button does today (market order, no price).
- AC 5. WHEN I choose "Price alert at <price>" THEN a price alert is created at that price for the chart's broker and symbol, above or below the current bid as it corresponds, and it is drawn on the chart.
- AC 6. WHEN I open the menu on a position or pending order line (entry, SL or TP) THEN the menu adds its actions: Edit (opens the position edit panel), Close / Cancel order, Remove SL, Remove TP (only those that exist). They are hidden when the chart is locked.
- AC 7. WHEN I open the menu on a drawing THEN it offers "Delete drawing"; the menu offers "Clear all drawings" (with confirmation) whenever the chart has drawings.
- AC 8. The "+ New Trade", "Delete" and "Clear all" floating buttons are removed from the chart; the Delete/Backspace key still deletes the selected drawing.
- AC 9. Settings has a "Quick orders" section with one configuration: size (fixed lots or risk %, required), SL in pips (optional), TP in pips or as an R multiple of the SL (optional, R only with an SL), and an optional mirror preset. Risk % requires an SL.
- AC 10. WHEN quick orders are configured THEN the menu offers "Quick buy" / "Quick sell" at market and "Quick buy at <price>" / "Quick sell at <price>" at the clicked price (limit or stop as in AC 3).
- AC 11. WHEN I choose a quick order THEN a short confirmation shows broker(s), type, size, entry, SL and TP; on Confirm the order is sent as New Trade would send it (to the chart's broker, or to the mirror preset brokers), and the result arrives as today; on Cancel nothing is sent.
- AC 12. WHEN quick orders are not configured, or the chart is locked, THEN the quick options are not shown.
- AC 13. WHEN New Trade or the position edit panel is open on desktop THEN the chart area narrows to the left of the panel, without a backdrop, and stays fully usable (scroll, zoom, drawing, dragging SL/TP); on closing it the chart takes the full width again. In split view both charts share the remaining width.
- AC 14. WHEN those panels open on the phone THEN they open as a bottom sheet of about half the screen, and the chart stays visible above it.
- AC 15. Long press does not break today's gestures: scroll, pinch zoom, drawing, dragging levels and double tap on drawings and position labels.
- AC 16. The alerts, indicators and filters panels keep their current behaviour.

## Out of scope
- Provisional entry/SL/TP lines to drag before sending an order.
- Dragging the price of a pending order.
- Keyboard shortcuts.
- Drawing tools and chart view options in the menu.
- Changes to the alerts, indicators and filters panels.
- EA changes; backend changes beyond storing the quick order settings.
