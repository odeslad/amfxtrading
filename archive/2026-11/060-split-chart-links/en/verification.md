# 060 — Split chart links · Verification

| Task | Mechanism | Commands | Result | Evidence | Est vs Actual |
|---|---|---|---|---|---|
| 1. Right-side broker and pair, one link | build + local app | `npm run build`; `eslint src/features/chart src/shared/ui`; vite 5174 → `/chart` | ✅ | Build OK; lint clean; user checked it in the local app. `SplitState` gains `linked` / `rightBroker` / `rightSymbol`; the right side is derived while linked; unlinking keeps what it shows; `useChartSymbols` loads the right broker's pairs; positions kept for every broker so each side shows its own; per-side alerts and position actions; "BROKER does not offer PAIR" notice. **Deviations agreed with the user**: the broker / pair selectors are always visible on desktop (before, desktop chose them only in the Filters panel), the timeframe buttons became a dropdown next to them, the link button sits after the funnel, a chart narrower than its toolbar folds the drawing tools behind Draw and shrinks the selects (… only when there is no room), and the Filters panel already edits the side that opened it (planned for task 2). Mockup updated to match | 2.5 / 1.5 SP |
| 2. Side-bound panels | build + local app | `npm run build`; `eslint src/features/chart`; vite 5174 → `/chart` | ✅ | Build OK; lint clean; user asked to continue. `panelSide` set by each side's indicators, alerts and New Trade callbacks; the panels take that side's broker and pair (indicators: its broker's template; alerts: its pair, list and last bid, both split pairs subscribed to ticks; New Trade: its broker, pair and timeframe) | 1.5 / 0.5 SP |
| 3. Production validation | manual (user) | push `master` (`1cbb649..57ac613`), frontend deploy (build 329) | ✅ | User validated on production | 0.5 / 0.25 SP |
| 4. Close | build | `npm run build` | ✅ | Build OK; spec closed and archived under `archive/2026-11/` | 0.25 / 0.25 SP |

## Est vs Actual

**Total**: 4.75 SP estimated · 2.5 SP actual. Each `ChartSlot` already loaded everything from its own broker and pair, so the work stayed in `ChartPage`; most of the time went into the toolbar layout, which was not in the estimate.

**Deviations agreed with the user**: one link for broker and pair (the first draft had two); selectors always visible on desktop; timeframe as a dropdown; the toolbar measures itself and folds the drawing tools behind Draw only when it does not fit; the Filters panel edits its side (moved from task 2 to task 1).
