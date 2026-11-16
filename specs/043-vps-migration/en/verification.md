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
