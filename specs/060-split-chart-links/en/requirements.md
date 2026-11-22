# 060 — Split chart links

> Status: **approved**

## Context

In the split chart (spec 036, desktop only) both sides always show the same broker and pair; only the timeframe differs (the right one opens a timeframe above). The operator wants each side to be able to show a different broker and pair, and to choose whether a change on one side carries over to the other.

## Affected layers

- frontend

## User stories

- As an operator, I want to link the two sides, so that choosing a broker or a pair on one side changes the other too.
- As an operator, I want to unlink them, so that each side shows its own broker and pair (e.g. the same pair in two brokers, or two pairs in the same broker).

## Acceptance criteria

- AC 1. WHEN the chart is split THEN each side has its own broker and pair selectors, and one link between the sides, on or off, that covers both broker and pair.
- AC 2. WHEN the link is on and the operator picks a broker on either side THEN the other side switches to that broker. WHEN it is off THEN only that side changes.
- AC 3. WHEN the link is on and the operator picks a pair on either side THEN the other side switches to that pair (if the other side's broker does not offer it, that side shows that the broker does not offer the pair instead of a chart). WHEN it is off THEN only that side changes.
- AC 4. WHEN the link is turned on while the sides differ THEN the right side takes the left side's broker and pair.
- AC 5. The timeframe is never linked: each side keeps its own, as today.
- AC 6. WHEN the operator opens a position or order from the journal (double click or double tap) THEN the left side shows its broker and pair, and the right side follows it only while the link is on.
- AC 7. The link and each side's broker and pair are remembered in this browser, together with the rest of the split state; closing and reopening the split restores them. WHEN nothing is remembered THEN the link is on (today's behaviour).
- AC 8. WHEN the chart is not split THEN nothing changes: one chart with its selectors, as today.
- AC 9. Everything bound to a side (positions, orders, drawings, alerts, the moving-average template of its broker, live ticks) follows that side's own broker and pair.

## Out of scope

- Linking the timeframe.
- More than two charts.
- The split chart on mobile (still desktop only).
- Linking scroll or crosshair between the sides.
