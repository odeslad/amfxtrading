# 050 — Migrate the platform to the VPS XL+ · Verification

## Task 1 · [infra] Inventory of the M+ and base system of the XL+

- **Mechanism:** inventory read over SSH on both servers (2026-11-19); XL+ settings read back.
- **Inventory:**

| Item | M+ (`WIN-16ESVKMCVCR`) | XL+ (`WIN-5SSFL41HHDI`) before |
|---|---|---|
| Node / npm / pm2 | 24.16.0 / 11.13.0 / 7.0.1 | not installed |
| git | 2.54.0.windows.1 | not installed |
| PostgreSQL | 17.10, service `postgresql-x64-17` (NetworkService, automatic) | not installed |
| nginx | 1.26.2 in `C:\nginx`, service `nginx` through nssm (WinGet link in the Administrator profile, not `C:\nssm`) | not installed |
| cloudflared | 2026.6.0, service `Cloudflared` (LocalSystem, automatic, `--config C:\Users\Administrator\.cloudflared\config.yml`) | not installed |
| OpenSSH | 9.5p2, `sshd` automatic | 9.5p2, `sshd` automatic |
| Scheduled tasks | `AMFX-Startup`, `AMFX-Watchdog`, `PoolWatch` (`C:\pool-watch.ps1`). **No `RAM-Log` task exists** | none |
| MT4 installations | 13 | 0 |
| Time zone / power plan | UTC / Balanced | UTC / Balanced |
| Windows Update | `NoAutoRebootWithLoggedOnUsers=1`, active hours 0–23 | `AUOptions=3`, nothing else |

- **XL+ base system applied:** sleep, hibernation and monitor timeouts 0 on AC; `NoAutoRebootWithLoggedOnUsers=1` and active hours 0–23 as on the M+; `C:\monitoring`, `C:\deploy` and `C:\backup` created. Read back: standby index 0, `NoAutoRebootWithLoggedOnUsers=1`, active hours 0–23, UTC.
- **Finding:** the RAM log the design relies on never existed on the M+ (only `PoolWatch`); task 6 creates it on the XL+.
- **Outcome:** ✅
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 2 · [infra] Software on the XL+

- **Mechanism:** official installers downloaded on the XL+ into `C:\deploy\installers`, run silently over SSH; versions and services read back with the same inventory script as task 1.
- **Steps:** Node 24.16.0 (MSI), Git 2.54.0 (silent setup), cloudflared 2026.6.0 (MSI, lands in `C:\Program Files (x86)\cloudflared` as on the M+; no service created), nssm 2.24-101 in `C:\nssm`, `npm i -g pm2@7.0.1`, PostgreSQL 17.10 (EDB installer through a one-off `SYSTEM` scheduled task, 180 s, superuser password taken from the M+'s `DATABASE_URL`, port 5432, task deleted afterwards), `C:\nginx` copied from the M+ without `logs` and `temp` and registered with nssm with the M+'s settings (`AppDirectory C:\nginx`, `AppExit Restart`, automatic, LocalSystem).
- **Result:**

| Item | M+ | XL+ |
|---|---|---|
| Node / npm | 24.16.0 / 11.13.0 | 24.16.0 / 11.13.0 |
| pm2 | 7.0.1 | 7.0.1 |
| git | 2.54.0.windows.1 | 2.54.0.windows.1 |
| PostgreSQL | 17.10, `postgresql-x64-17` running, automatic, NetworkService | same |
| nginx | 1.26.2, `nginx` running, automatic, LocalSystem | same (nssm in `C:\nssm` instead of the WinGet link) |
| nssm | 2.24-101-g897c7ad | 2.24-101-g897c7ad |
| cloudflared | 2026.6.0 | 2026.6.0 |

- **Note:** npm writes notices to stderr, which stopped the script under `ErrorActionPreference = Stop` after pm2 had installed; the rest was run on its own.
- **Outcome:** ✅
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Task 3 · [infra] Project on the XL+

- **Mechanism:** the deploy scripts' build steps run by hand over SSH; `/health` and nginx checked on the XL+.
- **Steps (2026-11-19):** `git clone` of the public repository into `C:\amfxtrading` (`c2c4730`, the pushed `master`); `backend\.env` and `backend\brokers.json` copied from the M+, `FEATURE_ALERTS=false` set with node (no BOM); backend `npm install`, `prisma generate`, `tsc --outDir dist`; frontend `.env.production` with `VITE_API_BASE=https://api.amfxtrading.com`, `npm ci`, `npm run build`; after the database of task 4, `prisma migrate status` ("Database schema is up to date!"), `pm2 start ecosystem.config.js`, `pm2 save`.
- **Outcome:** ✅ `http://localhost:3000/health` on the XL+ answers with the 13 brokers in `listening` (no terminals yet); `http://localhost/` through nginx answers 200 with the built frontend. The frontend calls `api.amfxtrading.com`, which is the M+ until the switch, so the app in a browser is checked in task 9.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 4 · [db] Rehearsal of the database copy

- **Mechanism:** `pg_dump -Fc` on the M+, relay through the PC, `pg_restore --no-owner` into a new `amfxtrading` database on the XL+; exact `count(*)` of every public table on both sides with the same script.
- **Timing:** dump 9.2 s (38.1 MB) · relay 6.7 s · restore 21.2 s — about 37 s in total.
- **Row counts (equal on both servers):**

| Table | Rows |
|---|---|
| `_prisma_migrations` | 41 |
| `balance_operations` | 626 |
| `balances` | 895 |
| `book_schemes` | 459 |
| `book_trades` | 888 |
| `candle_syncs` | 65 |
| `candles` | 3 125 066 |
| `chart_indicators` | 1 |
| `drawings` | 48 |
| `ema_cross_alerts` | 0 |
| `ema_notification_events` | 25 |
| `ema_notifications` | 1 |
| `mirror_presets` | 7 |
| `position_colors` | 0 |
| `price_alerts` | 1 |
| `push_subscriptions` | 2 |
| `settings_display` | 1 |
| `trades` | 50 783 |
| `users` | 1 |

- **Outcome:** ✅ 19 tables, identical counts; `prisma migrate status` up to date on the XL+.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 5 · [ea] MT4 terminals on the XL+

- **Mechanism:** `tar` (uncompressed, to disk, little memory on the 4 GB M+) of the 13 installation folders (882 MB, 2 s) and of `AppData\Roaming\MetaQuotes` without `logs` (631 MB, 4 s), both with exit 0 while the M+'s terminals kept running; relayed through the PC (42 s down, 32 s up); extracted on the XL+ to the same paths. Terminals started by `AMFX-Startup` / `AMFX-Watchdog` once the operator logged in by RDP (task 6).
- **Checks:** 13 installations; the 13 data folders have the same hash names and the same `origin.txt` as on the M+; the 13 `bridgePath` of `brokers.json` exist.
- **Brokers (2026-11-19 10:31, both servers at once, same accounts):** XL+ 12 `connected` with `tickAge 0` and `solidary isa` `listening` — the same as the M+ at the same moment. The saved logins survived the copy; no broker dropped either side.
- **Memory with 13 terminals:**

| | M+ | XL+ |
|---|---|---|
| RAM used / total | 2.67 / 4 GB | 5.29 / 16 GB |
| Working set of the 13 terminals | 0.38 GB | 1.56 GB |

  On the M+ the terminals are kept mostly paged out (0.38 GB for 13), which is the page-file traffic where its bugcheck fires.
- **Go / no-go:** go — same brokers and tick age 0 on both; the XL+ has 10+ GB free.
- **Outcome:** ✅
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Task 6 · [infra] Startup tasks, RAM logging, Autologon and reboot

- **Steps:** `register-startup-tasks.ps1` registered `AMFX-Startup` (at logon) and `AMFX-Watchdog` (every 5 min), both interactive. The operator enabled Autologon by RDP (Sysinternals). `PoolWatch` replicated with the M+'s `C:\pool-watch.ps1` (SYSTEM, at startup, `C:\pool-monitor.log` every 30 s). New `RAM-Log` (SYSTEM, at startup and every minute) writing `C:\monitoring\ram-YYYYMM.csv`: time, used, free, commit, commit limit, page-file use, terminals.
- **Autologon read back:** `AutoAdminLogon=1`, user `Administrator`, domain `WIN-5SSFL41HHDI`, no plain-text password in the registry.
- **Reboot test (2026-11-19):** `shutdown /r` over SSH at 10:31; booted 10:31:59; with nobody touching it, 13 terminals running about 5 minutes later, `startup.log` `13/13 running (13 started now)` and `run end: OK`, services `postgresql-x64-17`, `nginx` and `sshd` running, `/health` with the same 12 brokers `connected` (tick age 0) and `solidary isa` `listening`, RAM file growing every minute (5.2 GB used, 13 terminals).
- **Outcome:** ✅
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 7 · [infra] Tunnel and SSH identity ready on the XL+; switch runbook

- **Tunnel:** `C:\Users\Administrator\.cloudflared\` copied from the M+ (credentials of tunnel `fb1c65c3…`, `config.yml`, `cert.pem`, old backups) through the PC, the copy on the PC deleted afterwards. Service `Cloudflared` created on the XL+ with the M+'s command line (`--config C:\Users\Administrator\.cloudflared\config.yml tunnel run`, LocalSystem), **stopped and manual**.
- **SSH identity:** the M+'s `ssh_host_*` keys copied to `C:\ProgramData\ssh` on the XL+ (its own keys kept in `orig050`), ACLs SYSTEM + Administrators, `sshd` restarted. The XL+ now presents `ED25519 SHA256:hbHZ3E1OqDTNfpcPzfWo9KNO6Dh7+SHhLOlZWYLY2yE`, the same as the M+ (also ECDSA `PhgdidOQ…` and RSA `nNqM9UpR…`).
- **Public site unaffected:** `ssh amfx-vps` still lands on `WIN-16ESVKMCVCR`; `https://api.amfxtrading.com/health` 200.
- **Switch script** `C:\deploy\switch-out-050.ps1` on the M+, launched by `C:\deploy\run-switch-050.ps1 -TimeoutS <s>` as the `SYSTEM` task `Switch-050` (so it survives the SSH session dropping): disables and stops the M+'s `Cloudflared`, then for `TimeoutS` seconds checks `https://api.amfxtrading.com/health`; a 200 means the other connector serves it (`SWITCHED`); otherwise it sets the M+'s service back to automatic and starts it (`ROLLBACK`). Log in `C:\monitoring\switch050.log`.
- **Rollback branch tried (2026-11-19 11:00, operator's go-ahead, XL+ tunnel left stopped, `-TimeoutS 60`):** log `11:00:53 start` → `11:01:23 cloudflared stopped and disabled` (stopping the service took 30 s) → `11:02:24 no answer in 60s: ROLLBACK`; public API down from +6 s to +97 s, then 200 again; `Cloudflared` on the M+ back to `AUTO_START`, `RUNNING`; `ssh amfx-vps` → `WIN-16ESVKMCVCR`. EAs and terminals unaffected (they do not use the tunnel).

### Switch runbook (task 9)

1. XL+ to the current `master`: `git pull`, backend `npm install`, `prisma generate`, `prisma migrate deploy`, build; frontend build — the steps of task 3.
2. Stop the XL+ backend (`pm2 stop amfxtrading-backend`) and its watchdog (`Disable-ScheduledTask AMFX-Watchdog`).
3. On the M+: `Disable-ScheduledTask AMFX-Watchdog`, `pm2 stop amfxtrading-backend`, close the 13 terminals.
4. Final copy: `dbcount050.ps1 dump` on the M+ → relay → `dbcount050.ps1 restore` on the XL+; compare the two count lists (AC 2). Keep `amfx050.dump`.
5. XL+: `FEATURE_ALERTS` removed from `.env` (default on) with node; `pm2 start`, `pm2 save`; `Enable-ScheduledTask AMFX-Watchdog`; `/health` local.
6. M+: `run-switch-050.ps1 -TimeoutS 180` (over `ssh amfx-vps`; the session drops). Right after, over the XL+'s direct SSH: `Start-Service Cloudflared`, then `Set-Service Cloudflared -StartupType Automatic` once the public `/health` answers.
7. Checks: `switch050.log` on the M+ says `SWITCHED`; `ssh amfx-vps hostname` → `WIN-5SSFL41HHDI`; public `/health` with the same brokers connected.

### Rollback procedure (until the M+ is cancelled)

1. XL+: `Stop-Service Cloudflared`, `Set-Service Cloudflared -StartupType Manual`; `pm2 stop amfxtrading-backend`; `Disable-ScheduledTask AMFX-Watchdog`; close its terminals.
2. M+ (by its own RDP, or by `ssh amfx-vps` once the tunnel is back): `Set-Service Cloudflared -StartupType Automatic`, `Start-Service Cloudflared`; `Enable-ScheduledTask AMFX-Watchdog` (it starts the backend and the 13 terminals within 5 minutes).
3. Data created on the XL+ after the switch: dump of `price_alerts`, `ema_cross_alerts`, `ema_notifications`, `drawings`, `settings_display`, `chart_indicators`, `mirror_presets`, `position_colors`, `book_schemes`, `book_trades`, `push_subscriptions`, `candle_syncs`, restored on the M+ with those tables emptied first. Candles, trades and balances come back from the terminals.

- **Outcome:** ✅
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 8 · [docs] Documentation

- **Mechanism:** manual — search of `infra/README.md`, `.claude/CLAUDE.md`, `backend/docs/architecture.md` and `ea/docs/` for the server's name, size, number of terminals and memory logging.
- **Changes:** only `infra/README.md` names the server: 13 terminals instead of 10, Autologon command with `$env:COMPUTERNAME` instead of the M+'s fixed host name, new section on `RAM-Log` and `PoolWatch`, and the RAM file in the checks. `.claude/CLAUDE.md` and `backend/docs/architecture.md` describe the server without naming the machine or its size: unchanged.
- **Outcome:** ✅
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 9 · [infra] Switch

- **When:** 2026-11-19, a Thursday with the market open, at the operator's request (not a weekend as planned). The XL+ was already on the pushed `master` (`c2c4730`); the local commits since then touch only `specs/` and `infra/README.md`.
- **Timeline (local time):**

| Time | Step |
|---|---|
| 12:46:55 | XL+: `AMFX-Watchdog` disabled, backend stopped |
| 12:47:00 | M+: `AMFX-Watchdog` disabled, backend stopped, 13 terminals closed |
| 12:47:06 | Final `pg_dump` on the M+ (8.3 s, 38.1 MB) → relay → `pg_restore` on the XL+ (22 s) |
| 12:47:54 | XL+: `FEATURE_ALERTS` removed from `.env` (default on), backend started, watchdog enabled; local `/health` 12/13 connected |
| 12:48:18 | M+: `run-switch-050.ps1 -TimeoutS 180` |
| 12:48:44 | XL+: `Start-Service Cloudflared` |
| 12:48:51 | Public `/health` 200; XL+ `Cloudflared` set to automatic |

- **AC 2:** final row counts equal on both servers, table by table (19 tables; `candles` 3 127 469, `trades` 50 784, the rest as in task 4). Dump kept in `C:\backup\amfx050.dump` on both servers.
- **AC 1, AC 3:** public `/health` reports the XL+'s backend (uptime matching its start) with the same 12 brokers `connected` and `solidary isa` `listening`.
- **AC 8:** `ssh amfx-vps` first hung after the host-key check: the XL+ did not authorise the `github-actions` key used by the PC alias and by the pipelines (it had been reached with another key). Added to `administrators_authorized_keys`; `ssh amfx-vps hostname` → `WIN-5SSFL41HHDI`. The M+'s `switch050.log` could not be read afterwards (the M+ is only reachable through the tunnel); the public checks above show it took the `SWITCHED` branch.
- **Interruption:** the public app was down about 2 minutes; ticks stopped for about 50 s.
- **Outcome:** ✅
- **Est vs Actual:** 2 SP · 1 SP.

## Task 10 · [infra] Production validation

- **Operator (2026-11-19):** session kept without logging in again; Accounts with the 12 brokers live; chart with live ticks; positions, history and balances; a price alert reached the phone (no need to enable the device again: same origin, subscriptions and VAPID keys); an order opened and closed on Demo; a candle sync of Demo M15 ran on the XL+ to `done` (AC 4).
- **Pipelines run by hand (`workflow_dispatch`), one at a time (AC 5):** backend #201 green, the XL+ backend restarted and came back with 12/13 connected, new `dist` on `WIN-5SSFL41HHDI`; frontend green, new `dist\index.html` on the XL+ at 12:31 UTC; EA green, compiled and reloaded the 13 terminals ("Terminals running: 13/13 in 300 s"). During that reload the XL+ peaked at 5.2 GB of 16 GB (`RAM-Log`), with no incident — the reload that crashed the M+ on 18 Nov.
- **Finding:** after the EA reload, the state EAs of `FTMO` and `solidary marquez` kept failing to open their pipe ("[PIPE] Connection failed", several times a second) although the backend listened on both; restarting the backend did not help, the operator reopening the two terminals did. EA-side reconnection issue, not tied to the server; if it repeats on later EA deploys it gets its own spec.
- **Port 22:** Windows rule `OpenSSH-Server-In-TCP` disabled on the XL+; a direct SSH to its IP times out, `ssh amfx-vps` still works through the tunnel. The operator removed the port 22 rule in the IONOS firewall the same day.
- **Resources in production (2026-11-19):** CPU 13 % average (13 terminals 11.6 %, backend 2.2 %, PostgreSQL 0.5 %); RAM 2.6–3.7 GB of 16 GB.
- **Outcome:** ✅
- **Est vs Actual:** 1 SP · 1.5 SP (deploy key, the two terminals).
