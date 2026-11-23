# 061 — Login sizing · Design

> Status: **closed**

## Approach

`LoginPage` keeps its logic and drops its own controls: the fields become `Field` + `TextInput` and the button `Button` (`shared/ui`), all in the large size. Its CSS module keeps only the page, the card, the brand lines and the error line.

## Design system: a large input

`TextInput` / `NumberInput` / `Select` have `sm` and `md` today; the project's design system already specifies a large input (`height 48px`, `padding 0 16px`) that was never built. `ControlSize` gains `lg`:

| Size | Desktop | Phone (≤ 768 px) |
|---|---|---|
| `lg` (new) | 48 px (`--h-lg`), padding `0 16px`, text 14 px (`--text-lg`) | 48 px, text 16 px (`--text-xl`), so iPhone Safari does not zoom |

`Button size="lg"` already exists (48 px, full width, 13 px; 16 px on a phone).

## Page

| | Desktop | Phone |
|---|---|---|
| Card | 400 px, padding `48px 40px 40px` | full width minus 16 px each side, padding `40px 24px 32px` |
| Fields | `Field` + `TextInput size="lg"` (email / password, autocomplete, required) | same |
| Error | the existing line under the fields (`--red`, kept 16 px tall so nothing jumps) | same |
| Button | `Button variant="primary" size="lg" type="submit"`, "Signing in…" while waiting | same |

The autofill rule that keeps the dark background moves to the shared input (`.control:-webkit-autofill`), so every field of the app gets it.

## Files

| File | Change |
|---|---|
| `frontend/src/shared/ui/Input/controlClasses.ts`, `Input.module.css` | `lg` size; autofill rule |
| `frontend/src/features/auth/LoginPage.tsx`, `LoginPage.module.css` | shared controls, sizes per breakpoint |
| `frontend/src/dev/UiCatalogPage.tsx` | the `lg` input in the catalog |

No backend change; authentication untouched.

## Mockup

https://claude.ai/artifact/FDZcXNA4dC2m6iVZbak3XV (approved): **Desktop** and **Phone** artboards.

## Risks

- `Button` must accept `type="submit"` (it passes the native button props through; checked during the task).
