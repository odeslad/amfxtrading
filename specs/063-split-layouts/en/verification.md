# 063 — Split layouts · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | prisma generate + build + schema diff | ✅ | 0.5 SP | 0.25 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 1 SP |
| 3 | manual read | ✅ | 0.25 SP | 0.25 SP |

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
