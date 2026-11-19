# 050 — Migrate the platform to the VPS XL+ · Design

## Approach

Build the XL+ as an **exact replica of the M+**: same user (`Administrator`), same paths (`C:\amfxtrading`, `C:\nginx`, `C:\Program Files (x86)\<MT4>`, `MetaQuotes\Terminal\<hash>`), same database name, role and password, same software versions, same secrets. Then **move the existing Cloudflare tunnel** from the M+ to the XL+: the tunnel is locally managed, so its credentials file and `config.yml` are copied to the XL+, and switching means stopping `cloudflared` on the M+ and starting it on the XL+.

With the same tunnel, the public names, DNS records, Access application, GitHub secrets and workflows stay exactly as they are. **No file of the repository changes** except documentation; nothing about the switch is committed except the evidence in `verification.md`.

### Alternative considered: a second tunnel (spec 043's method)

| | Move the tunnel (chosen) | Second tunnel |
|---|---|---|
| DNS / Access / workflows | untouched | three DNS routes overwritten, Access hostname, workflows changed |
| Switch | stop on M+, start on XL+ (seconds) | DNS change + repo push |
| Rollback | the reverse (seconds) | DNS + revert of commits |
| Testing the XL+ before the switch | through SSH port forwarding on port 22 | on its own public names |

The two copies of the same tunnel must never run at the same time: Cloudflare would split traffic between them. The switch runbook stops one before starting the other.

## Inventory to copy (M+ → XL+)

| Item | How |
|---|---|
| Base system | power plan without sleep, Windows Update without automatic reboots in market hours, time zone UTC. Defender and services: already done on the XL+ (2026-11-18) |
| Software, same versions as the M+ | Node, npm, pm2, git, PostgreSQL 17, nginx (`C:\nginx` copied whole, with `nginx.conf`), `nssm` in `C:\nssm`, cloudflared. Versions read from the M+ at the start of task 1 |
| Project | `git clone` into `C:\amfxtrading`; untracked files copied: `backend\.env`, `backend\brokers.json`; `npm install`, `prisma generate`, backend and frontend builds |
| Database | `pg_dump -Fc` on the M+ → relayed through the PC → `pg_restore` on the XL+ (430 MB, a few seconds) |
| MT4 | the 13 installation folders and the whole `MetaQuotes\Terminal` tree to the same paths (the data-folder hash comes from the installation path, so `origin.txt`, `brokers.json` and each bridge `config.json` stay valid) |
| Tunnel | `C:\Users\Administrator\.cloudflared\` (credentials JSON, `config.yml`, `cert.pem`); service installed like the M+'s (LocalSystem, `--config` on that file) but left **stopped and manual** until the switch |
| SSH identity | the M+'s host keys (`C:\ProgramData\ssh\ssh_host_*`) copied to the XL+, so `ssh amfx-vps` and the pipelines see the same server identity after the switch (no known-hosts warning) |
| Tasks | `AMFX-Startup` and `AMFX-Watchdog` (`register-startup-tasks.ps1`), `PoolWatch` and `RAM-Log` as on the M+. On the M+ `RAM-Log` writes no file: fixed on the XL+ so AC 9 has data |
| Autologon | the operator, by RDP (the README command with the XL+'s host name) |

Lessons from spec 043 applied: the PostgreSQL installer fails from an SSH session (run it through a one-off `SYSTEM` scheduled task); restarting `cloudflared` cuts the SSH session that runs it (do it from a scheduled task with automatic rollback); saved MT4 logins survived a copy; a reboot test proves the startup chain.

## Coexistence before the switch

During preparation the XL+ runs its backend and its 13 terminals next to the M+, as in spec 043:

- **Not public**: the tunnel is stopped on the XL+; it is reached only by SSH on port 22 (key login only) with port forwarding to check the app.
- **Alerts off** on the XL+ (`FEATURE_ALERTS=false`), so no notification goes out twice.
- **No orders** are sent from the XL+; only the operator could, through the forwarded port.
- The terminals log into the same accounts on both machines (the operator authorised it in spec 043; 11 of 13 connected then without problems). If a broker drops the M+'s session, that terminal is closed on the XL+ until the switch.

## Switch (weekend, market closed)

1. Stop the XL+ backend.
2. Stop the M+ backend and terminals (`AMFX-Watchdog` disabled on the M+ so it does not restart them).
3. Final `pg_dump` on the M+ → `pg_restore` on the XL+; row counts compared table by table (AC 2). The dump file is kept.
4. `FEATURE_ALERTS` back to on in the XL+'s `.env`; start the XL+ backend.
5. Stop and disable `cloudflared` on the M+; start it on the XL+ and set it to automatic (from a scheduled task, with rollback to the M+ if `/health` does not answer through the tunnel within 2 minutes).
6. Checks through the public names: `/health`, login, ticks, positions, a push notification, a sync of one timeframe (AC 3, AC 4); `ssh amfx-vps` lands on the XL+ (host name check); a manual run of each pipeline (`workflow_dispatch`) deploys to the XL+ (AC 5).
7. Close port 22 on the XL+ (Windows rule and IONOS firewall rule, the latter by the operator).

The M+ stays installed, with its tunnel service disabled and its terminals stopped.

### Rollback (until the M+ is cancelled)

Stop `cloudflared` on the XL+, start it on the M+, start the M+'s backend and terminals and re-enable its watchdog. Data created on the XL+ after the switch (alerts, drawings, settings, book) is carried back with a dump of those tables; candles, trades and balances come back from the terminals. Written step by step in `verification.md` before the switch.

## Observation and closing

- Memory with the 13 terminals open measured and recorded (AC 9).
- 14 days with no event 41, 1001 or 6008 on the XL+ (AC 10), inside its refund window (around 18 Dec 2026). Then the operator cancels the M+.

## Files to touch in the repo

- `infra/README.md`: the server it describes, the Autologon command without a fixed host name, `RAM-Log` and `PoolWatch`.
- `.claude/CLAUDE.md` and `backend/docs/architecture.md`: only if they name the server's size or host.
- `specs/050-migrate-to-vps-xl/{en,es}/verification.md`.

Outside the repo: nothing on the PC (`ssh amfx-vps` keeps its host name; the host keys are the same).

## Dependencies

None added.

## Risks

- **Two copies of the tunnel running at once** would split traffic. Mitigated by the runbook and by the XL+'s service staying manual until the switch.
- **The XL+ is slower per core** (2.0 vs 2.6 GHz): ticks with 13 terminals could be slower. Measured during preparation with the terminals running; if it is not acceptable, the migration stops before the switch and the XL+ is returned.
- **The XL+ could also crash** (same provider): 14 days of observation with the M+ ready to come back.
- **A broker may refuse two sessions** of one account during preparation: that terminal waits on the XL+ until the switch.
- **Port 22 is public on the XL+ until the switch** (key login only).
- **Pushes during preparation** still deploy to the M+ (the tunnel is there). Fine, but the XL+ must be brought to the same commit before the switch (`git pull` + builds in the runbook).
