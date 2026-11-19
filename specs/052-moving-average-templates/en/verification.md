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

## Backend deploy (part of task 7, done early so the chart can be checked against real data)

- **2026-11-19:** `7b335a4`, `9511462`, `3acb4a7` pushed alone (`backend/` and `specs/`); backend pipeline green, restarted. On production: migration `20261119100000_ma_templates` applied; `ma_templates` holds template 1 "Default", default, 4 averages, the first of type `ema`. The deployed frontend keeps using `/chart-indicators`, untouched.

## Task 3 · [frontend] Templates and SMA in the chart

- **Mechanism:** `npm run build` + eslint; local check at `https://local.amfxtrading.com:5174` with Vite proxied to the production API.
- **Steps:** `chart.types.ts`: `MovingAverage` with `type: 'ema' | 'sma'` (replaces `Ema`). `LightweightChart.tsx`: `calcSma` (rolling sum) beside `calcEma`, both over the same valid candles; the live candle takes one EMA step, or for an SMA the last `period − 1` closed closes plus the live close, so the point does not jump when the candle closes. `src/lib/useMaTemplates.ts`: loads `/ma-templates`, reloads on the WS `ma_templates`, `templateFor(broker)` (assigned, else default), `averagesFor(broker)` without the averages hidden on the device (`localStorage` `chart.maHidden`). `ChartPage` / `ChartSlot`: each slot draws `averagesFor(its broker)`; the `/chart-indicators` load and save removed. `IndicatorsPanel`: the broker's template with a show/hide checkbox per average (the template select and the Settings link come in task 4). The colour picker and palette moved to `ColorPicker.tsx` and `movingAverages.ts` (with `maLabel`, "EMA 24") for the Settings editor.
- **Operator check (2026-11-19):** charts show the same four EMAs (24, 48, 288, 576) with their colours and styles; the panel lists "Default" and the four averages; hiding one removes it and it stays hidden after a reload; split view fine.
- **Pending:** an SMA on the chart can only be added once the Settings editor exists — checked in task 5.
- **Outcome:** ✅ (SMA check in task 5)
- **Est vs Actual:** 3 SP · 1.5 SP.

## Task 4 · [frontend] Template of the broker from the chart

- **Mechanism:** `npm run build` + eslint; operator's local check against production.
- **Steps:** `IndicatorsPanel`: "Template for <broker>" select (every template, "Default (★ name)") calling `PUT /ma-templates/assignments`; the template's averages with show/hide; link "Edit in Settings › Display" to `/settings?tab=display` (`SettingsPage` now opens the tab named in the address). In the code the split view shares one broker between its two sides (only the timeframe differs), so AC 8 (two brokers side by side) cannot occur today; each side still resolves its own template.
- **Operator check (2026-11-19):** assigning a new template to a broker from the chart redrew that chart at once; the link opens Settings › Display.
- **Outcome:** ✅
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Task 5 · [frontend] Templates section in Settings › Display

- **Mechanism:** `npm run build` + eslint; operator's local check against production (writes real templates).
- **Steps:** `MaTemplatesSection` at the end of `DisplayTab`: list (★ default, averages count, brokers using it), editor (EMA/SMA toggle, period without spinners and marked red when not a whole number ≥ 1, colour picker, style, width, remove, add), *New template*, name, *★ Make default*, *Delete* with `ConfirmPanel` naming the brokers that fall back to the default, *Save template* (enabled only with changes and valid periods); on a phone a template select and cards. The edit in progress is held per template and the saved template shown otherwise (React's lint forbids copying props into state in an effect).
- **Operator check (2026-11-19):** a new template with an SMA 50 and an EMA 9 saved and assigned from the chart; the SMA drawn smoother than the EMA and moving with the live candle without jumping at its close; a change saved in Settings reached a chart open in another tab without reloading; deleting the template in use named the broker and returned its chart to the four EMAs of the default.
- **Change asked after this check:** a template per broker **and timeframe** (AC 12) — tasks 6 to 8 added.
- **Outcome:** ✅
- **Est vs Actual:** 3 SP · 1.5 SP.

## Task 6 · [db] Assignment per timeframe

- **Mechanism:** `prisma validate` + `prisma generate`; `prisma migrate diff` from production; dry run on production in a rolled-back transaction.
- **Steps:** migration `20261119200000_ma_template_timeframes`: `timeframe` text not null default `''` (every timeframe), key `(userId, broker, timeframe)`.
- **Outcome:** ✅ the diff is exactly the migration's `ALTER TABLE`; the dry run adds the column (production had no assignment then). The commit alone does not build (the route still used the old key); task 7's commit, right after, does.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 7 · [backend] Assignments with a timeframe

- **Mechanism:** vitest + lint + typecheck + build.
- **Steps:** `GET /ma-templates` returns `assignments` as `[{ broker, timeframe: string | null, templateId }]`; `PUT /assignments` takes an optional `timeframe` (M1, M5, M15, M30, H1, H4, D1, W1, MN; absent or `null` = every timeframe).
- **Tests:** list shape; broker-wide set and clear; one timeframe set and clear; `H2` refused `400`. Full suite 202 green.
- **Deploy (2026-11-19):** the local `master` had the frontend commits of tasks 3–5 before these two, so they were cherry-picked onto `origin/master` in a temporary worktree and pushed alone (backend pipeline only); migration applied, `ma_template_brokers` has `timeframe`.
- **Outcome:** ✅
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Task 8 · [frontend] Template per broker and timeframe

- **Mechanism:** `npm run build` + eslint; operator's local check against production.
- **Steps:** `useMaTemplates`: assignments as a list, `templateFor(broker, timeframe)` and `sourceOf` (broker + timeframe → broker → default), `assign(broker, timeframe | null, templateId | null)`. Each chart slot opens the indicators button with its own timeframe. Panel: "Only on <timeframe>" — ticking keeps the template on screen for that timeframe only, unticking returns the timeframe to the broker's template; with it ticked the select's empty option is "Same as <broker>". Settings list shows "FTMO · H1" for timeframe assignments. At the operator's request: more space above the checkbox and no source line.
- **Operator check (2026-11-19):** a template on FTMO M15 only (SMA 200, SMA 800), FTMO's other timeframes on their own template, another broker on the default, unticking back to the broker's template, split view with two timeframes, Settings listing the timeframe assignment.
- **Outcome:** ✅ AC 3, 9, 12.
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 9 · [docs] Project guidelines and backend architecture

- **Mechanism:** manual — both documents agree.
- **Steps:** `backend/docs/architecture.md`: router `/ma-templates` and `/chart-indicators` marked unused, WS `ma_templates`, section "Moving average templates (spec 052)" (default rule, assignment per broker and timeframe with its fallback, cascade, validation, Settings › Display and the chart button, SMA in the frontend, spec 053 pending), tables `ma_templates` and `ma_template_brokers`, `chart_indicators` marked for removal. `.claude/CLAUDE.md`: section "Plantillas de medias móviles (spec 052)", 20 routers, models `MaTemplate` and `MaTemplateBroker`.
- **Outcome:** ✅
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 10 · [infra] Deploy and production validation

- **Pushes (2026-11-19), one layer at a time:** backend `7b335a4`…`3acb4a7` (task 2) and `cdbcac3` + `e2bf080` (tasks 6–7, from a worktree); frontend `6ed372f`…`276b61d` alone (build 283); docs `4f4b922` (task 9) (backend pipeline, no code change). Every pipeline green.
- **Operator validation on `amfxtrading.com`, desktop and phone:** charts unchanged with the default template (AC 6); templates section in Settings › Display; template chosen from the chart, per broker and only for a timeframe; an SMA drawn and following the live candle; Settings changes reaching an open chart; phone layout.
- **Outcome:** ✅ AC 1–12 (AC 8: the split view shares one broker, see task 4).
- **Est vs Actual:** 1 SP · 1 SP (the reorder to push the backend alone).

## Task 11 · [backend] Old route removed

- **Mechanism:** lint + typecheck + tests + build; search of `frontend/` and `backend/`.
- **Steps:** `routes/chart-indicators.ts` deleted and its mount removed from `app.ts`; nothing in `frontend/src` called `/chart-indicators` any more.
- **Outcome:** ✅ 202 tests green.
- **Est vs Actual:** 0.25 SP · 0.1 SP.

## Task 12 · [db] Old table dropped

- **Mechanism:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` from production.
- **Steps:** migration `20261119300000_drop_chart_indicators` (`DROP TABLE "chart_indicators"`); model `ChartIndicators` and the `User.chartIndicators` relation removed. Pushed together with task 11: the deploy applies the migration before starting the new code, which no longer reads the table.
- **Outcome:** ✅ the diff from production is only the table and its foreign key, both removed by the `DROP TABLE`.
- **Est vs Actual:** 0.5 SP · 0.15 SP.
