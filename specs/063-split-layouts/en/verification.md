# 063 — Split layouts · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | prisma generate + build + schema diff | ✅ | 0.5 SP | 0.25 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 1 SP |
| 3 | manual read | ✅ | 0.25 SP | 0.25 SP |
| 4 | build + eslint + review against the mockup; visual → task 6 🕐 | ✅ / 🕐 | 3 SP | 1 SP |
| 5 | build + eslint + review against the mockup; visual → task 6 🕐 | ✅ / 🕐 | 3 SP | 1 SP |

## Task 1 — [db] split_layouts table
- `SplitLayout` model (+ `User.splitLayouts`), unique `(userId, name)`, index on `userId`.
- `migration.sql` is the output of `prisma migrate diff --from-schema-datamodel <schema before> --to-schema-datamodel prisma/schema.prisma --script`, so the two match by construction. It is applied by the deploy (`prisma migrate deploy`).
- `npx prisma generate` ✅ · `npm run build` ✅.

## Task 2 — [backend] /split-layouts
- `GET /split-layouts` (the user's layouts by `position`) and `PUT /split-layouts` with `{ layouts: [...] }`. The PUT replaces the user's rows in a transaction, keeping the ids it receives and refusing ids of another user (400); names are freed first so two layouts can swap names. It broadcasts `split_layouts` to the user and answers with the saved list.
- `parseLayouts`: ≤ 20; name trimmed, 1–40 characters, unique (case-insensitive); broker from `config.brokers`; symbol non-empty, upper-cased; timeframe M5 · M15 · H1 · H4 · D1.
- `split-layouts.test.ts`: 4 tests ✅. Typecheck ✅ · eslint ✅ · build ✅ · `npm test` 245/246: the known `pipe-reader` timing flake (skipped in CI, see spec 062).
- Deviation: the timeframes are the five the chart offers (`ChartToolbar`), not M1 · M5 · M15 · M30 · H1 · H4 · D1 as written in the design.

## Task 3 — [docs] architecture
- `backend/docs/architecture.md`: `/split-layouts` in the routes table, the `split_layouts` WS message, the `split_layouts` table.
- `.claude/CLAUDE.md`: `split_layouts` in the WebSocket list, a "Configuraciones de split (spec 063)" section, 22 routers with `/split-layouts`, the `SplitLayout` model.
- Both read side by side: the same route, limits and message ✅.

## Task 4 — [frontend] Settings section
- `lib/useSplitLayouts.ts`: types, `fetchSplitLayouts` / `saveSplitLayouts`, `isLinkedLayout`, and the `useSplitLayouts` hook (GET + reload on the WS `split_layouts`) for the chart.
- `SplitLayoutsSection` built from `shared/ui` in the Mirror presets pattern: a `Section`; a bar with the Layout `Select`, the Name `TextInput`, **+ New** and **Delete**; a `Table` Left/Right × Broker/Pair/Timeframe with cards on mobile. With no layouts it shows an empty state and + New.
  - The pairs of a broker are its active pairs (Settings › Visibility). Changing the broker keeps the pair when that broker offers it, else EURUSD or its first pair.
- `SettingsPage`: its own `useAutosave` (validation: a name is required, no repeated names), joined to the page status with `combineSaves`; new layouts get their id from the save without remounting fields.
- `npm run build` ✅ · eslint ✅.
- Deviation: Settings has no "Display" section any more (spec 058 regrouped it into Trading, Chart, Indicators…). The section goes in **Settings › Chart**, whose summary now lists "Split layouts".
- 🕐 The check in the running app needs the backend deployed (no `/split-layouts` route before). It moves to task 6.

## Task 5 — [frontend] chart button, panel and apply
- `IconSplitLayouts` in `shared/ui/icons`. `ChartToolbar` / `ChartSlot`: an `onSplitLayouts` button beside the split button, on the left chart only and on desktop only (`splitAvailable` + `desktopOnly`), highlighted while the panel is open.
- `SplitLayoutsPanel` on the shared `SidePanel`:
  - each layout shows L/R `broker · pair · timeframe` and linked/unlinked;
  - **Active** when the split is open and both sides match;
  - **Unavailable**, with the reason, when a broker is hidden or a pair turned off, and the button is disabled;
  - an empty state and a link to Settings › Chart.
- `ChartPage.applySplitLayout`: sets the left broker, pair and timeframe, then the split `{ on, rightTimeframe, linked, rightBroker, rightSymbol }`. `linked` is set when both sides share broker and pair; the width is untouched; the close/reopen memory is cleared; the panel closes. The layouts come from `useSplitLayouts` (WS reload).
- `npm run build` ✅ · eslint on `features/chart` and `icons` ✅.
- 🕐 The check in the running app moves to task 6 (needs the backend deployed).
