# 055 — Journal accounts · Design

## Approach
Account colours are a small new table keyed by broker, served with the balances. Filters and counts are frontend only: the filter reuses the Positions filters panel, and the counts come from the live positions feed the journal already keeps.

## db
Migration adding `account_colors (broker TEXT PRIMARY KEY, color TEXT NOT NULL)`; model `AccountColor`. A broker without a row has no colour; clearing the colour deletes the row. Same palette names as `position_colors` (stored as the colour key, e.g. `orange`).

## backend
`routes/balances.ts`:
- `GET /balances` adds `color` (`''` when none) to each account, from one `accountColor.findMany`.
- `PATCH /balances/color { broker, color }`: `color` empty deletes the row, else upsert; `broker` a non-empty string, `color` a string of at most 20 characters (the palette lives in the frontend, as for positions). `200 { ok: true }`.
Tests for the parsing (route tests follow the existing pattern).

## frontend
- **Colour badge:** `ColorBadge` takes its own save function instead of calling `/positions/color` itself (`onCycle(next) => Promise`), so positions and accounts share the component and its look. Accounts call `PATCH /balances/color`, optimistic with rollback and toast, like positions.
- **Counts:** `Accounts` reads `useLivePositions()` (already fed by `useLivePositionsFeed` in `JournalPage`) and counts per broker the market positions (`!isPending`) and pending orders (`isPending`), skipping symbols hidden in Settings › Visibility (`visibleSymbols`). Live by construction.
- **Desktop table:** a colour column first (the badge) and "Trades / Orders" after Number, sortable by the number of positions (`useSort` column).
- **Phone card:** the summary shows badge · Broker · "Trades / Orders" · P&L; Number moves to the expanded details.
- **Filters:** `FiltersPanel` gets an optional `fields` prop (`['broker', 'color']` for accounts; default unchanged), so the panel, header, fields and Clear filters are the same component as Positions. `JournalPage` keeps account filters in `localStorage` (`journal.accountFilters`, `{ broker, color }`), shows the Filters button on Accounts with the active state, and passes the filters to `Accounts`. Options: brokers = visible accounts; colours = colours some account has, in palette order. Empty result: "No accounts match the filters".

## Data flow
Badge → `PATCH /balances/color` → `account_colors` → `GET /balances` (on load). Counts: WS `positions` → live positions store → `Accounts`. No EA change.

## Alternatives
- Colours in `settings_display` as a JSON map: no migration of a table, but the colour belongs to the account and a table keeps it queryable and simple to upsert. Rejected.
- Counts from a new backend endpoint: duplicates what the live feed already gives the journal. Rejected.

## Risks
- Changing `ColorBadge` touches positions and orders: same behaviour, checked in the journal tabs after the change.

## Mockup
https://claude.ai/artifact/Di4G41MqDMw6Xx8WCsTpL9 — artboards: Desktop · Accounts with colour and Trades / Orders; Desktop · filters panel (same as Positions); Desktop · no account matches; Phone · cards with Trades / Orders.
