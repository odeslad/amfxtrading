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
