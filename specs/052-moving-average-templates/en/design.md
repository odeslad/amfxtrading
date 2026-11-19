# 052 — Moving average templates per broker · Design

## Approach

Templates replace the single EMA list. A template is a named list of moving averages (type, period, colour, style, width); one template is the default; each broker can be assigned one. The chart resolves the template of its own broker (each side of the split view separately) and draws each average with its type. Templates are created and edited in a "Moving average templates" section of Settings › Display (no new tab: a later spec reorganises Settings); the chart's indicators button chooses the template of its broker (the assignment) and shows or hides averages on the device (decided with the operator on the mockup).

The SMA is drawn the same way as the EMA today: computed over the loaded candles, and updated on every tick for the candle in progress.

## Per-layer changes

### db

- `ma_templates`: `id`, `userId` (FK users), `name`, `isDefault` (bool), `averages` (JSON array of `{ id, type: 'ema'|'sma', period, color, style, width }`), `createdAt`, `updatedAt`. One default per user (partial unique index `WHERE "isDefault"`).
- `ma_template_brokers`: `userId`, `broker`, `templateId` (FK `ma_templates` **on delete cascade**), PK `(userId, broker)`. A broker without a row uses the default template; deleting a template deletes its rows, so its brokers fall back to the default (AC 5).
- **Data migration in the same SQL file (AC 6):** for every row of `chart_indicators`, insert a default template "Default" whose averages are its `emas` with `type: 'ema'` added to each. A user without a row gets an empty default template on first read.
- `chart_indicators` is kept, unused, until the spec is validated (rollback); the last code task drops it and its route.

### backend

`src/routes/ma-templates.ts`, behind `requireAuth`, every query scoped to `req.userId`:

| Route | Does |
|---|---|
| `GET /ma-templates` | `{ templates: [...], assignments: { [broker]: templateId } }`; creates the empty default if the user has none |
| `POST /ma-templates` | creates `{ name, averages }` |
| `PUT /ma-templates/:id` | renames and/or replaces the averages |
| `PUT /ma-templates/:id/default` | makes it the default (one transaction) |
| `DELETE /ma-templates/:id` | `409` for the default; otherwise deletes it (assignments cascade) |
| `PUT /ma-templates/assignments` | `{ broker, templateId \| null }`; `null` removes the row (default) |

Validation (`400`): name 1–40 characters; each average `type` in `ema`/`sma`, `period` a whole number ≥ 1 (AC 10, same as today's EMAs, no upper limit, no limit on the count), `color` `#rrggbb`, `style` `solid`/`dashed`/`dotted`, `width` 1–3, `id` a non-empty string unique in the template.

After every write the backend broadcasts `{ type: 'ma_templates' }` over the WebSocket to the user's clients; open charts and the Settings tab reload (AC 7).

### frontend

- `src/lib/useMaTemplates.ts`: loads `/ma-templates`, reloads on the `ma_templates` WS message, exposes `templateFor(broker)` (assigned, else default) and the write calls.
- `Ema` type → `MovingAverage` with `type: 'ema' | 'sma'`.
- `LightweightChart.tsx`: `calcEma` gains a sibling `calcSma` (rolling sum over `period` closes); the live update of the candle in progress uses the type of each average (EMA: one step from the previous value; SMA: the rolling sum with the current close in place of the last one).
- `ChartPage` / `ChartSlot`: each slot draws `templateFor(slot.broker)` minus the averages hidden on this device (AC 2, 3, 8). The old `/chart-indicators` load and save go away.
- `IndicatorsPanel.tsx` (the chart's indicators button): a "Template for <broker>" select with every template and "Default" — changing it calls `PUT /ma-templates/assignments` for that broker; below, the template's averages (type, period, colour swatch) with a show/hide toggle each, and a link "Edit in Settings › Display" (AC 9). Hidden ids are stored per device in `localStorage` (`chart.maHidden`).
- `src/features/settings/MaTemplatesSection.tsx` + `.module.css` (AC 4, 5, 11), rendered at the end of `DisplayTab`, as in the mockup: template list (name, default star, count of averages, brokers using it), the selected template's averages (type select, period, colour, style, width, delete, add) with *Save template*, *New template*, *Rename*, *Make default*, *Delete* (confirm panel naming the brokers that fall back to the default). No broker table: assignments are made from the chart. Tables on desktop, cards on mobile.
- `DisplayTab.tsx`: renders the section. The section saves with its own *Save template* button; the tab bar's *Save* keeps saving the other Display settings.

## Data flow

```
Settings › Display, chart indicators button ──PUT/POST/DELETE /ma-templates──▶ db (ma_templates, ma_template_brokers)
                                                       └─▶ WS { type: 'ma_templates' } ──▶ useMaTemplates (chart, settings) reload
Chart slot (broker) ──templateFor(broker)──▶ averages − hidden (localStorage) ──▶ LightweightChart (EMA / SMA series)
```

No change to the EA ↔ backend contract.

## Mockup

Approved by the operator on 2026-11-19: https://claude.ai/artifact/Vfn9euqE2PWW6Jjti2KKSV — artboards: Settings › Display desktop, Settings › Display mobile, delete a template in use, chart › indicators button with the broker's template.

## Files to touch

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_ma_templates/migration.sql`; later `<ts>_drop_chart_indicators`.
- `backend/src/routes/ma-templates.ts` (+ test), `backend/src/app.ts`, `backend/src/ws/ws.ts` (broadcast); later remove `routes/chart-indicators.ts`.
- `frontend/src/lib/useMaTemplates.ts`, `frontend/src/features/chart/chart.types.ts`, `LightweightChart.tsx`, `ChartPage.tsx`, `ChartSlot.tsx`, `IndicatorsPanel.tsx` (+ css), `frontend/src/features/settings/MaTemplatesSection.tsx` (+ css), `DisplayTab.tsx`.
- `backend/docs/architecture.md`, `.claude/CLAUDE.md`.

## Dependencies

None added.

## Risks

- **Deploy order:** the backend ships first with the new routes and the data migration; the old route keeps answering, so the deployed frontend works until the new one ships. Templates edited before the frontend ships do not exist yet for the operator, so there is nothing to lose.
- **SMA on the live candle** must use the same window as the full calculation, or the last point jumps when the candle closes; covered by a check against the full calculation in the local test.
- **Many averages with long periods** cost more on each tick: the incremental update keeps it at one step per average, as today.
