# 058 — Settings reorganisation · Design

## Approach

Frontend only. Settings keeps its data hooks and endpoints; what changes is (1) how the screen is split and navigated and (2) when things are saved.

1. **Sections instead of tabs.** `SettingsPage` becomes a shell: a side menu (desktop) or a section list (mobile) plus the selected section. Each section is a small component that composes the subsection blocks, which are carved out of today's tab components without changing their logic.
2. **Autosave.** A `useAutosave` hook saves a value a short time after its last change, validates first, retries on demand and reports a status. Every saved area uses it; a page-level indicator shows the combined status.
3. **Two new shared components** (spec 057 rule: new kinds go to `shared/ui`): `NavList` and `SaveStatus`.

## Sections and where each block comes from

| Section (`?section=`) | Subsections (each a `Section`) | Comes from |
|---|---|---|
| Trading (`trading`) | Mirror presets · Quick orders · New trade (setup levels) | MirrorTab, QuickOrdersSection, DisplayTab (setup levels) |
| Chart (`chart`) | P&L · Drawings · Price | DisplayTab (General, Drawings, Price) |
| Indicators (`indicators`) | Moving average templates · Cross trades (+ SL / TP labels) | MaTemplatesSection, DisplayTab (EMA cross trades) |
| Alerts & notifications (`alerts`) | Rules · Devices | NotificationsTab + NotificationPanel, DevicesPanel (its content shown inline as a subsection) |
| Brokers & data (`brokers`) | Brokers & pairs · Candle history | VisibilityTab + SymbolsPanel, DataSyncTab |
| System (`system`) | Server | ServerTab + ServerCharts |

`DisplayTab` is split into `ChartSettings`, `CrossTradesSettings` and `SetupLevelsSettings`; `DevicesPanel` becomes `DevicesSection` (same hook, rendered inline, the "Enable this device" box and the device list unchanged). The "+ New notification" button moves into the Rules section header.

**Old links:** `?tab=` maps to a section — `mirror → trading`, `display → chart`, `notifications → alerts`, `visibility → brokers`, `data → brokers`, `server → system`. The chart's indicators button is updated to `?section=indicators`.

## Navigation

- **Desktop (> 768 px):** `NavList` vertical, 220 px, `--surface`, items 10px 16px, 11px 0.12em uppercase `--muted`; current item `--text`, left 2px `--orange`, `--surface2` background, `aria-current="page"`. Content: section title (13px 0.2em) + `SaveStatus` on the right, then the subsections, gap 16px.
- **Mobile (≤ 768 px):** without `?section` the page shows `NavList` in list mode (each row: title + one-line summary of its subsections, chevron, min-height 64px). With a section, the page shows a header with a back `IconButton` (to `/settings`), the title and `SaveStatus`, then the subsections. Browser back works because the section is in the URL.

## Autosave

```ts
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error';
useAutosave<T>(value: T, opts: { save: (v: T) => Promise<void>; validate?: (v: T) => string | null; delayMs?: number; enabled?: boolean })
  → { state: SaveState; error: string | null; retry: () => void }
```

- Debounce 800 ms after the last change; nothing is saved on the first render (only real changes).
- One save at a time: a change made while saving is saved right after, with the latest value (no lost or out-of-order writes).
- `validate` returning a message → state `invalid`, no request; the field shows its own error as today.
- Failure → state `error` with the message and `retry()`; the value stays on screen.
- `saved` fades back to `idle` after 3 s.

Uses:

| Area | Value | Save | Validation |
|---|---|---|---|
| Settings form (presets, quick orders, display, setup levels, cross trades, visibility) | the current `PUT /settings` body | `PUT /settings` (unchanged); returned preset ids merged into the form without remounting inputs | `quickOrdersError`; empty preset name |
| Candle targets | `candleSync.edits` | `candleSync.saveTargets` | 100 – 50 000 |
| MA template being edited | the draft | `PUT /ma-templates/:id` | name not empty, periods ≥ 1 |

Explicit actions stay as buttons because they are not edits of a value: Save to EA (pairs), Sync selected (candles), create / delete / make default (templates, presets), create / edit / pause / delete (notification rules, saved from their panel), enable / remove (devices). The page-level `SaveStatus` shows the worst state of the three autosaves (error > invalid > saving > pending > saved).

**Unsaved Save buttons removed:** Settings Save, "Unsaved changes", Save targets, "Unsaved targets", Save template.

## New shared components

- `NavList` — `items: { id, label, summary? }[]`, `current`, `onSelect`, `mode: 'menu' | 'list'`; links are `<a href="?section=…">` so they open in a new tab too.
- `SaveStatus` — `state`, `error`, `onRetry`; mono 10px: pending "Unsaved…" `--muted`, saving "Saving…" `--muted`, saved "● Saved" `--green`, invalid "Not saved · fix the highlighted field" `--gold`, error message `--red` + Retry (`Button` edit sm). `role="status"`, `aria-live="polite"`.

## Files

- `frontend/src/shared/ui/NavList/*`, `SaveStatus/*`, `index.ts` — new components.
- `frontend/src/lib/useAutosave.ts` — the hook (+ unit test if the frontend has a test runner; otherwise checked in the catalog page).
- `frontend/src/features/settings/SettingsPage.tsx` — shell: section from the URL, nav, header, section switch; autosave of the settings form.
- `frontend/src/features/settings/sections/` — `TradingSection.tsx`, `ChartSection.tsx`, `IndicatorsSection.tsx`, `AlertsSection.tsx`, `BrokersDataSection.tsx`, `SystemSection.tsx`.
- `DisplayTab.tsx` → `ChartSettings.tsx`, `CrossTradesSettings.tsx`, `SetupLevelsSettings.tsx`; `DevicesPanel.tsx` → `DevicesSection.tsx`; `MirrorTab.tsx`, `VisibilityTab.tsx`, `DataSyncTab.tsx`, `MaTemplatesSection.tsx` lose their own save controls.
- `frontend/src/lib/useCandleSync.ts`, `MaTemplatesSection.tsx` — wired to `useAutosave`.
- The chart's indicators button link (`?tab=display` → `?section=indicators`).
- `frontend/src/dev/UiCatalogPage.tsx` — NavList and SaveStatus states.

## Risks

- **Write frequency:** autosave sends `PUT /settings` more often (one per pause in typing). The body is small and the endpoint idempotent; 800 ms debounce keeps it to a handful per edit.
- **Preset ids:** a new preset gets its id from the first save; the hook merges ids by position without replacing the form, so typing in the name never loses focus.
- **Invalid quick orders block the whole settings save** (they share `PUT /settings`): the indicator says "Not saved" until it is fixed. Accepted to keep one save path; alternative (save the rest with the last valid quick orders) adds state for little gain.
- **Leaving with a pending change:** a pending save is flushed on unmount / section change, and `beforeunload` warns only while a save is pending or failed.

## Mockup

Approved: https://claude.ai/artifact/Fa5DxGrdRfDiW8TfzCGJ9Y

1. Desktop · Trading
2. Desktop · Brokers & data
3. Autosave states
4. Mobile · Sections
5. Mobile · Chart
