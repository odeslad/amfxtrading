# 060 — Split chart links · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: frontend only.

- [x] 1. [frontend] Right-side broker and pair with one link: `SplitState` fields, derived right values, per-side selector handlers, `useChartSymbols` per side, link button in `ChartToolbar` (`IconLink` / `IconUnlink`), "broker does not offer the pair" state in `ChartSlot` · **Verify:** `npm run build` + local app (desktop, split): linked as today; unlink → each side picks its own broker and pair; relink → right takes the left broker and pair; a linked pair missing in the right broker shows the notice; reload keeps the link and selections; not split → unchanged; journal double click moves the left side and the linked parts of the right · **Est:** 2.5 SP
- [x] 2. [frontend] Side-bound panels: indicators, alerts, new trade and chart alerts open and filter for the side that asked (`panelSide`) · **Verify:** `npm run build` + local app: with two different pairs, open each panel from each side → it shows that side's broker and pair; an alert created from the right side belongs to its pair · **Est:** 1.5 SP
- [x] 3. [infra] Push `master`, deploy the frontend when the user asks, and **validate on production**: linked and unlinked as in the mockup, relinking, the "not offered" notice, panels from each side, journal double click, reload · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [x] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 4.75 SP
