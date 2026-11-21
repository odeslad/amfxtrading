# 057 — Design system · Verification

| Task | Mechanism | Commands | Result | Evidence | Est vs Actual |
|---|---|---|---|---|---|
| 1. Tokens + `/dev/ui` | build + dev server | `npm run build`; `eslint src/dev src/app/Router.tsx`; `grep -rl UiCatalog dist/`; vite dev on 5175 → `GET /dev/ui`, `GET /src/dev/UiCatalogPage.tsx` | ✅ | Build OK; lint clean; catalog absent from `dist/` (grep exit 1); dev route and module 200; new tokens served in `variables.css` | 1.5 / 0.5 SP — smaller than expected |
| 2. Base controls | build + catalog vs mockup | `npm run build`; `eslint src/shared/ui src/dev`; `/dev/ui` on vite 5175 | ✅ | Build OK; lint clean; user compared Button, IconButton, Field, TextInput, NumberInput, Select, Checkbox, Toggle with boards 1–2 (sizes, variants, focus, disabled, mobile) | 3 / 1.5 SP |
