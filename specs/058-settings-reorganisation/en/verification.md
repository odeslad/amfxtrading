# 058 — Settings reorganisation · Verification

| Task | Mechanism | Commands | Result | Evidence | Est vs Actual |
|---|---|---|---|---|---|
| 1. NavList, SaveStatus, useAutosave | build + catalog demo | `npm run build`; `eslint src/shared/ui src/dev src/lib/useAutosave.ts`; `/dev/ui` on vite 5175 | ✅ | Build OK; lint clean; catalog demo with simulated save (OK / SLOW / FAIL, invalid below 1); user asked to continue. Pending and invalid are derived in render (no setState in effects); saves loop while changes arrive | 2.5 / 1.5 SP |
