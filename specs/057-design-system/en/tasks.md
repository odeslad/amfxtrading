# 057 — Design system · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only (no backend, db or EA change); one frontend deploy when the user asks for it.

Component tasks are verified on a dev-only catalog page (`/dev/ui`, built only when `import.meta.env.DEV`) that shows every component and state next to the approved mockup.

- [x] 1. [frontend] Tokens in `styles/variables.css` (`--muted` #8a8a8a, `--disabled`, `--placeholder`, tints, `--backdrop`, heights, `--disabled-opacity`, `--focus-ring`, panel widths, `--shadow-menu`) and the dev-only `/dev/ui` catalog route · **Verify:** `npm run build` + `/dev/ui` opens locally and is absent from the production bundle · **Est:** 1.5 SP
- [x] 2. [frontend] Base controls: Button, IconButton, FieldLabel, TextInput, NumberInput, Select, Checkbox, Toggle (with focus ring and disabled state) · **Verify:** build + catalog vs mockup board 1–2 (sizes, variants, hover/focus/disabled) · **Est:** 3 SP
- [x] 3. [frontend] Choice controls: Segmented (with buy/sell tone), Chip (selected / removable / locked), ColorPicker, DateInput (DateField + Calendar on the new tokens, same API) · **Verify:** build + catalog vs board 2 + an existing DateField screen (book TradePanel) still works · **Est:** 2.5 SP
- [x] 4. [frontend] Structure: Tabs (long/short labels, actions slot, mobile fill), Section, Row, Card (accent, expandable), Toolbar, Hint, EmptyState, Loading · **Verify:** build + catalog vs boards 1, 4, 5 at desktop and 390 px · **Est:** 2.5 SP
- [x] 5. [frontend] Data: Table (columns, sortable header, numeric alignment, hover row actions, cards ≤768), Pager, Badge, StatusDot, ProgressBar, Gauge, StatTile/StatStrip, Legend · **Verify:** build + catalog vs board 3 and mobile board 5 · **Est:** 4 SP
- [x] 6. [frontend] Overlays: SidePanel (+ docked mode replacing DockedPanel, same API kept as a wrapper), ConfirmDialog, Menu/Popover, FilterPanel, Toast (Toaster moved to `shared/ui`) · **Verify:** build + catalog vs board 4 + chart New Trade (docked) and journal close confirm still work · **Est:** 3.5 SP
- [x] 7. [frontend] Migrate Settings page shell + Mirror tab (MirrorTab, QuickOrdersSection) · **Verify:** build + local: presets, quick orders and Save behave as before; no rule left in their CSS that a component covers · **Est:** 2.5 SP
- [x] 8. [frontend] Migrate Display tab (DisplayTab, MaTemplatesSection) · **Verify:** build + local: every display setting and MA template edit saves as before · **Est:** 3 SP
- [x] 9. [frontend] Migrate Notifications tab (NotificationsTab, NotificationPanel, DevicesPanel) · **Verify:** build + local: create/edit/pause/delete a rule, devices panel · **Est:** 3 SP
- [x] 10. [frontend] Migrate Visibility tab (VisibilityTab, SymbolsPanel) · **Verify:** build + local: broker visibility, pairs panel on/off/locked, Save to EA (against local backend with flags off) · **Est:** 1.5 SP
- [x] 11. [frontend] Migrate Data tab (DataSyncTab) · **Verify:** build + local: targets, selection, sync progress states · **Est:** 2 SP
- [x] 12. [frontend] Migrate Server tab (ServerTab, ServerCharts) · **Verify:** build + local: gauges, tables, 24h/7d, collapse · **Est:** 2.5 SP
- [ ] 13. [specs] Update the design-system section of `.claude/CLAUDE.md` (tokens, component list, `--text-3xl` 24px) · **Verify:** manual review · **Est:** 0.5 SP
- [ ] 14. [infra] Push `master` and deploy the frontend when the user asks; **validate on production**: every Settings tab on desktop and phone (same settings, same saves), focus ring with Tab, tables as cards on mobile, secondary text #8a8a8a elsewhere in the app · **Verify:** manual (user validation) · **Est:** 1 SP
- [ ] 15. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 33.75 SP
