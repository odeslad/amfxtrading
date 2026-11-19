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
