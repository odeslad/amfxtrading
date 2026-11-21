# 057 — Design system

> Status: **draft**

## Context
Settings has six tabs (Mirror, Display, Notifications, Visibility, Data, Server) and every block draws its own controls: about 4 850 lines across 13 components and 11 CSS modules, with headings, rows, toggles, selects, tables and buttons styled again in each one. The same control looks different from one tab to the next. `shared/ui/` only holds the calendar, date field, docked panel and icons. This spec builds one set of shared components and moves every current tab onto them, without changing where anything is or what it does. Spec 058 (reorganising Settings into six sections with a side menu, mobile navigation and autosave) comes next and is built only from these components.

## Affected layers
- frontend

## User stories
- As the operator, I want every part of Settings to look and behave the same, so that I recognise each control at a glance.
- As the developer, I want one component per kind of control, so that a style change is made once and new settings need no CSS of their own.

## Acceptance criteria
- AC 1. WHEN the components are built THEN `shared/ui/` holds one component for every kind of element Settings uses today:
  - **Layout**: **Tabs** (the tab bar, with its long and short labels), **Section** (a block with its title, description and actions), **Row** (label on the left, control on the right, optional hint), **Card** (a framed item with title, content and actions; the setup-level, template, rule, device and machine cards), **Toolbar** (a row of actions above a list).
  - **Inputs**: **Toggle** (switch), **Checkbox**, **Segmented** (one choice among a few buttons), **Select**, **TextInput**, **NumberInput** (no spinners, optional unit), **DateInput** (the existing `DateField` with its `Calendar`, restyled to match the other inputs), **ColorPicker** (swatches).
  - **Actions**: **Button** (the project's variants and sizes), **IconButton** (close, edit, delete, collapse; with `aria-label`), **Chip** (a selectable or removable item, such as the preset chips).
  - **Data**: **Table** (table on desktop, cards on mobile), **Badge** (state labels: stale, crashes, unsaved, default), **StatusDot** (online / offline / pending), **ProgressBar** (sync progress), **Gauge** (the server's CPU, memory and disk meters).
  - **Feedback and overlays**: **EmptyState**, **Loading**, **Modal** (backdrop + panel, as the devices panel), **ConfirmDialog** (confirm / cancel), **Sheet** (mobile bottom sheet), **Popover** and **Menu** (the chart's context menu, the journal's "older" menu), **Toast** (the existing `Toaster`), **Hint** (help or warning text under a control).
  - **Lists and analysis** (journal, stats, book): **SortableHeader** (table column that sorts), **Pager**, **FilterPanel** (the journal's filter panel, with its chips and ranges), **StatTile** (a KPI: label + big value), **Legend** (clickable chart legend).
  The set covers every kind of element used anywhere in the app (settings, journal, stats, book, chart, dashboard, auth), so the screens that adopt it later need nothing new. Any other kind found while migrating is added to this set, never drawn inside a screen.
- AC 2. WHEN any component is drawn THEN it uses only the variables of `styles/variables.css` (no colour, size or spacing written by hand) and follows the design system of `.claude/CLAUDE.md`.
- AC 3. WHEN the six tabs are migrated THEN every heading, row, toggle, choice, select, input, colour, table and button in Settings is one of those components; the Settings CSS modules keep only layout that no component covers (the server charts, for instance).
- AC 4. WHEN the operator uses any tab after the migration THEN it shows the same settings in the same place and saves them exactly as before (same Save buttons, same endpoints, same values).
- AC 5. WHEN Settings is opened on a phone (≤768 px) THEN every row stacks label over control, tables become cards and touch targets are at least 44 px.
- AC 6. WHEN a control is used with the keyboard THEN it is a real `button`, `input`, `select` or `label`, reachable with Tab and with a visible focus in `--orange`.

## Out of scope
- Moving settings between tabs, the six new sections, the side menu, mobile navigation and autosave (spec 058).
- Migrating the other screens (journal, stats, book, chart, dashboard, login): one follow-up spec each, built only from this set.
- Any backend or data change.
