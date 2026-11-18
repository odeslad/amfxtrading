# 048 — Rename the project to amfxtrading · Verification

## Task 1 · [infra] New addresses on the tunnel

- **Mechanism:** manual.
- **Steps (2026-11-17, 18:40–18:49 UTC):**
  - Tunnel file of the server: the three new addresses added next to the old ones; `cloudflared tunnel ingress validate` → OK; previous file kept as `config.yml.bak-048`. Applied by a one-off SYSTEM task that restarted the service and would restore the previous file if `api-v2` stopped answering; it was not needed (log: "new config running, old address answers"). The task was deleted afterwards.
  - DNS: `api.` and `ssh.amfxtrading.com` pointed at this tunnel with `cloudflared tunnel route dns --overwrite-dns`. The record of `amfxtrading.com` could not be overwritten by the tool; the operator changed its target in the Cloudflare panel to `fb1c65c3-9f0b-4aae-ada6-69b794760ee0.cfargotunnel.com`. The MX and TXT records of `amfxtrading.com` (mail) were not touched.
  - SSH: the host key behind `ssh.amfxtrading.com` (ED25519 `SHA256:hbHZ3E1O…`) is the same as behind `ssh-v2`; the PC's known hosts updated (copy kept as `known_hosts.bak-048`); `ssh amfx-vps` reaches `WIN-16ESVKMCVCR`.
  - Cloudflare Access: the application "VPS SSH" covers `ssh-v2.amfxtrading.com` plus one other domain, with the `github-actions` policy. The GitHub token itself is proved in task 10, when the pipelines run through the new address.
- **Outcome:** ✅ `amfxtrading.com` 200 (same page as `v2`), `api.amfxtrading.com/health` 200 with 12/13 brokers connected (the 13th, `solidary isa`, has no EA, as before), `v2.`, `api-v2.` and `www.` 200, SSH through the new address works.
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 2 · [frontend] API address

- **Mechanism:** `npm run build` + manual.
- **Steps:** `frontend/scripts/deploy.ps1` writes `https://api.amfxtrading.com`; build ✓; commit `cd69cf9` pushed alone, frontend pipeline green; the published bundle calls `https://api.amfxtrading.com` only.
- **Outcome:** ✅ confirmed by the operator on 2026-11-17 at `amfxtrading.com`: still logged in (the session of `v2` is valid for the whole domain), history loads, prices move.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 3 · [infra] Redirect and notifications

- **Mechanism:** manual.
- **Steps:** a second `server` block in `C:\nginx\conf\nginx.conf` (outside git; previous file kept as `nginx.conf.bak-048`) answers `v2.amfxtrading.com` with a 301 to the same path at `amfxtrading.com`; `nginx -t` OK, service restarted. The service worker only handles notifications and caches no pages, so page loads always reach nginx; subscriptions made at `v2` keep delivering and their clicks land on the new address.
- **Outcome:** ✅ `v2.amfxtrading.com/chart?broker=Demo&symbol=EURUSD` → 301 to `amfxtrading.com/chart?broker=Demo&symbol=EURUSD`; `amfxtrading.com`, `api.` and `api-v2.` 200. The operator allowed notifications at `amfxtrading.com` and a price alert reached the device (2026-11-17). The list of what each user must do again was given to the operator.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 4 · [infra] GitHub repository

- **Mechanism:** manual.
- **Steps:** the name `odeslad/amfxtrading` only held GitHub's redirect to `amfxtrading-v1` (the MVP, renamed earlier the same day); the repository was renamed from `odeslad/amfxtradingv2` to `odeslad/amfxtrading` through the GitHub API; the remote of the local copy and of the server copy (`C:\amfxtradingv2`) set to `https://github.com/odeslad/amfxtrading.git`.
- **Outcome:** ✅ `git fetch` works locally and on the server; the four secrets of the pipelines (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `SSH_PRIVATE_KEY`, `SSH_USER`) are still listed after the rename; the MVP's copy still reaches `amfxtrading-v1`.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 5 · [infra] Names in workflows and startup scripts

- **Mechanism:** manual.
- **Steps:** `amfxtradingv2` → `amfxtrading` and `ssh-v2.amfxtrading.com` → `ssh.amfxtrading.com` in the three workflows, `infra/scripts/startup.ps1`, `infra/scripts/register-startup-tasks.ps1` and `infra/README.md`. No YAML parser is installed on the PC, so the workflows were checked another way: undoing the substitution gives back exactly the committed files, so only the names changed. The two PowerShell scripts parse without errors.
- **Outcome:** ✅ committed, not pushed (it goes out in task 10).
- **Est vs Actual:** 1 SP · 0.5 SP (tasks 5 to 9 done together).

## Task 6 · [backend] Names in scripts, tests and examples

- **Mechanism:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run build`.
- **Steps:** folder and database name in `scripts/deploy.ps1`, `ecosystem.config.js` and `.env.example`; host in `scripts/db-tunnel.ps1`; the sample origin of `scripts/ws-measure.ts` and of the two WebSocket tests is now `https://amfxtrading.com`.
- **Outcome:** ✅ lint clean, typecheck clean, 17 test files / 146 tests passed, build OK. Committed, not pushed.
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Task 7 · [frontend] Folder name in the deploy script

- **Mechanism:** `npm run build`.
- **Steps:** `Set-Location C:\amfxtrading` in `frontend/scripts/deploy.ps1`.
- **Outcome:** ✅ build OK, the script parses without errors. Committed, not pushed.
- **Est vs Actual:** 0.25 SP · 0.1 SP.

## Task 8 · [ea] Names in the EA scripts and deploy document

- **Mechanism:** manual.
- **Steps:** folder in `ea/scripts/compile-ea.ps1` and `ea/scripts/distribute-ea.ps1`; folder and host in `ea/docs/deploy.md`, where the tunnel is now named by its ID (its name in the Cloudflare panel may change in task 11).
- **Outcome:** ✅ no old name left; both scripts parse without errors. Committed, not pushed.
- **Est vs Actual:** 0.5 SP · 0.1 SP.

## Task 9 · [docs] Project guidelines

- **Mechanism:** manual.
- **Steps:** title "AMFX Trading" and folder tree `amfxtrading/` in `.claude/CLAUDE.md`.
- **Outcome:** ✅ `git grep` for `amfxtradingv2`, `amfxtrading-v2`, `api-v2`, `ssh-v2`, `v2.amfxtrading`, `app-v2` and "Trading v2" finds nothing outside `archive/` and `specs/` (AC 7). Committed, not pushed.
- **Est vs Actual:** 0.25 SP · 0.05 SP.

## Task 10 · [infra] Server folder and database

- **Mechanism:** manual.
- **When:** 2026-11-17 from 20:55 UTC, **with the market open, by the operator's decision** (the design asked for the market closed). Brokers and terminals kept running throughout.
- **Steps:** one script on the server (`C:\backup\spec048\switch.log`), ready to undo everything it did if a step failed: row counts recorded (exact for every table, estimate and size for `candles`, whose full scan once crashed PostgreSQL); backup without the candle rows (`C:\backup\spec048\amfxtradingv2.dump`, 1.6 MB); `.env`, `brokers.json`, `ecosystem.config.js` and `nginx.conf` copied aside; startup tasks stopped and disabled; backend and nginx stopped; `ALTER DATABASE amfxtradingv2 RENAME TO amfxtrading`; folder renamed to `C:\amfxtrading`; `.env`, `ecosystem.config.js`, `nginx.conf`, antivirus exclusion and the paths of both startup tasks updated; nginx and backend started from the new folder; pm2 saved. Then the commits of tasks 5 to 9 pushed one at a time: infra and specs (no pipeline), backend (alone, green; first pipeline through `ssh.amfxtrading.com`), startup tasks re-enabled, frontend (green), ea, docs (no pipeline).
- **Outcome:** ✅ backend and web stopped about 8 seconds (20:55:55 → 20:56:03). Row counts identical before and after (e.g. `trades` 50765, `balances` 872; `candles` ≈ 8.07 M rows, 2.1 GB). The old folder no longer exists and nothing runs from it. 12/13 brokers connected after every step (the 13th, `solidary isa`, has no EA, as before). Backend and frontend pipelines green.
- **EA pipeline:** compile and distribute green; the reload step stopped and restarted the 13 terminals one by one, but the SSH session of the pipeline dropped while waiting for the last one (`SADA XII`), so the step ends with exit code 255. The watchdog brought that terminal back; its log shows 13/13 running in every run since. Unrelated to the rename (a dropped connection); the EA source did not change.
- **Est vs Actual:** 2.5 SP · 1.5 SP.

## Task 11 · [infra] Operator steps

- **Cloudflare (operator, 2026-11-18):** the dead tunnel of the cancelled server (`420ad992…`) deleted; the tunnel in use (`fb1c65c3…`) renamed from `amfxtrading-v2` to `amfxtrading`. `cloudflared tunnel list` on the server shows only `amfxtrading` and `rubenlucas`; `amfxtrading.com` and `api.` 200, `v2.` 301, `api-v2.` 200. ✅
- **Done by the assistant:** the `amfx-vps-old` SSH shortcut removed from the PC (copy kept as `~/.ssh/config.bak-048`; `ssh amfx-vps` reaches `WIN-16ESVKMCVCR`); the assistant's notes updated to the new names and copied to the folder of the new path (`~/.claude/projects/c--Work-Odeslad-amfxtrading`); the MVP's notes moved to `…-amfxtrading-v1`. ✅
- **Local folders (operator, 2026-11-18):** `C:WorkOdesladmfxtrading` → `amfxtrading-v1` and `amfxtradingv2` → `amfxtrading`; the project opens from the new folder. ✅
- **Outcome:** ✅ from `c:WorkOdesladmfxtrading`: `git fetch` against `odeslad/amfxtrading` works, frontend and backend builds OK, `ssh amfx-vps` reaches `WIN-16ESVKMCVCR`, and the assistant loads its notes from the new path (AC 10).
- **Est vs Actual:** 0.5 SP · 0.5 SP.
- Note: the server runs cloudflared 2026.6.0 and it reports 2026.11.1 as current; updating it is out of the scope of this spec.

## Task 12 · [infra] Production validation

- **Mechanism:** manual (user validation).
- **Outcome:** ✅ confirmed by the operator on 2026-11-18 at `amfxtrading.com` (installed app): accounts (12 brokers), chart, positions, history, stats and settings load; a new order on the Demo account; an alert with notification; a `v2` link redirects to the new address.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 13 · [specs] Close

- **Mechanism:** manual.
- **Retire the old addresses on 2026-12-17** (30 days after task 3): remove `v2`, `api-v2` and `ssh-v2` from the tunnel and DNS, the redirect `server` block in `nginx.conf`, and the notification subscriptions made at `v2`.
- **Outcome:** ✅ spec closed and moved to `archive/2026-11/`.
- **Est vs Actual:** 0.25 SP · 0.1 SP.

**Total**: 10.5 SP estimated · 5.35 SP actual.
