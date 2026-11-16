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
