# 060 — Split chart links · Design

> Status: **approved**

## Approach

Today `ChartPage` holds one broker and one pair (persisted as `chart.selection`) and passes them to both `ChartSlot`s; only the timeframe is per side (`split.rightTimeframe`). The right side gets its own broker and pair, and one link decides whether it shows its own or the left side's:

```ts
interface SplitState {
  on: boolean; rightTimeframe: string; ratio: number; leftTimeframe?: string;   // today
  linked?: boolean;   // missing = on (today's behaviour, AC 7)
  rightBroker?: string;
  rightSymbol?: string;
}

const linked = split.linked ?? true;
const rightBroker = linked ? broker : split.rightBroker ?? broker;
const rightSymbol = linked ? symbol : split.rightSymbol ?? symbol;
```

The left side stays the page's main selection (`broker` / `symbol`, `chart.selection`, the journal's deep link). The right side is **derived**: while linked it shows the left values, so turning the link on makes it take the left side's value with nothing to copy (AC 4), and a deep link from the journal moves the left side and, while linked, the right one (AC 6).

**Changing a selector** (AC 2, 3):

| Where | Link on | Link off |
|---|---|---|
| Left | `setBroker` / `setSymbol` (the right follows by derivation) | same; the right keeps its own |
| Right | `setBroker` / `setSymbol` (the left changes, the right follows) | `split.rightBroker` / `rightSymbol` |

**Turning the link off** stores the right side's current broker and pair as its own, so it does not jump.

## Pairs of each side

The list of pairs is per broker. The page's current fetch moves into a small hook, `useChartSymbols(broker)`, used once per side; the right one only fetches when its broker differs from the left's. Hidden brokers and pairs (spec 024 / 056) apply to each side as today.

**A linked pair the right broker does not offer** (AC 3): the right `ChartSlot` shows an `EmptyState` "SOLIDARY does not offer GBPUSD" instead of the chart; its selectors stay usable.

## Toolbar (mockup)

`ChartToolbar` gets two optional props, `linked` and `onToggleLink`. When set (split view), one link button follows the broker and pair selectors, on both sides, showing the same state: orange chain = linked, grey broken chain = unlinked (`IconLink` / `IconUnlink` in `shared/ui/icons`, `IconButton` with `tone="active"` when on). Without split view it is not rendered (AC 8).

## Side-bound features (AC 9)

Each `ChartSlot` already loads candles, positions, orders, drawings, ticks and its broker's moving-average template from its own `broker` / `symbol` props, so it only needs the right values. What lives in `ChartPage` is shared by both sides and today assumes one pair:

- **Panels opened from a toolbar** (indicators, filters, alerts, new trade): they open for the side that asked. The page keeps `panelSide: 'left' | 'right'`, set by the side's callbacks (`sharedSlotProps` gains per-side wrappers), and the panels take that side's broker and pair.
- **Filters panel** (the selectors on narrow screens): split view is desktop-only, so it keeps editing the left side.
- **Chart alerts and the alert price**: filtered by each side's own broker and pair.

## Persistence (AC 7)

All in the existing `chart.split` (localStorage). Old stored values have no `linked`, so it is on: exactly today's behaviour.

## Files

| File | Change |
|---|---|
| `frontend/src/features/chart/ChartPage.tsx` | right broker / pair, link, derived values, per-side selectors and panels |
| `frontend/src/features/chart/useChartSymbols.ts` | new: pairs of a broker (moved from `ChartPage`) |
| `frontend/src/features/chart/ChartToolbar.tsx` (+ css) | link button |
| `frontend/src/features/chart/ChartSlot.tsx` | "broker does not offer the pair" state |
| `frontend/src/shared/ui/icons.tsx` | `IconLink`, `IconUnlink` |

No backend, DB or EA change; no new dependency. The WS tick subscription is reference-counted per pair (`addTickSubscription`), so two pairs at once already work (limit 16).

## Mockup

https://claude.ai/artifact/3KZsuLXA7gTKLX7Ym9KS1M (approved, one link icon): desktop artboards **Linked** (default) and **Unlinked** (each side its own broker and pair).

## Risks

- `ChartPage` is long (650 lines) and the panels assume one pair: the per-side panel wiring is the riskiest part; it gets its own task.
- A right-side broker that disappears (hidden or removed): it shows as today's hidden selection, marked "· hidden", until changed.
