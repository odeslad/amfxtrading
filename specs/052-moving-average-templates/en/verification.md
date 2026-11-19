# 052 — Moving average templates per broker · Verification

## Task 1 · [db] Template tables and data migration

- **Mechanism:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` from production through the SSH tunnel; the migration run on production inside a transaction rolled back at the end.
- **Steps:** migration `20261119100000_ma_templates`: `ma_templates` (`userId` FK, `name`, `isDefault`, `averages` JSONB, timestamps, index on `userId`), `ma_template_brokers` (PK `userId` + `broker`, `templateId` FK on delete cascade), and an `INSERT … SELECT` turning each `chart_indicators.emas` into a default template "Default" with `type: 'ema'` added to every average. Models `MaTemplate`, `MaTemplateBroker`.
- **Production's data:** one row (user 1): EMA 24 (#e05c5c, solid, 2), EMA 48 (#3a7bd5, solid, 2), EMA 288 (#4caf84, dotted, 1), EMA 576 (#f5a623, dotted, 1).
- **Rolled-back run on production:** tables created; one template "Default", `isDefault` true, the four averages with their ids, colours, styles, widths and periods unchanged and `"type": "ema"` added; after `ROLLBACK` `ma_templates` does not exist.
- **Change during the task:** the first version had a partial unique index (one default per user). It worked (a second default was refused), but Prisma 5 cannot express it, so `prisma migrate diff` against production would never be empty again; it was removed and the rule moves to the routes (task 2, in a transaction). The diff now holds exactly the migration's tables, index and foreign keys (the data `INSERT` is not schema).
- **Outcome:** ✅
- **Est vs Actual:** 1 SP · 0.75 SP.

## Task 2 · [backend] Routes /ma-templates

- **Mechanism:** vitest on a throwaway Express server with `requireAuth` and a real JWT cookie + lint + typecheck + build.
- **Steps:** `src/routes/ma-templates.ts` mounted as `/ma-templates` behind `requireAuth`: `GET` (templates + assignments; creates an empty "Default" when the user has no default), `POST`, `PUT /:id` (name and/or averages), `PUT /:id/default` (one transaction: unmark the old default, mark the new — the rule the dropped partial index would have kept), `DELETE /:id` (`409` for the default; the brokers' rows cascade), `PUT /assignments` (`templateId` sets, `null` clears back to the default). Every query scoped to the user; a template of another user answers `404`. Validation: name 1–40 characters (trimmed); each average `type` ema/sma, `period` a whole number ≥ 1 with no upper limit, `color` `#rrggbb`, `style` solid/dashed/dotted, `width` 1–3, unique `id`. After each write `ma_templates` goes over the WebSocket to that user's clients (`ws.broadcastMaTemplates`, wired in `index.ts` like the alert broadcasters).
- **Tests:** 10 new in `ma-templates.test.ts` (validation of every field incl. period 1 and 5 000 accepted and 0 / 2.5 refused, name rules, 401, list with the default created, create + notify, update scoped to the user + 404 + 400 with nothing to change, default moved in one transaction, default not deletable + delete, assignment set / cleared / 404). Full suite 201 tests green. `pipe-reader.test.ts` (real named pipe, timing) failed once in the full run and passed 3 of 3 alone and in the next full run: intermittent, not touched by this task.
- **Outcome:** ✅
- **Est vs Actual:** 2.5 SP · 1.25 SP.
