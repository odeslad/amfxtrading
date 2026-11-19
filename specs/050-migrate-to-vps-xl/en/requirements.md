# 050 — Migrate the platform to the VPS XL+

> Status: **approved**

## Context

Everything runs on one IONOS VPS M+ (Windows Server 2025, 4 vCPU, 4 GB RAM): the 13 MT4 terminals with their EAs, the backend (Node + pm2), the frontend served by nginx, PostgreSQL, the startup and watchdog tasks, and the Cloudflare tunnel that publishes `amfxtrading.com`, `api.amfxtrading.com` and `ssh.amfxtrading.com`. Between 17 Jul and 18 Nov 2026 the M+ crashed 26 times, always with bugcheck `0x1A / 0x3F`. WinDbg puts the cause below the guest: pages written to the page file come back changed, which points at the host's memory or storage. The report for IONOS is with the operator; the result of their review is not waited for.

Spec 049 left the database small and healthy (430 MB, full `pg_dump` in 9 s), so it can now be copied whole. A VPS XL+ (8 vCPU EPYC Milan at 2.0 GHz, 16 GB RAM, Windows Server 2025) is already contracted, reachable by SSH and set up like the M+ (Defender off with exclusions, the same 11 services disabled). It is slower per core than the M+ in the benchmark, and it can be returned within 30 days of purchase (around 18 Dec 2026).

## Affected layers

- infra (new server, Cloudflare tunnel, scheduled tasks, nginx, pm2, deploy pipelines, server access from the operator's PC)
- db (copy of the database; no schema change)
- backend, frontend, ea: deployed unchanged to the new server; code changes only if a path or setting tied to the old server shows up

## User stories

- As the operator, I want the whole platform on the XL+, so that it stops crashing.
- As the operator, I want the switch made in a short window with the market closed, so that trading is not affected.
- As the operator, I want to be able to go back to the M+ if the XL+ fails during the first days, so that the switch carries no risk.
- As a user of the app, I want the same address, login and data after the switch, so that I notice nothing.

## Acceptance criteria

- AC 1. WHEN the switch ends THEN `amfxtrading.com`, `api.amfxtrading.com` and `ssh.amfxtrading.com` are served by the XL+, with the same addresses as before.
- AC 2. WHEN the database is copied THEN every table has the same row count on both servers (recorded), and the copy taken at the switch is kept until the operator validates.
- AC 3. WHEN the switch ends THEN the 13 terminals run on the XL+ with their EAs, and the same brokers as before are connected (`/health`).
- AC 4. WHEN the switch ends THEN ticks, positions, history, balances, charts, alerts (price and EMA, with Web Push), orders and the candle sync work as before.
- AC 5. WHEN something is pushed after the switch THEN the backend, frontend and EA pipelines deploy to the XL+ and not to the M+.
- AC 6. WHEN the XL+ restarts THEN everything comes back on its own as on the M+ (autologon, startup task, terminals, backend, nginx, tunnel), and the watchdog works.
- AC 7. WHILE the switch happens THEN the market is closed, and until the M+ is cancelled it can be started again as it was.
- AC 8. WHEN the operator connects from the PC THEN `ssh amfx-vps`, the database tunnel and the deploy scripts reach the XL+.
- AC 9. WHEN the XL+ runs with the 13 terminals open THEN its memory use is measured and recorded, with RAM logging working.
- AC 10. WHEN the first two weeks pass THEN the XL+ shows no bugcheck or unexpected shutdown in the event log, before the M+ is cancelled.
- AC 11. WHEN the repository changes THEN no IP address or secret is committed (the repository is public).

## Out of scope

- Any change of behaviour of the app, the backend or the EA.
- Waiting for IONOS's answer about the M+.
- A dedicated server or a server at home.
- The corporate website at `www.amfxtrading.com`.
- Making the XL+ faster per core.
