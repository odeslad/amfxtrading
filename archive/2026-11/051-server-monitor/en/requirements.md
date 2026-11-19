# 051 — Server monitor in Settings

> Status: **closed**

## Context

Everything runs on one Windows VPS (the XL+ since spec 050): 13 MT4 terminals with their EAs, the backend, PostgreSQL, nginx and the Cloudflare tunnel. Today the operator learns how the server is doing only by asking over SSH or RDP: memory, CPU, when it last restarted, whether it crashed, whether every terminal is running. The crashes of the previous server (26 bugchecks between July and November 2026) went unnoticed for months because nothing showed them. The app already shows broker connection state (`/health`), but not the machine.

## Affected layers

- backend (collecting the server's figures, storing a history, an endpoint)
- frontend (a new Settings tab)
- db (table for the history)

## User stories

- As the operator, I want to see at a glance how the server is doing right now (CPU, memory, disk, uptime, services, terminals), so that I do not need SSH or RDP for it.
- As the operator, I want to see when the server last restarted and whether it was a crash, so that a crash never goes unnoticed again.
- As the operator, I want the CPU and memory of the last hours and days, so that I can tell a one-off peak from a trend.
- As the operator, I want to see each MT4 terminal and whether it is running and sending ticks, so that I know which account needs attention.

## Acceptance criteria

- AC 1. WHEN the operator opens Settings › Server THEN it shows the server's host name, Windows version, CPU cores, total memory, last start time and uptime.
- AC 2. WHEN the tab is open THEN CPU use, memory in use, page-file use and free disk space are shown and refreshed at least every 15 seconds without reloading the page.
- AC 3. WHEN the tab is open THEN it shows the state of the services the platform depends on (PostgreSQL, nginx, Cloudflare tunnel, SSH) and of the backend process (uptime, memory, restarts).
- AC 4. WHEN the tab is open THEN it lists every broker of `brokers.json` with whether its terminal process is running, its pipe state, the age of its last tick and the terminal's memory.
- AC 5. WHEN the server has restarted unexpectedly or had a bugcheck in the last 30 days THEN the tab lists each event with its date, its kind (crash with its code, or unexpected shutdown) and the last start is marked as following a crash.
- AC 6. WHEN the operator picks a range of 24 hours or 7 days THEN charts show CPU and memory in use over that range, from samples taken at least once a minute.
- AC 7. WHEN the server restarts THEN the history is kept (it is stored, not held only in memory) and the gap of the restart is visible in the charts.
- AC 8. WHEN samples are older than 7 days THEN they are deleted, so the history does not grow without bound.
- AC 9. WHEN collecting the figures THEN the backend's own CPU use from the monitor stays negligible (well under 1 % on average).
- AC 10. WHEN someone is not logged in THEN the figures are not reachable (same authentication as the rest of the API).
- AC 11. WHEN the page is on a phone THEN it is readable (cards on mobile, tables on desktop).

## Out of scope

- Push notifications or alerts when something goes wrong (a later spec).
- Acting on the server from the app (restarting terminals, services or the machine).
- Monitoring other machines (the old M+ included).
- Network traffic and per-process CPU of every Windows process.
