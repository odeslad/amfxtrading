# 061 — Login sizing · Verification

| Task | Mechanism | Result | Evidence | Est | Actual |
|---|---|---|---|---|---|
| 1 | `npm run build` + `/dev/ui` | ✅ build · ✅ checked on production | `ControlSize` gains `lg` (48 px, `0 16px`, 14 px; 16 px on a phone); autofill rule on `.control`; "Text lg" in the catalog | 0.5 SP | 0.25 SP |
| 2 | `npm run build` + eslint | ✅ build · ✅ validated on production | Login built from `Field`, `TextInput size="lg"`, `Button size="lg"`; 400 px card, full width on a phone | 1 SP | 0.25 SP |
| 3 | Manual (user) | ✅ | Login validated on production (desktop and iPhone) | 0.25 SP | 0.1 SP |
| 4 | Manual | ✅ | Spec closed and archived | 0.25 SP | 0.1 SP |

**Total**: Est 2 SP · Actual 0.7 SP. Calibration: a screen that only swaps to existing shared components costs well under 1 SP.
