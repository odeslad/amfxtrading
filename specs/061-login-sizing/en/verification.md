# 061 — Login sizing · Verification

| Task | Mechanism | Result | Evidence | Est | Actual |
|---|---|---|---|---|---|
| 1 | `npm run build` + `/dev/ui` | ✅ build · 🕐 visual check | `ControlSize` gains `lg` (48 px, `0 16px`, 14 px; 16 px on a phone); autofill rule on `.control`; "Text lg" in the catalog | 0.5 SP | 0.25 SP |
| 2 | `npm run build` + eslint | ✅ build · 🕐 checked on production (user choice) | Login built from `Field`, `TextInput size="lg"`, `Button size="lg"`; 400 px card, full width on a phone | 1 SP | 0.25 SP |
