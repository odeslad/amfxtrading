# 043 — VPS migration · Verification

## Task 1 — Base system of the new VPS

- **Mechanism:** manual — settings read back over SSH from `WIN-E5FGF0D8OH7` (`<new VPS IP>`) after applying them, compared with the same reading on the old VPS.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**

| Setting | Old VPS | New VPS after the task |
|---|---|---|
| Time zone | UTC | UTC (already) |
| Power plan | Balanced, sleep and hibernate "never" on AC | same (already) |
| Windows Update policy | `NoAutoRebootWithLoggedOnUsers=1` | `NoAutoRebootWithLoggedOnUsers=1`, `AUOptions=3` (download, ask before installing — the provider's default, kept) |
| Active hours | 0–23 | 0–23 |
| Defender path exclusions | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Work` | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Users\Administrator\AppData\Roaming\MetaQuotes` |
| Defender process exclusions | `cloudflared.exe`, `node.exe`, `postgres.exe`, `terminal.exe` | same |
| Defender real-time protection | **disabled** | enabled |
| `C:\monitoring`, `C:\deploy` | exist | created |
| Page file | fixed 8192 MB | system-managed (1920 MB now) |

- **Deviations:**
  - Real-time protection is disabled on the old VPS; it was **left enabled** on the new one (not in the design, and it lowers the machine's protection). With the exclusions above it should not interfere; revisit only if task 6 shows a measurable cost.
  - The page file was left system-managed instead of the old fixed 8 GB: the new machine has twice the RAM. Revisit with the memory reading of task 6.
  - Incident while applying: the script recreated the Windows Update policy key and dropped the provider's `AUOptions=3`; it was restored in the same session and read back.
- **Est vs Actual:** 1 SP vs 0.5 SP — most settings already matched.

## Task 2 — Software at the inventory versions

- **Mechanism:** manual — version listing and service state read over SSH on the new VPS, compared with the inventory of the old one.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**

| Software | Old VPS | New VPS |
|---|---|---|
| Node / npm | 24.16.0 / 11.13.0 | 24.16.0 / 11.13.0 |
| pm2 (global, `%APPDATA%\npm`) | 7.0.1 | 7.0.1 |
| git | 2.54.0.windows.1 | 2.54.0.windows.1 |
| PostgreSQL | 17.10 | 17.10 |
| nginx | 1.26.2 | 1.26.2 |
| nssm | 2.24-101-g897c7ad | 2.24-101-g897c7ad (`C:\nssm\nssm.exe`) |
| cloudflared | 2026.6.0 | 2026.6.0 |

  - Services on the new VPS: `postgresql-x64-17` running, automatic, `NetworkService`; `nginx` running, automatic, `LocalSystem` (same `nssm` settings as the old one); no `cloudflared` service or process.
  - PostgreSQL: superuser `postgres` with the password of the old `DATABASE_URL`, port 5432, data in `C:\Program Files\PostgreSQL\17\data`; active lines of `postgresql.conf` and `pg_hba.conf` identical to the old VPS.
  - `C:\nginx\conf\nginx.conf` is the old VPS file, byte for byte (it names no host: `server_name localhost`). nginx answers `500` on `/` until `frontend\dist` exists (task 4), as expected.
- **Deviations:**
  - nginx is the official 1.26.2 download plus the old `nginx.conf`, not a copy of the whole `C:\nginx` folder (avoids carrying logs and temp files).
  - `nssm` lives in `C:\nssm` instead of the winget links folder.
  - The PostgreSQL installer fails when launched from an SSH session ("Error writing file … temp_check_comspec.bat"); it was run through a one-off scheduled task as `SYSTEM`, deleted afterwards.
  - Pending cleanup: `C:\deploy\backend.env` (copy of the old `.env`, used to read the database password) is moved to `backend\.env` in task 4; `C:\deploy\installers` can be deleted at the end.
- **Est vs Actual:** 2 SP vs 1.5 SP.

## Task 3 — Apex domain as an allowed origin

- **Mechanism:** vitest + `npm run build` (plus `npm run lint`).
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - `ALLOWED_ORIGINS` in `backend/src/ws/policy.ts`: `/\.amfxtrading\.com(:\d+)?$/` → `/(^https:\/\/|\.)amfxtrading\.com(:\d+)?$/`. The same list feeds CORS (`app.ts`) and the WebSocket upgrade.
  - `npx vitest run src/ws/policy.test.ts`: 13 tests pass. New cases: `https://amfxtrading.com` and `https://api.amfxtrading.com` accepted; `https://evilamfxtrading.com` and `http://amfxtrading.com` rejected. The existing cases (subdomains accepted, `amfxtrading.com.evil.com` rejected) still pass.
  - `npm run build` (tsc) and `npm run lint` clean.
  - `backend/docs/architecture.md` updated in the same commit (allowed origins).
- **Not yet proven:** the real browser at `https://amfxtrading.com` against the deployed backend — that is the verification of task 8.
- **Est vs Actual:** 0.5 SP vs 0.25 SP.

## Task 4 — Project on the new VPS

- **Mechanism:** both builds on the new VPS + the frontend loaded from the developer PC through `ssh -L 8080:127.0.0.1:80`.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - `git clone https://github.com/odeslad/amfxtradingv2.git C:\amfxtradingv2` (anonymous: the repository is publicly readable) → `ff3d307`, the same commit the old VPS has deployed.
  - `backend\.env`: the old VPS file with `FEATURE_ALERTS=false` (flags: `PIPE=true`, `WATCHER=true`, `ENGINE=false`, `ALERTS=false`, `WS_BROADCAST=true`). `backend\brokers.json`: the old VPS file, 13 brokers. The temporary copy `C:\deploy\backend.env` no longer exists.
  - Backend: `npm install`, `npx prisma generate`, `npm run build` → `dist\index.js` present.
  - Frontend: `.env.production` = `VITE_API_BASE=https://api.amfxtrading.com`, `npm ci`, `npm run build` → `dist\index.html` present; the only API host inside the bundle is `api.amfxtrading.com`.
  - nginx answers `200` on `/` locally; through the port forward `http://127.0.0.1:8080/` returns `200` (title `AMFX`) and the SPA route `/settings` returns `200`.
  - `git status` on the new VPS clean (the `package-lock.json` change left by `npm install` was discarded, as `deploy.ps1` does with `git reset --hard`).
- **Not yet proven:** the backend has not been started (no database yet — task 5); the clone does not include the task 3 commit until `master` is pushed and pulled.
- **Est vs Actual:** 1.5 SP vs 0.75 SP.
- **Addendum (same day) — `v2` dropped from the server names**, at the user's request (see "Dropping the `v2` name" in the design): `C:\amfxtradingv2` renamed to `C:\amfxtrading` on the new VPS; `backend\.env` now has `DATABASE_URL` → database `amfxtrading` and `BROKERS_FILE` → `C:\amfxtrading\backend\brokers.json`; `nginx.conf` `root C:/amfxtrading/frontend/dist`, nginx restarted and answering `200`; Defender path exclusion moved to `C:\amfxtrading`; `git status` clean after the rename. The repo scripts still say `C:\amfxtradingv2` until tasks 9–12.

## Push of tasks 1–4 (2026-11-16)

- `master` pushed at `4e8022c`. Before the push the five local commits were rewritten so that the new VPS IP appears in none of them (the repository is publicly readable); the documents now say `<new VPS IP>`.
- The push triggered the backend pipeline on the **old** VPS: its `git` head moved to `4e8022c` and `https://api-v2.amfxtrading.com/health` answered `200` with 11 of 13 brokers connected and receiving ticks. `solidary isa` and `demo` show `pipe: listening`; the user confirmed both were already disconnected before the deploy.

## Task 8 — Tunnel, DNS and Access

- **Mechanism:** manual — probes from the developer PC after creating the tunnel.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - The `cert.pem` copied from the old VPS was accepted: `cloudflared tunnel list` showed the account's tunnels, and `cloudflared tunnel create amfxtrading` created tunnel `420ad992-bc3a-4079-b5c0-8f1bcd6d4820`. No `cloudflared tunnel login` by the user was needed.
  - `C:\Users\Administrator\.cloudflared\config.yml`: ingress `ssh.amfxtrading.com` → `ssh://localhost:22`, `amfxtrading.com` → `http://localhost:80`, `api.amfxtrading.com` → `http://localhost:3000`, catch-all 404; `ingress validate` OK.
  - DNS: `tunnel route dns --overwrite-dns` added the CNAME of the three names (the previous records of the apex and `api` were replaced).
  - Service `Cloudflared`: running, automatic, `LocalSystem`, same command line as on the old VPS; `tunnel info` shows one connector with four edge connections.
  - `https://amfxtrading.com/` → `200` (title `AMFX`), `/settings` → `200`. `https://api.amfxtrading.com/health` → `502`, expected: the backend is not started until tasks 5–6.
  - `ssh` through `ssh.amfxtrading.com` (`cloudflared access ssh`) returns `WIN-E5FGF0D8OH7`.
  - Unchanged: `https://v2.amfxtrading.com/` → `200`, `https://api-v2.amfxtrading.com/health` → `200`, `https://www.amfxtrading.com/` → `200` (title "AMFX Trading Terminal v1.0").
- **Pending:**
  - Done by the user: `ssh.amfxtrading.com` added to the "VPS SSH" Access application next to `ssh-v2`. Checked afterwards: an unauthenticated request to either hostname is redirected (`302`) to the Cloudflare Access login, and `ssh` reaches `WIN-16ESVKMCVCR` through `ssh-v2` and `WIN-E5FGF0D8OH7` through `ssh`. The `github-actions` service token on the new hostname is proven by the workflows after the joint push.
  - The public login and live ticks at `https://amfxtrading.com` are verified in task 6, when the backend and terminals run.
- **Est vs Actual:** 2 SP vs 1 SP — the old certificate worked, so no login step was needed.

## Task 5 — Rehearsal of the data transfer

- **Mechanism:** row counts on both sides + `prisma migrate status` on the new database, timed.
- **Outcome:** ✅ pass with a deviation agreed with the user (2026-11-16): every table except the data of `candles`, which is damaged on the old VPS (see below and "Candles" in the design).
- **What happened on the old VPS:**
  - `pg_dump -Fc` of the whole database failed three times in a row at the same point: `COPY public.candles … ERROR: invalid memory alloc request size 18446744073709551613`. It is not the transient "invalid page" error the design expected: the table holds at least one permanently damaged row.
  - `pg_dump --exclude-table-data=public.candles` succeeded: 2.0 MB, 1 second. Every other table is readable.
  - `select count(*) from candles` answered (7,766,113 rows; 2004 MB with indexes). The next query, `select min(time), max(time) from candles`, **crashed a PostgreSQL server process at 15:30:40 UTC**; PostgreSQL ran automatic recovery (redo done in under a second) and was accepting connections again immediately. The backend process was not restarted (`/health` afterwards: same 11 of 13 brokers connected, uptime uninterrupted). Production lost database access for some seconds, in market hours, because of this query.
  - No further query has been run against `candles` on the old VPS.
- **Row counts on the old VPS (2026-11-16 15:31 UTC):** `_prisma_migrations` 39 · `balance_operations` 625 · `balances` 859 · `book_schemes` 459 · `book_trades` 888 · `candles` 7,766,113 · `chart_indicators` 1 · `drawings` 46 · `ema_cross_alerts` 0 · `ema_notification_events` 25 · `ema_notifications` 1 · `mirror_presets` 7 · `position_colors` 0 · `price_alerts` 7 · `push_subscriptions` 2 · `settings_display` 1 · `trades` 50,736 · `users` 1.
- **Restore on the new VPS:** database `amfxtrading` created (UTF8) and `pg_restore` of the 2.0 MB dump: exit 0, 3 seconds. Row counts identical to the list above for every table; `candles` exists and is empty. `npx prisma migrate status`: "38 migrations found … Database schema is up to date!" (used instead of `prisma migrate diff`, which needs a shadow database).
- **Timing for the switch:** dump 1 s + transfer + restore 3 s; the database copy is a matter of seconds, not the 15–40 minutes estimated when it included `candles`.
- **Decision (user):** `candles` is not migrated; the new VPS refills it from its own terminals (full history on EA start) and that is enough. No salvage from the old table.
- **Est vs Actual:** 1.5 SP vs 1.25 SP.

## Task 6 — MT4 terminals and backend on the new VPS

- **Mechanism:** folder comparison, `/health` on both systems, memory reading, CORS probe.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - Copy: the 13 installation folders (507 MB packed) and the `MetaQuotes` tree (196 MB packed) were archived on the old VPS at low priority (67 s, no read errors), relayed through the developer PC (42 s) and unpacked to the same paths. For each of the 13 brokers of `brokers.json`: same data-folder hash, `origin.txt` pointing at an existing `terminal.exe`, both `HttpBridge*.ex4` present, bridge `config.json` present.
  - Before starting anything, `command.json`, `pending.json` and `result.json` were searched in every copied bridge folder so that no order captured in the copy could be executed again: none was present.
  - Start through `AMFX-Startup` in the interactive session (the scripts with the new paths were copied by hand to the working tree; they reach `master` with tasks 9–12): `startup.log` — backend up after `pm2 start`, 13 terminals started 20 s apart, "13/13 running", "run end: OK". The 13 `terminal.exe` run in session 2 (visible over RDP).
  - `https://api.amfxtrading.com/health`: 11 of 13 brokers `connected` with `tickAgeS: 0`; `solidary isa` and `demo` `listening` — **the same two that are disconnected on the old VPS**. The saved logins of the 11 connected accounts survived the copy; nobody had to log in by RDP.
  - Old VPS during and after: `https://api-v2.amfxtrading.com/health` keeps its 11 of 13 connected, backend uptime uninterrupted. No broker dropped the old session when the new one logged in.
  - Backend log: `[FEATURES] Disabled: alerts`; error log empty.
  - Memory with everything running: 3.6 GB free of 8.2 GB (terminals 0.54 GB, PostgreSQL 0.87 GB, node 0.19 GB), CPU around 37 % while the candle history loads. The old VPS runs the same load with 0.75 GB free of 4 GB.
  - `candles` refilling from the terminals: 2,257,096 rows a few minutes after the start (the old table has 7.77 million; the final figure is read in task 14).
  - After `git pull` to `4e8022c` (apex origin), rebuild and `pm2 restart`: a request to `https://api.amfxtrading.com/health` with `Origin: https://amfxtrading.com` answers `access-control-allow-origin: https://amfxtrading.com` and `access-control-allow-credentials: true`.
  - User check in the browser: `https://amfxtrading.com/journal` opens with the existing session (no new login) and the Accounts tab shows live balance, equity and day P&L for 11 brokers; `demo` appears greyed out and `solidary isa` does not appear, matching the two disconnected accounts. This proves the apex origin end to end (CORS, session cookie and WebSocket).
- **Est vs Actual:** 2 SP vs 1.5 SP.

## Task 7 — Startup tasks, Autologon and reboot

- **Mechanism:** reboot of the new VPS with nobody logging in; `startup.log`, `/health` and process list read afterwards.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**
  - `AMFX-Startup` and `AMFX-Watchdog` registered with `register-startup-tasks.ps1` (new paths). `PoolWatch` replicated (memory log every 30 s, as `SYSTEM` at boot, writing to `C:\monitoring\pool-monitor.log`). `RAM-Log` does not exist on the old VPS, so there was nothing to replicate.
  - Autologon enabled by the user over RDP (Sysinternals): `AutoAdminLogon=1`, user `Administrator`, domain `WIN-E5FGF0D8OH7`, no plain-text password in the registry.
  - Reboot requested at 16:01:16 UTC; boot time 16:01:29 UTC. `query user` afterwards: `administrator` on `console`, logged on at 16:01 with no RDP session opened.
  - `startup.log`: backend healthy, terminals started 20 s apart, "13/13 running", "run end: OK" at 16:07. 13 `terminal.exe`, no duplicated executable, all in the interactive session.
  - `https://api.amfxtrading.com/health` 242 s after the backend start: 11 brokers `connected` (the same 11 as before the reboot). Services `postgresql-x64-17`, `nginx`, `Cloudflared` and `sshd` running; `PoolWatch` running and logging; 3.5 GB of RAM free.
- **Note:** `AMFX-Startup` and `AMFX-Watchdog` overlapped during the boot (one run reports 6 terminals started, the other 13). It did not produce duplicated terminals, and it is how the scripts already behave on the old VPS.
- **Est vs Actual:** 1.5 SP vs 1 SP.

## Candles on the new system — finding outside this spec (2026-11-16)

- The user reported gaps in October and long false wicks at `https://amfxtrading.com`. Measured in the new database: EURUSD M15 in October has between 1,088 and 2,093 candles per broker where a full month is about 2,112; 216 stored candles have their close outside the high–low range.
- Cause, read in the code: the EA exports the whole history only when it starts and then only the last 100 bars; `services/candle-close.ts` stores a closed candle with the latest bid when a terminal starts with stale history; `services/candles.ts` inserts missing rows but only overwrites the last two. None of it is caused by the migration: the same code runs on the old VPS, whose table was filled gradually over months.
- A rescue from the old database was started and **abandoned at the user's request** ("candles must come from MT4, not be replaced by hand"): a raw copy of the old cluster was restored as a scratch instance on the new VPS and its candles loaded into a side table (all but 2 of 173,715 pages were readable). Nothing was merged into `candles`; the side table, the scratch instance and the backup file were deleted.
- Follow-up: spec 044 (EA + backend) so that MT4 is the complete and only source.

## Tasks 9, 10 and 12 — Repo pointed at the new server (verified by the push of 2026-11-16)

- **Mechanism:** the three workflows running against the new VPS after the joint push (`a86b7fb`, together with spec 044).
- **Outcome:** ✅ pass (2026-11-16) for tasks 9, 10 and 12. Task 11 stays open: `db-tunnel.ps1` is changed and pushed, but the local `~/.ssh/config` aliases (`amfx-vps` → new, `amfx-vps-old` → old) have not been changed yet and `db-tunnel.ps1` has not been run against the new host.
- **Evidence:**
  - EA workflow: success — compiled on the new VPS from `C:\amfxtrading\ea`, distributed to the 13 terminals and reloaded them through `AMFX-Watchdog` (task 12, and the compile, distribute and reload of AC 6).
  - Frontend workflow: success — `deploy.ps1` ran in `C:\amfxtrading`; the bundle at `https://amfxtrading.com` was already calling `api.amfxtrading.com` (task 10).
  - Backend workflow: `check` passed; `deploy` failed at "Upload deploy script" with a connection reset through the tunnel, was run by hand over SSH, and passed when the user re-ran it (attempt 2). The two later backend pushes (`fad0803`, `d3a6b0a`) deployed at the first attempt. The `github-actions` service token works on `ssh.amfxtrading.com` (task 9).
  - The old VPS was not touched by any of them: its backend kept answering at `api-v2.amfxtrading.com` with 11 of 13 brokers throughout.
- **Est vs Actual:** tasks 9, 10, 12: 2.5 SP vs about 1 SP.

## Task 11 — Local access pointed at the new server (2026-11-17)

- **Outcome:** ✅ pass for the aliases and the tunnel script; the Cloudflare login used by both is failing for the whole account (see below).
- **Evidence:** `~/.ssh/config` on the developer PC: `amfx-vps` → `ssh.amfxtrading.com`, new `amfx-vps-old` → `ssh-v2.amfxtrading.com`. `backend/scripts/db-tunnel.ps1` uses `ssh.amfxtrading.com` (pushed with task 11's commit).
- **Not verified end to end:** `ssh amfx-vps`, `ssh amfx-vps-old` and `db-tunnel.ps1` could not be exercised on 2026-11-17 because `cloudflared access login` fails for every hostname of the Cloudflare team, including `ssh.rubenlucas.es` of another project: with cloudflared 2026.5.2 "Empty app domain"; after upgrading the developer PC to 2026.11.0 "metadata JWT verification failed … JWK with matching kid not found in JWK Set". The login redirect carries a metadata token signed with key `5a40ea5d…`, and the team's `/cdn-cgi/access/certs` publishes only `9081125…` and `db6d164…`. The pipelines are not affected (service token). Cause not established; it does not come from the changes of this spec.
- **Access used meanwhile:** SSH by IP with the deploy key. New VPS: port 22 open since the bootstrap. Old VPS: the user added an IONOS rule and a Windows firewall rule (`AMFX-SSH-Migration`) for port 22 restricted to the developer's public IP.

## Task 14 — Switch (2026-11-17, about 06:35–06:45 UTC)

- **Mechanism:** row counts on both sides, backend logs, public probes.
- **Outcome:** ✅ pass on the servers; the user's own steps (using `amfxtrading.com`, reinstalling the app on the phone, re-enabling push) are theirs to do.
- **Evidence:**
  - User-created tables dumped on the old VPS (`pg_dump -Fc -a`, 13 tables, 69 KB), relayed, and restored on the new one after a backup of its own copy (`C:\deploy\userdata-new-before-20261117-063710.dump`), a `TRUNCATE` of those tables and `pg_restore -a --single-transaction`: exit 0. Counts identical on both sides: users 1, settings_display 1, position_colors 0, price_alerts 7, ema_cross_alerts 0, ema_notifications 1, ema_notification_events 25, push_subscriptions 2, drawings 46, chart_indicators 1, mirror_presets 7, book_schemes 459, book_trades 888.
  - `trades`, `balances`, `balance_operations` and `candles` were not copied again: they come from the terminals (the first three were copied on 2026-11-16).
  - Alerts: old backend restarted with `FEATURE_ALERTS=false` — log "[FEATURES] Disabled: alerts", 11 of 13 brokers; new backend started with `FEATURE_ALERTS=true` — log "[FEATURES] Disabled: none", 12 of 13 brokers, ticks at 0 s. `pm2 save` on the new VPS.
  - Public probes: `https://amfxtrading.com/` 200, `https://api.amfxtrading.com/health` 200 and it answers `access-control-allow-origin: https://amfxtrading.com`; `v2` and `api-v2` still 200.
- **Deviation:** the runbook of task 13 was not written as a separate document before the switch; the user asked to finish the same day and approved the steps listed in the conversation. The rollback is the one in the design: set `FEATURE_ALERTS` back on both backends and return to `v2.amfxtrading.com`; data created on the new system after 06:37 UTC would have to be carried back.
- **Est vs Actual:** 2 SP vs 1 SP — without `candles` the copy takes seconds.

## Task 15 — Documentation

- **Outcome:** ✅ pass (2026-11-17). `infra/README.md` (folder, number of terminals, Autologon command without a fixed host name) and `ea/docs/deploy.md` (folder, SSH host name) updated; `backend/docs/architecture.md` and `.claude/CLAUDE.md` were updated with specs 043 and 044. The remaining `app-v2` strings are test origins and the repo tree name, left as they are.

## Still open

- Task 13: port 22 is still open on both servers (needed until the Cloudflare login works again or a service token is set up for the developer PC).
- Task 16: 14 days of observation, then the user cancels the old VPS and the old tunnel's DNS records are removed.

## Task 16 — Validation on production (first part, 2026-11-17)

- **Outcome:** 🕐 the user's validation of the app is done; the 14 days of observation run until 2026-12-01.
- **Validated by the user at `https://amfxtrading.com`:** the session carried over from `v2`; accounts with live figures; app reinstalled on the iPhone and notifications enabled there and in Chrome on Windows; a price alert created from the chart panel fired and its push arrived; a trade opened on the `Demo` account ("abierto y funcionando").
- **Also confirmed:** the order was executed from the chart ("Order executed") and its SL was modified ("sl tmb").
- **Not reported yet:** closing that trade, and saving a change in Settings.
- **Found during validation:** in Chrome on Windows "Enable this device" failed ("Could not enable notifications on this device") until the service worker registered for `amfxtrading.com` was unregistered in DevTools: the browser kept a registration from the website that used to be served at that address. `lib/usePush.ts` swallows the error and does not drop an existing subscription before creating a new one — a small frontend improvement, outside this spec.
- **Old subscriptions:** the two copied from `v2` (Safari · Mac and Chrome · Windows, since 23/10) stay in the list until the user removes them; while they exist, alerts also reach the old installed app.
