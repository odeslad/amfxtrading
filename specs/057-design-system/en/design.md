# 057 — Design system · Design

## Approach

1. Fix the tokens (`styles/variables.css`) so every value the components need exists once.
2. Build the components in `shared/ui/`, one folder per component (`Button/Button.tsx` + `Button.module.css` + `index.ts`), functional, strictly typed, named exports, CSS Modules using only tokens. No new dependencies.
3. Migrate Settings tab by tab onto them; each tab's CSS module loses every rule a component now covers.
4. The other screens (journal, stats, book, chart, dashboard, login, app shell) migrate in later specs, one per screen, using only this set.

The unified variant of each component is the one marked ★ on the approved mockup; every decision below comes from it.

## Tokens (`styles/variables.css`)

| Change | Today | After |
|---|---|---|
| Secondary text | `--muted` #666 (3.4:1 on --surface) | `--muted` **#8a8a8a**; new `--disabled` #666 |
| Placeholder | #333 / #444 / #666 | `--placeholder` #444 |
| Tints | 13 alpha values | `--tint-orange` rgba(245,166,35,.15) · `--tint-green` rgba(76,175,132,.15) · `--tint-red` rgba(224,92,92,.15) · `--tint-blue` rgba(58,123,213,.18) · `--tint-hover` rgba(255,255,255,.03) · `--tint-active` rgba(255,255,255,.06) · `--tint-selected` rgba(245,166,35,.08) · `--tint-warning` rgba(200,168,64,.08) · `--tint-error` rgba(224,92,92,.08) |
| Backdrop | .5 / .6 | `--backdrop` rgba(0,0,0,.5) |
| Heights | 20…48 (10 values) | `--h-sm` 27px · `--h-md` 34px · `--h-lg` 48px · `--h-touch` 44px |
| Disabled | opacity .3/.35/.4/.5 | `--disabled-opacity` .4 + `cursor: not-allowed` |
| Focus | none on buttons/toggle | `--focus-ring` 1px solid var(--orange), offset 2px, on `:focus-visible` of every control |
| Panel width | 320/340/380/420 | `--panel-w` 320px · `--panel-w-wide` 420px |
| Shadow | only context menu | `--shadow-menu` 0 8px 24px rgba(0,0,0,.5) for Menu and Popover |
| `--text-3xl` | 24px (CLAUDE.md says 28) | stays 24px; CLAUDE.md corrected |

Off-scale values (7px, 15px, 22px, weight 600, #555, #121212, rgba .2/.5/.6) disappear as each screen migrates.

## Components (`shared/ui/`)

Values are those of the ★ variant on the mockup.

| Component | Unified spec | Props (main) |
|---|---|---|
| **Tabs** | padding 12px 24px; 10px 0.2em uppercase; `--muted`, hover `--text`; active `--blue` + 2px underline. Mobile: flex 1, 12px 4px, 13px 0.06em, active `--tint-blue` fill. Long/short label. Right slot for page actions. | `tabs: {id, label, shortLabel?}[]`, `active`, `onChange`, `actions?` |
| **Section** | bordered panel: `--surface`, 1px `--border`; header 12px 16px + bottom border; title 9px 0.12em uppercase `--muted`; optional description 11px, actions on the right | `title`, `description?`, `actions?`, `children` |
| **Row** | flex space-between, gap 16px, padding 12px 0, bottom border; label 11px 0.06em; hint 9px `--muted` mt 4px. Mobile: stacked, gap 6px (`inline` keeps it in a row) | `label`, `hint?`, `inline?`, `children` |
| **Card** | 10px 12px, 1px `--border`, `--surface`; title + actions; `accent` (left 3px green/red/gold) and `expandable` (mobile list card: summary 10px 5px, border-top .18, 2px blue left when open, fields mono 16px) | `title?`, `actions?`, `accent?`, `expandable?` |
| **Toolbar** | flex space-between, gap 8px; buttons `sm`; mobile full width | `start`, `end` |
| **FieldLabel** | 9px 0.12em uppercase `--muted`; field column gap 6px | `htmlFor`, `children` |
| **Select** | h 27 (`sm`) or 34 (`md`); `--bg`, 1px `--border-bright`, mono 11px; custom arrow at 10px; focus border `--orange`. Mobile 44px, 16px | native `select` props + `size` |
| **TextInput** | same box as Select, padding 0 10px, placeholder `--placeholder`; `invalid` → red border | native props + `size`, `invalid?` |
| **NumberInput** | TextInput, no spinners, right-aligned, optional unit (mono 11px `--muted`, ml 6px) | + `unit?` |
| **DateInput** | existing `DateField` + `Calendar` restyled on these tokens (icon 36px, selected orange, today blue, mobile sheet) | unchanged |
| **Toggle** | track 36×20 r10, off `--border-bright`, on `--orange`; thumb 14px white; focus ring | `checked`, `onChange`, `disabled?`, `label` |
| **Checkbox** | native, `accent-color: --orange`, 16px (mobile 22px), label 11px gap 8px | native props + `label` |
| **Segmented** | joined, 1px `--border-bright`; buttons min-w 52px, 0 10px, mono 10px `--muted`; on `--orange` + #000; `tone` for buy/sell (green/red fill) | `options`, `value`, `onChange`, `size`, `tone?` |
| **ColorPicker** | swatch 28px r2 (mobile 44) + popover `--surface2` grid 4×20px; active cell white border | `value`, `onChange`, `palette?` |
| **Button** | sizes sm 27/0 10px/9px · md 34/0 14px/11px · lg 48/full/13px; 0.12em uppercase, radius 0. Variants primary · buy · sell · outlined (hover text+border `--text`) · buy-outline · edit (orange-outline) · danger-outline · ghost · dashed; outline hover fill = tint .15 | `variant`, `size`, native props |
| **IconButton** | 27px (mobile 44), transparent, 1px `--border-bright`, `--muted` → `--text`; `bare` variant (panel close ×, no border); `aria-label` required | `icon`, `label`, `variant?`, `tone?` |
| **Chip** | h 27, 0 10px, r2, mono 11px `--muted`, 1px `--border-bright`; on: `--orange` text/border + `--tint-selected`; `removable` (×), `locked` (gold border) | `selected?`, `onRemove?`, `locked?` |
| **Table** | th 9px 0.3em uppercase `--muted`, padding 0 12px 8px; td 8px 12px; first column flush; row hover `--tint-hover`; numeric column right-aligned; row actions revealed on hover (bg `--bg`, 0.18s). ≤768: renders each row as an expandable Card | `columns` (key, label, align, sortable, render), `rows`, `rowActions?`, `card?` |
| **SortableHeader** | inside Table; arrow 9px (was 7px) | via `columns.sortable` |
| **Pager** | 10px 16px, top border; buttons outlined sm (`--muted`); info mono 11px; mobile 44px | `page`, `pages`, `onChange`, `info` |
| **Badge** | 2px 8px, 9px 0.12em uppercase, 1px border; tones green/muted/gold/red/blue | `tone`, `children` |
| **StatusDot** | 8px; ok/off/busy (pulse 0.7s)/muted; `attention` 5px orange | `state` |
| **ProgressBar** | 3px, track `--border`, fill `--orange` (tone for gauges), width 0.2s | `value`, `tone?` |
| **Gauge** | `--surface`, padding 16px, label 9px 0.2em → 0.12em, value mono 20px + unit 12px, 4px bar by threshold | `label`, `value`, `unit`, `tone` |
| **StatTile / StatStrip** | strip `--surface` 1px border 12px 0; tile 0 20px, left divider; label 9px; value mono 16px (`big` 20px). Mobile block grid; net 24px (was 22) | `label`, `value`, `tone?`, `big?` |
| **Legend** | mono 11px `--muted` 0.06em; clickable items `--orange`; swatch 10×2 | `items` |
| **EmptyState** | 40px 0, centred, 11px `--muted` 0.06em | `children` |
| **Loading** | EmptyState box on `--surface`, mono 11px "Loading…" (no spinner, as today) | `label?` |
| **SidePanel** | the panel shell copied in 8 files: fixed right, `--panel-w`, `--surface`, left border .18, slide 0.2s; header 16px 20px, title 10px 0.3em; body gap 16px padding 20px; footer; backdrop `--backdrop`. Mobile: full width from the topbar (40px) up; `docked` mode = today's DockedPanel (50dvh sheet) | `open`, `title`, `onClose`, `width?`, `docked?`, `footer?` |
| **ConfirmDialog** | SidePanel + mono 14px description + lg buttons (confirm red / cancel outlined). Replaces the Journal modal | `title`, `description`, `confirmLabel`, `tone`, `onConfirm`, `onCancel` |
| **Menu / Popover** | `--surface2`, 1px `--border-bright`, padding 4px 0, `--shadow-menu`; item 7px 12px, sans 11px, hover .06; title mono 10px; sections with top border; tones buy/sell/danger; mobile item 44px | `items`, `anchor` |
| **FilterPanel** | SidePanel + FieldLabel/inputs md + reset button; inline variant for Stats | composition |
| **Toast** | existing `Toaster` moved to `shared/ui`, unchanged | — |
| **Hint** | 11px `--muted`; tones warning (gold), error (red); `boxed` (1px border + tint, 12px) | `tone?`, `boxed?` |

App-shell pieces (topbar, sidebar, bottom nav, footer) stay in `app/layout`; they only switch to the new tokens when their screen migrates.

## Settings migration (this spec)

| Tab | Files | Components it moves to |
|---|---|---|
| Page | SettingsPage.tsx | Tabs (+ actions slot for Save), EmptyState |
| Mirror | MirrorTab, QuickOrdersSection | Chip (presets), Table, Select, NumberInput, Toggle, Segmented, Section, Button |
| Display | DisplayTab, MaTemplatesSection | Section, Row, Select, NumberInput, ColorPicker, Toggle, Segmented, Card, Button, Hint |
| Notifications | NotificationsTab, NotificationPanel, DevicesPanel | Table (+cards), Badge, SidePanel, Segmented, Chip, DateInput, Button, Hint |
| Visibility | VisibilityTab, SymbolsPanel | Table, Toggle, Chip (on / locked), SidePanel, Badge, Button |
| Data | DataSyncTab | Section (accent by state), Table, Checkbox, NumberInput, ProgressBar, StatusDot, Button |
| Server | ServerTab, ServerCharts | Gauge, Section, Table, Badge, StatusDot, Segmented (24h/7d), Legend, Loading, IconButton |

Kept as local CSS: the server charts canvas and resizer, and grid layouts specific to a tab. Save buttons, endpoints and values do not change.

## Files

- `frontend/src/styles/variables.css` — tokens above.
- `frontend/src/shared/ui/<Component>/` — new components; `shared/ui/index.ts` re-exports them.
- `frontend/src/shared/ui/DateField`, `Calendar`, `DockedPanel` — restyled / folded into SidePanel.
- `frontend/src/components/Toaster.*` → `shared/ui/Toast/`.
- `frontend/src/features/settings/*` — migrated; CSS modules shrink to local layout.
- `.claude/CLAUDE.md` — design-system section updated (tokens, components, `--text-3xl` 24px).

## Risks

- `--muted` changes from #666 to #8a8a8a everywhere at once, also in screens not migrated yet: secondary text becomes lighter app-wide. Intended (legibility), but it is visible beyond Settings.
- Shared components imported by not-yet-migrated screens (`DateField`, `DockedPanel`, `Toaster`) keep their API so those screens keep working.
- Visual regressions inside Settings: checked tab by tab against the mockup and production before closing.

## Mockup

Approved: https://claude.ai/artifact/8CZHLrWp7VP8SpaQWXXLJx (★ = unified variant)

1. Tokens, tabs, buttons
2. Inputs, choices, chips
3. Data
4. Structure, panels, menus, feedback
5. Mobile
