# 052 — Moving average templates per broker

> Status: **closed**

## Context

The chart draws exponential moving averages (EMA) only. Each user has one list of them (`chart_indicators.emas`: period, colour, style, width), edited in the chart's indicators panel and applied to every broker, symbol and timeframe alike. The operator wants simple moving averages (SMA) as well, and different sets of moving averages for different brokers — for example one set for the prop-firm accounts and another for the Solidary accounts — without editing the list every time the chart changes broker.

## Affected layers

- db (templates and their assignment per broker)
- backend (routes for templates and assignments)
- frontend (a section of Settings › Display to manage templates; the chart draws the template of its broker, with SMA support)

## User stories

- As the operator, I want to add simple moving averages next to exponential ones, so that I can use the indicators my strategies are based on.
- As the operator, I want to save named templates of moving averages, so that I can keep several sets ready.
- As the operator, I want to assign a template to each broker, so that every chart of that broker shows its set without touching anything.
- As the operator, I want a default template for brokers without one, so that a new broker shows sensible averages at once.

## Acceptance criteria

- AC 1. WHEN the operator adds a moving average to a template THEN they choose its type (EMA or SMA), period, colour, line style and width.
- AC 2. WHEN the chart shows a symbol THEN it draws the moving averages of the template assigned to that chart's broker, each computed with its own type over the chart's candles, including the candle in progress.
- AC 3. WHEN a chart shows a broker and timeframe THEN it uses the template assigned to that broker on that timeframe; without one, the template assigned to the broker for every timeframe; without one, the default template.
- AC 4. WHEN the operator opens Settings › Display THEN, in a "Moving average templates" section, they can create, rename, edit and delete templates and mark one as default; the list shows which brokers use each template.
- AC 5. WHEN a template that is assigned to brokers is deleted THEN those brokers fall back to the default template, after the operator confirms; the default template cannot be deleted.
- AC 6. WHEN the change is deployed THEN the operator's current EMA list becomes the default template, so the charts look the same as before until something is changed.
- AC 7. WHEN a template or an assignment is saved THEN charts already open pick it up without reloading the page.
- AC 8. WHEN the split view shows two charts of different brokers THEN each draws its own broker's template.
- AC 9. WHEN the chart's indicators button is opened THEN it lets the operator choose the template of the chart's broker (any template, or the default), for every timeframe of that broker or, with "Only on <timeframe>" ticked, only for the chart's timeframe; it lists that template's averages, lets each be shown or hidden on this device, and links to Settings › Display to edit them.
- AC 10. WHEN templates are saved THEN each period is a whole number of 1 or more, the same rule as today's EMAs; there is no limit on the period or on the number of averages in a template.
- AC 12. WHEN a template is assigned to a broker on one timeframe THEN that broker's other timeframes keep their own template, and clearing it returns that timeframe to the broker's template (or the default). Existing assignments are for every timeframe. (Added with the operator on 2026-11-19, after the first local test.)
- AC 11. WHEN the page is on a phone THEN the templates section of Settings › Display is usable (cards on mobile, tables on desktop).
## Out of scope

- SMA in moving average alerts, notification rules, the cross trades overlay and setup levels, with each side of a cross choosing its own type and existing ones kept as EMA against EMA: spec 053, opened when this one closes (decided with the operator on 2026-11-19).
- Price alerts (they do not use averages).
- Templates per timeframe or per symbol.
- Other indicator types (Bollinger bands, RSI, …).
- Sharing templates between users.
- A new layout of Settings: the templates live in Display for now; a later spec reorganises Settings (decided with the operator on 2026-11-19).
