# 063 — Split layouts · Design

> Status: **approved**

## Approach

A split layout is a per-user row with a name and the broker, pair and timeframe of each chart. Settings edits the whole list and saves itself like the rest of Settings (spec 058). The chart reads the list, keeps it current through the WebSocket and applies a layout through the split state that already exists (specs 036 and 060). The EA is not involved and its contract does not change.

### Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| **A. Own table and route, `PUT` of the whole list (chosen)** | Per user like the moving average templates; the autosave sends one body, like the mirror presets; few layouts, so replacing the list is cheap | One more router |
| B. A JSON column in `settings_display` | No new table | `settings_display` is one global row, not per user (AC 10) |
| C. CRUD routes per layout (`POST`/`PUT /:id`/`DELETE`) | Finer-grained | The autosave would have to diff and sequence calls; more code for 2–3 rows |

## Data flow

```
Settings › Display (autosave 800 ms) → PUT /split-layouts [ …whole list ] → transaction: replace the user's rows
  → WS { type: "split_layouts" } to the user's clients → they reload GET /split-layouts
Chart (desktop) → GET /split-layouts + WS → panel lists the layouts
  pick → left: setBroker / setSymbol / setTimeframe; split: { on, rightTimeframe, linked, rightBroker, rightSymbol }
```

## Per-layer changes

### [db]
Hand-written migration `split_layouts`:

```prisma
model SplitLayout {
  id             Int      @id @default(autoincrement())
  userId         Int
  user           User     @relation(fields: [userId], references: [id])
  name           String
  position       Int      @default(0)
  leftBroker     String
  leftSymbol     String
  leftTimeframe  String
  rightBroker    String
  rightSymbol    String
  rightTimeframe String
  updatedAt      DateTime @default(now()) @updatedAt

  @@unique([userId, name])
  @@index([userId])
  @@map("split_layouts")
}
```

Typed columns rather than JSON: six fixed fields, validated in one place.

### [backend]
- `routes/split-layouts.ts` (new, `requireAuth`):
  - `GET /split-layouts` returns the user's layouts by `position`: `[{ id, name, left: { broker, symbol, timeframe }, right: { … } }]`.
  - `PUT /split-layouts` takes the whole list and replaces it in a transaction, keeping the ids it receives. It then broadcasts `split_layouts` to the user and answers with the saved list, so new rows get their ids.
- `parseLayouts` (exported, tested): array of ≤ 20; name trimmed, 1–40 characters and unique in the list; broker one of `config.brokers`; symbol non-empty; timeframe in M1 · M5 · M15 · M30 · H1 · H4 · D1. Anything else is a 400.
- `ws.ts`: `broadcastSplitLayouts(userId)` → `sendToUser(userId, 'split_layouts', {})`, like `ma_templates`.
- `app.ts` / `index.ts`: mount the router and wire the broadcaster.

### [frontend]
- `lib/useSplitLayouts.ts`: loads `GET /split-layouts` and reloads on the WS `split_layouts` message, like `useMaTemplates`.
- `features/settings/SplitLayoutsSection.tsx` in Settings › Display, built like Mirror presets from `shared/ui`:
  - `Section` with a title and a description;
  - a bar with the `Layout` `Select`, the `Name` `TextInput`, and **+ New** / **Delete** buttons;
  - a `Table` with the rows Left and Right and `Select` columns for Broker, Pair and Timeframe, shown as cards on mobile.
  - Saving uses its own `useAutosave`, joined to the page status with `combineSaves`. The pairs of a broker come from the broker symbols that Settings › Visibility already loads.
- `features/chart/SplitLayoutsPanel.tsx`: a right-hand panel like the other chart panels.
  - Each layout shows L/R `broker · pair · timeframe` and "linked" or "unlinked".
  - The layout that matches what the charts show is marked **Active** (AC 7). A layout with a hidden broker or a pair turned off (`isVisible` from `lib/visibility`) is marked **Unavailable**, with the reason, and is disabled (AC 8).
  - With no layouts it shows the empty state and a link to `/settings` (AC 4).
- `ChartToolbar`: a split layouts `IconButton` in the left chart's toolbar, on desktop only (AC 3).
- `ChartPage`: `applySplitLayout(layout)` sets the left broker, pair and timeframe, then `setSplit(prev => ({ ...prev, on: true, rightTimeframe, linked, rightBroker, rightSymbol, leftTimeframe: undefined, leftBroker: undefined, leftSymbol: undefined }))`. `linked` is true when both sides share broker and pair (AC 6). The width (`ratio`) is not touched (AC 5).

No new dependencies.

## Files to touch
- db: `backend/prisma/schema.prisma` (+ `User.splitLayouts`), `backend/prisma/migrations/<new>/migration.sql`
- backend: `src/routes/split-layouts.ts` (+ test), `src/app.ts`, `src/index.ts`, `src/ws/ws.ts`
- frontend: `lib/useSplitLayouts.ts`, `features/settings/SplitLayoutsSection.tsx` (+ CSS module), `features/settings/SettingsPage.tsx`, `features/chart/SplitLayoutsPanel.tsx` (+ CSS module), `features/chart/ChartToolbar.tsx`, `features/chart/ChartSlot.tsx`, `features/chart/ChartPage.tsx`
- docs: `.claude/CLAUDE.md` and `backend/docs/architecture.md` (route, WS message, model)

## Risks
- **Applying a layout while the pairs list of a new broker is still loading:** the effect that reloads a broker's pairs keeps the current pair when the broker offers it, the same path as the split close fix (`649e210`).
- **Two tabs editing Settings at once:** the last save wins, as with the mirror presets.
- **A broker removed from `brokers.json`:** its layouts fail validation on the next save until they are edited; the chart marks them Unavailable.

## Mockup
Approved on 2026-11-26: https://claude.ai/artifact/Wsp2E2eh8eZB8Rkw8Kcs2b
- `Main` — chart (desktop): the split layouts button in the left toolbar and the right panel with an active, a normal and an unavailable layout.
- `PanelEmpty` — the panel with no layouts.
- `Settings` — Settings › Display › Split layouts, in the Mirror presets pattern (Layout, Name, + New, Delete, a table Left/Right × Broker/Pair/Timeframe, autosave).
- `SettingsMobile` — the same on mobile, one card per chart.
