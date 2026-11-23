# 061 — Login sizing · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: frontend only.

- [ ] 1. [frontend] `lg` size for the shared inputs (48 px; 16 px text on a phone) and the autofill rule in the shared control; `lg` in the dev catalog · **Verify:** `npm run build` + `/dev/ui`: the `lg` input at desktop and 390 px · **Est:** 0.5 SP
- [ ] 2. [frontend] Login with `Field`, `TextInput size="lg"` and `Button size="lg"`; 400 px card on desktop, full width with margin on a phone · **Verify:** `npm run build` + local app (log out): desktop and 390 px match the mockup; wrong password shows the error; signing in returns to the page that asked; autofill keeps the dark background · **Est:** 1 SP
- [ ] 3. [infra] Push `master`, deploy the frontend when the user asks, and **validate on production**: the login on desktop and on the iPhone (no zoom when typing) · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 2 SP
