# 052 — Moving average templates per broker · Verification

## Task 1 · [db] Template tables and data migration

- **Mechanism:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` from production through the SSH tunnel; the migration run on production inside a transaction rolled back at the end.
- **Steps:** migration `20261119100000_ma_templates`: `ma_templates` (`userId` FK, `name`, `isDefault`, `averages` JSONB, timestamps, index on `userId`), `ma_template_brokers` (PK `userId` + `broker`, `templateId` FK on delete cascade), and an `INSERT … SELECT` turning each `chart_indicators.emas` into a default template "Default" with `type: 'ema'` added to every average. Models `MaTemplate`, `MaTemplateBroker`.
- **Production's data:** one row (user 1): EMA 24 (#e05c5c, solid, 2), EMA 48 (#3a7bd5, solid, 2), EMA 288 (#4caf84, dotted, 1), EMA 576 (#f5a623, dotted, 1).
- **Rolled-back run on production:** tables created; one template "Default", `isDefault` true, the four averages with their ids, colours, styles, widths and periods unchanged and `"type": "ema"` added; after `ROLLBACK` `ma_templates` does not exist.
- **Change during the task:** the first version had a partial unique index (one default per user). It worked (a second default was refused), but Prisma 5 cannot express it, so `prisma migrate diff` against production would never be empty again; it was removed and the rule moves to the routes (task 2, in a transaction). The diff now holds exactly the migration's tables, index and foreign keys (the data `INSERT` is not schema).
- **Outcome:** ✅
- **Est vs Actual:** 1 SP · 0.75 SP.
