# 061 — Login sizing

> Status: **closed**

## Context

The login page (`features/auth/LoginPage`) is the same on desktop and phone: a 360 px card, fields 29 px tall with 11 px text and a 34 px button. On a phone the controls are below the 44 px touch size the app uses, and iPhone Safari zooms the page when a field with text under 16 px gets the focus. The page also draws its own inputs and button instead of the shared design system (spec 057 left the login to be migrated in its own spec).

## Affected layers

- frontend

## User stories

- As an operator signing in on a phone, I want fields and button big enough to tap, and no zoom when I type.
- As an operator on desktop, I want a login that reads comfortably on its own, in the app's style.

## Acceptance criteria

- AC 1. WHEN the login opens on desktop THEN the card is about 400 px wide and the fields and button use the large size of the design system (48 px tall).
- AC 2. WHEN the login opens on a phone (≤ 768 px) THEN the card spans the width with a margin, fields and button are 48 px tall, and the field text is 16 px, so iPhone Safari does not zoom on focus.
- AC 3. The page is built with the shared `Field`, `TextInput` and `Button` (`shared/ui`); no control of its own.
- AC 4. Behaviour does not change: email and password required, the error under the fields, "Signing in…" while waiting, return to the page that asked for the login, autofill keeps the dark background.

## Out of scope

- Changes to authentication (cookie, JWT, endpoints).
- "Forgot password" or other new options.
