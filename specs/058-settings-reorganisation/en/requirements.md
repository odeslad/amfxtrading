# 058 — Settings reorganisation

> Status: **draft**
> Follows: [057 — Design system](../../../archive/2026-11/057-design-system/en/requirements.md)

## Context
Settings has six tabs named after where each setting was first added (Mirror, Display, Notifications, Visibility, Data, Server), so related settings are scattered: setup levels live in Display, quick orders in Mirror, broker visibility and pairs in Visibility, candle history in Data. Saving also differs per tab: one Save for Mirror, Display and Visibility, Save targets in Data, Save template inside the MA templates, Save to EA for pairs, and instant saves elsewhere. Spec 057 rebuilt every tab on the shared design system; this spec regroups the settings by what they are for, gives Settings its own navigation and makes saving uniform.

## Affected layers
- frontend

## User stories
- As the operator, I want settings grouped by purpose, so that I find each one without remembering which tab it was added to.
- As the operator, I want every change saved as I make it, so that I never lose a change by leaving the page.
- As the operator on a phone, I want a list of sections and one page per section, so that Settings is easy to use with one hand.

## Acceptance criteria
- AC 1. WHEN Settings opens THEN it shows six sections, each with its subsections in this order:
  - **Trading**: Mirror presets · Quick orders · New trade (setup levels).
  - **Chart**: P&L · Drawings (trendlines, rectangles, Fibonacci) · Price (spread).
  - **Indicators**: Moving average templates · Cross trades (with their SL / TP labels).
  - **Alerts & notifications**: Rules · Devices.
  - **Brokers & data**: Brokers (visibility) · Pairs · Candle history.
  - **System**: Server.
- AC 2. WHEN the screen is wider than 768 px THEN a side menu lists the six sections and the selected one shows its subsections one under another, each a titled Section; the menu marks the current section.
- AC 3. WHEN the screen is 768 px or narrower THEN Settings first shows the list of sections (each with a one-line summary of its subsections) and tapping one opens its page with a back button to the list.
- AC 4. WHEN a setting changes (presets, quick orders, display settings, setup levels, broker visibility, candle targets, MA templates) THEN it is saved automatically shortly after the last change, without a Save button, and a "Saved" indicator confirms it; a change that is not valid (e.g. quick orders without a needed stop loss, a template period below 1) is not saved and shows its error where it is.
- AC 5. WHEN a save fails THEN the indicator shows the error and the change stays on screen so it can be retried.
- AC 6. WHEN pairs are edited THEN they keep their explicit **Save to EA** (each save rewrites the EA's config.json).
- AC 7. WHEN a link opens Settings with a section (`/settings?section=indicators`) THEN that section is shown; the old `?tab=` links (`display`, `mirror`, `notifications`, `visibility`, `data`, `server`) still land on the section that now holds them.
- AC 8. WHEN any part of Settings is drawn THEN it uses only the shared components of `shared/ui`; a new kind of element is added there, never drawn in Settings.
- AC 9. WHEN the reorganisation is done THEN every setting keeps its current behaviour, endpoint and stored value; nothing is lost or reset.

## Out of scope
- New settings or changes to what a setting does.
- Backend or data changes (the existing `PUT /settings` and the per-feature endpoints are reused).
- Other screens of the app.
