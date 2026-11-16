# 043 — VPS migration

> Status: **implementing**

## Context

The whole system (10 MT4 terminals with the EA, backend, PostgreSQL 17, nginx serving the frontend, cloudflared) runs on a single Windows VPS at IONOS (`WIN-16ESVKMCVCR`). That machine has suffered repeated BSODs (`0x1A`, July 2026, relapse on 2 October 2026) and transient PostgreSQL "invalid page" errors, both pointing to faulty RAM on the host, and every unexpected reboot stops trading data until the session is restored. The user has contracted a new VPS and wants the complete system moved there so the reboots stop. Nothing functional changes: same code and same data on a different machine. The new system gets its own public names (`amfxtrading.com`, `api.amfxtrading.com`, `ssh.amfxtrading.com`) so that both machines can run side by side; the old one keeps `v2` until it is switched off. `www.amfxtrading.com` is reserved for the corporate website and is not touched.

## Affected layers

- infra (new machine provisioning, Cloudflare tunnel, scheduled tasks, deploy pipelines)
- backend (configuration: `.env`, `brokers.json`; code: accept the apex domain as an allowed origin; `db-tunnel.ps1`)
- db (data transfer; no schema change)
- ea (bridge configuration per terminal; no code change)
- frontend (static build served from the new machine; the API address in its deploy script)

## User stories

- As the operator, I want the whole system running on the new VPS, so that the unexpected reboots of the IONOS machine stop interrupting my trading.
- As the operator, I want Claude to perform the migration end to end, so that my own work is limited to the steps that genuinely require me.
- As the operator, I want the old VPS kept intact until the new one has proven stable, so that I can go back if something fails.
- As the developer, I want the three deploy pipelines and my local access (SSH, DB tunnel) pointing at the new machine, so that the daily workflow is unchanged.

## Acceptance criteria

- AC 1. WHEN the migration is finished THEN the app answers at `https://amfxtrading.com` (API at `https://api.amfxtrading.com`), served by the new VPS, with login, charts, live ticks, positions, account and commands working for every broker in `brokers.json`.
- AC 2. WHEN the switch is done THEN the new database contains every user-created row the old one had at the moment of the final copy (same row counts in those tables; `prisma migrate diff` against the new database is empty).
- AC 3. WHEN the switch is done THEN every MT4 terminal of `brokers.json` is running on the new VPS, logged in, with the EA attached and connected to the backend pipe, and `GET /health` reports every broker alive.
- AC 4. WHEN both machines run side by side THEN alerts are evaluated on exactly one of them at any time (no duplicated notification), and WHEN the observation period ends THEN the old VPS is switched off.
- AC 5. WHEN the new VPS reboots THEN backend, nginx, PostgreSQL, cloudflared and all MT4 terminals come back without manual intervention (autologon + `AMFX-Startup` / `AMFX-Watchdog`).
- AC 6. WHEN a commit touching `backend/**`, `frontend/**` or `ea/**` is pushed to `master` THEN the corresponding pipeline deploys to the new VPS and passes, including the EA compile and terminal reload.
- AC 7. WHEN the developer runs `ssh amfx-vps` or `backend/scripts/db-tunnel.ps1` THEN they reach the new VPS (the old one stays reachable as `amfx-vps-old` until it is switched off).
- AC 8. WHEN the new VPS is being prepared and tested THEN production on the old VPS keeps working at `v2.amfxtrading.com`, and the move to the new system causes no service interruption.
- AC 9. WHEN the switch fails or the new VPS misbehaves during the observation period THEN the system can be returned to the old VPS following a written rollback procedure, and the old VPS is not decommissioned before that period ends.
- AC 10. WHEN the migration is finished THEN the SSH port of the new VPS is not reachable from the public internet (Cloudflare Tunnel is the only path), and no secret has been committed to the repo.
- AC 11. WHEN the migration is finished THEN `infra/README.md`, `backend/docs/architecture.md` and `.claude/CLAUDE.md` describe the new machine wherever they named the old one.

## Division of work

Claude does everything that can be done over SSH. The user's steps are limited to:

1. Providing the public IP, the administrator user name and the machine specs (OS, RAM, vCPU, disk).
2. One RDP session to run a bootstrap script supplied by Claude (enable OpenSSH Server, install the deploy public key).
3. Enabling Autologon (Sysinternals) by RDP — it needs the Windows password.
4. Logging in to an MT4 account by RDP only where the copied terminal does not reconnect by itself.
5. Adding `ssh.amfxtrading.com` to the Cloudflare Access application that protects SSH (dashboard), and removing the temporary port 22 rule in the IONOS panel.
6. Reinstalling the app on the phone and re-enabling push notifications at the new address.
7. Validating the app in production after the switch and deciding when the old VPS is cancelled.

## Assumptions (taken as recommended defaults; change them at this gate)

- The new machine is **Windows Server** (MT4 and the named pipes require Windows).
- Both systems run **in parallel**, each at its own address; the switch needs no downtime and is done **with the market closed** (weekend) only as a precaution.
- MT4 terminals are **copied** from the old VPS (installations and data folders, same paths) rather than reinstalled, to preserve logins, profiles and the attached EA.
- The old VPS keeps **running as a fallback (alerts off) for two weeks** after the switch.

## Out of scope

- Any functional change in backend, frontend or EA.
- Changing the stack (Linux, containers, managed database, different web server).
- Upgrading versions of PostgreSQL, Node or MT4 beyond what the new OS forces.
- The pending EA refactor (stop writing `positions.json`).
- Cancelling the IONOS contract (the user does it).
- Migrating other projects hosted on the old VPS, if any.
