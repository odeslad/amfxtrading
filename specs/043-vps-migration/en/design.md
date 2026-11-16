# 043 — VPS migration · Design

## Approach

Build the new VPS as a **replica of the old one with the same user name, versions and secrets** (and the same paths except the project folder, see "Dropping the `v2` name"), and publish it under **its own names** through **its own Cloudflare tunnel**, so that both systems run side by side:

| | Old VPS (`WIN-16ESVKMCVCR`) | New VPS (`WIN-E5FGF0D8OH7`) |
|---|---|---|
| App | `v2.amfxtrading.com` | `amfxtrading.com` |
| API / WebSocket | `api-v2.amfxtrading.com` | `api.amfxtrading.com` |
| SSH | `ssh-v2.amfxtrading.com` | `ssh.amfxtrading.com` |

There is no cutover with downtime: the user starts using the new address once the final data copy is done, and the old system stays up as a fallback until it is switched off. `www.amfxtrading.com` (future corporate website) is not touched.

This replaces the first version of this design (moving the existing tunnel), after the user asked for both systems to coexist and confirmed that `amfxtrading.com` and `api.amfxtrading.com` are free to use.

## Inventory of the old VPS (measured 2026-11-16, read-only)

| Item | Value |
|---|---|
| OS / size | Windows Server 2025 Datacenter · 4 vCPU · 4 GB RAM (0.75 GB free) · 128 GB disk (71 GB free) · time zone UTC |
| Software | Node 24.16.0 · npm 11.13.0 · pm2 7.0.1 · git 2.54.0 · PostgreSQL 17.10 · cloudflared 2026.6.0 · nginx in `C:\nginx` |
| Services | `postgresql-x64-17` (NetworkService) · `nginx` (LocalSystem, wrapped by `nssm`) · `Cloudflared` (LocalSystem, `--config C:\Users\Administrator\.cloudflared\config.yml`) · `sshd` |
| Tunnel | `fb1c65c3-9f0b-4aae-ada6-69b794760ee0`, locally managed; ingress `ssh-v2` → `ssh://localhost:22`, `v2` → `http://localhost:80`, `api-v2` → `http://localhost:3000`. `cert.pem` is in `C:\Users\Administrator\.cloudflared\` |
| Project | `C:\amfxtradingv2`; untracked: `backend\.env` (12 keys), `backend\brokers.json`, `frontend\dist`, `C:\nginx\conf\nginx.conf` |
| MT4 | **13** installations under `C:\Program Files (x86)\` (68 MB each) and **13** brokers in `brokers.json` (not 10, as the docs say); data folders under `C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\<hash>` (≈ 0.6 GB in total) |
| Database | data directory 3.5 GB |
| Scheduled tasks | `AMFX-Startup`, `AMFX-Watchdog`, `PoolWatch` (running, script `C:\pool-watch.ps1`). `RAM-Log` was not found at the task root — to be located during implementation |
| Other | Autologon enabled · `C:\monitoring`, `C:\deploy` |

New VPS (measured over SSH): Windows Server 2025 Datacenter · 4 vCPU · 8 GB RAM · 239 GB disk · time zone UTC · user `Administrator` · IP `<new VPS IP>` (IONOS). SSH reachable on port 22 with the deploy key (temporary, until the tunnel is up).

DNS today: `amfxtrading.com`, `www` and `api` already have proxied records in Cloudflare (the user confirmed the first and the third serve nothing and may be replaced); `ssh.amfxtrading.com` does not exist.

## Per-layer changes

### infra — new machine

1. **Base system**: time zone UTC (already), power plan without sleep, Windows Update restricted so that it never reboots by itself during market hours, Defender exclusions for `C:\amfxtrading`, the PostgreSQL data directory and the MT4 folders.
2. **Software, same versions as the inventory**: Node 24.16.0, git, pm2 7.0.1 (`npm i -g`), PostgreSQL 17 (silent installer, same port, same role and password as `DATABASE_URL`), nginx (the whole `C:\nginx` folder copied, including `nginx.conf`, with `server_name` adapted if it names `v2`) registered as a service with `nssm`, cloudflared 2026.6.0.
3. **Project**: `git clone` into `C:\amfxtrading`; `backend\.env` and `backend\brokers.json` copied from the old VPS; `npm install`, `prisma generate`, backend build, frontend build with `VITE_API_BASE=https://api.amfxtrading.com`.
4. **Tasks**: `register-startup-tasks.ps1` for `AMFX-Startup` / `AMFX-Watchdog`; `RAM-Log` and `PoolWatch` replicated; `C:\monitoring` and `C:\deploy` created.
5. **Autologon**: the user, by RDP.

### infra — tunnel, DNS and Access

- **New tunnel** `amfxtrading` created on the new VPS with `cloudflared tunnel create`, authorised by the `cert.pem` copied from the old VPS (it authorises the whole zone). Not verified yet: if that certificate is rejected, the user runs `cloudflared tunnel login` once by RDP.
- **Ingress**: `amfxtrading.com` → `http://localhost:80`, `api.amfxtrading.com` → `http://localhost:3000`, `ssh.amfxtrading.com` → `ssh://localhost:22`, catch-all 404. Service installed as on the old VPS (LocalSystem, `--config` pointing at the user profile).
- **DNS**: `cloudflared tunnel route dns --overwrite-dns` for the three names. This **replaces the existing records** of `amfxtrading.com` and `api.amfxtrading.com`; `www` is left as it is. All three names are single-label or apex, so Universal SSL covers them.
- **Access**: `ssh.amfxtrading.com` must be protected like `ssh-v2` (Service Auth policy for the `github-actions` token + Allow for the user's email). **The user adds the hostname to the existing "VPS SSH" application in the dashboard**; this cannot be done with the tunnel certificate. Until then SSH goes through the IP on port 22; afterwards that port is closed in Windows and in the IONOS policy.

### backend

- **Code**: `ALLOWED_ORIGINS` in `src/ws/policy.ts` is `/\.amfxtrading\.com(:\d+)?$/`, which requires a subdomain: the apex `https://amfxtrading.com` is rejected today by both CORS and the WebSocket upgrade. The pattern is widened to accept the apex as well, with a test case. Subdomains keep working, so the old system is unaffected.
- `scripts/db-tunnel.ps1`: hostname `ssh-v2` → `ssh`.
- Configuration on the new VPS: `.env` copied unchanged (`COOKIE_DOMAIN` default `.amfxtrading.com` already covers the apex and `api`), plus `FEATURE_ALERTS=false` until the switch.

### frontend

- `scripts/deploy.ps1` writes `VITE_API_BASE=https://api-v2.amfxtrading.com` → `https://api.amfxtrading.com`. Any other hard-coded `v2` address found in `frontend/src` during implementation is listed and changed in the same task.

### .github

- The three workflows: `ssh-v2.amfxtrading.com` → `ssh.amfxtrading.com`. Secrets unchanged (same key, same service token, same user). From this commit on, pipelines deploy **only to the new VPS**; the old one stays frozen at its last deployed commit.

### db

`pg_dump -Fc` on the old VPS → file relayed through the developer PC → `pg_restore` into an empty database on the new VPS. Done twice: a rehearsal during preparation and the final copy at the switch. The old backend is **not stopped** for the final copy: tables fed by the EA (`candles`, `trades`, `balances`, `balance_operations`) are refilled on the new VPS by its own terminals (full candle and trade history on EA start, the last 100 bars every 60 s); user-created tables are copied as they are at that moment, and the user creates nothing on the old system from then on. Verification: row counts of the user-created tables equal on both sides, `prisma migrate diff` empty. A dump/restore rewrites every page, so no damaged block is carried over; an "invalid page" error during `pg_dump` is retried (known transient behaviour of the old machine).

### ea — MT4 terminals

Copy the 13 installation folders and the whole `MetaQuotes\Terminal` tree to the **same paths**. The data-folder hash is derived from the installation path, so the hashes, `origin.txt`, `brokers.json` and each bridge `config.json` remain valid. The 13 terminals run on both machines at once (authorised by the user).

## Dropping the `v2` name

Requested by the user during implementation (after task 4): on the new system the name is `amfxtrading`, without `v2`.

| Where | Old | New | In this spec |
|---|---|---|---|
| Project folder on the server | `C:\amfxtradingv2` | `C:\amfxtrading` | yes |
| Database | `amfxtradingv2` | `amfxtrading` | yes (created with the new name; the dump is restored into it) |
| Public names | `v2`, `api-v2`, `ssh-v2` | apex, `api`, `ssh` | yes |
| Tunnel | `amfxtrading-v2` | `amfxtrading` | yes |
| GitHub repository `odeslad/amfxtradingv2` and the local folder | — | — | **no**: the name `amfxtrading` is taken there by the v1 MVP; the user decides later |

Consequences:

- The repo hard-codes `C:\amfxtradingv2` in 14 files (workflows, `backend/scripts/deploy.ps1`, `backend/ecosystem.config.js`, `backend/.env.example`, `frontend/scripts/deploy.ps1`, `ea/scripts/*.ps1`, `infra/scripts/*.ps1`, docs). They change to `C:\amfxtrading` in the same commits that switch the host names, one commit per layer.
- Once those commits are on `master`, the repo scripts no longer match the old VPS. A push before the workflows point at the new host would run the pipelines against the old machine with the new paths (the EA workflow would even create the folder and restart the terminals), so **the path and host-name commits are pushed together, and only when the new tunnel answers**. That moves the tunnel (task 8) and the repo changes (tasks 9–12) ahead of the database rehearsal and the terminals (tasks 5–7).
- `backend\.env` on the new VPS: `DATABASE_URL` → database `amfxtrading`, `BROKERS_FILE` → `C:\amfxtrading\backend\brokers.json`. `nginx.conf`: `root C:/amfxtrading/frontend/dist`.

## Coexistence rules

- **Alerts on one machine only.** Both databases hold the same alerts and push subscriptions; with alerts enabled on both, every alert would notify twice. Old = on and new = `FEATURE_ALERTS=false` until the switch; then the reverse.
- **Commands.** Either backend can send orders to the same accounts through its own terminals. That is safe (each order is executed once, by the terminal of the machine that received it, and both machines then see the position), but the user should operate from one address at a time.
- **User data lives where it is created.** Alerts, drawings, settings, mirror presets and the book are not synchronised between the two databases.
- **Sessions.** Same `JWT_SECRET` and cookie domain `.amfxtrading.com`: a session opened on one address is valid on the other.
- **Push and installed app.** Service worker and push subscription belong to the origin: on `amfxtrading.com` the user reinstalls the app on the phone and re-enables notifications. The subscriptions copied from the old origin stay in the new database, so the old installed app would also receive the new system's notifications until it is uninstalled.

## Sequence

1. **Preparation** (old system untouched): base system, software, project, rehearsal database, 13 terminals, tasks, Autologon, reboot test. Tested through SSH port forwarding.
2. **Publication**: backend change deployed, tunnel, DNS, Access hostname, workflows and deploy scripts pointed at the new names; port 22 closed. The new system is now reachable at `amfxtrading.com` with rehearsal data and alerts off. The old one remains production.
3. **Switch** (weekend, no downtime for the user): final database copy (the new backend is stopped for those minutes; the old address keeps working), alerts off on old and on on new, the user moves to `amfxtrading.com`.
4. **Observation** (14 days): old system up as fallback with alerts off. Then the user shuts it down and cancels it.

### Rollback

Go back to `v2.amfxtrading.com`, re-enable alerts on the old backend and disable them on the new one. Data created on the new system after the switch (alerts, drawings, settings, book) is carried back with a dump of those tables; candles and trades need nothing. Deploy pipelines would have to be pointed back at `ssh-v2` (revert of one commit). The procedure is written in `verification.md` before the switch.

## Files to touch in the repo

- `backend/src/ws/policy.ts`, `backend/src/ws/policy.test.ts` — apex origin.
- `backend/scripts/db-tunnel.ps1` — SSH hostname.
- `frontend/scripts/deploy.ps1` — API address.
- `.github/workflows/deploy-backend.yml`, `deploy-frontend.yml`, `deploy-ea.yml` — SSH hostname.
- `infra/README.md`, `ea/docs/deploy.md`, `backend/docs/architecture.md`, `.claude/CLAUDE.md` — documentation.
- `specs/043-vps-migration/{en,es}/verification.md`.

Outside the repo: `~/.ssh/config` on the developer PC (`amfx-vps` → new, `amfx-vps-old` → old).

## Dependencies

None added.

## Risks

- **The apex and `api` records already exist** and are overwritten. The user stated nothing is served there; whatever those records point to today stops being reachable.
- **`cert.pem` may not authorise creating the tunnel or the DNS routes** (not verified). Fallback: `cloudflared tunnel login` by the user.
- **Saved MT4 logins may not survive the copy** (not verified). The user logs in by RDP where needed; preparation reveals it for all 13.
- **A broker may limit simultaneous sessions** of one account. It would show as a disconnection on one side; if it hits the old VPS before the switch, that terminal is closed on the new one.
- **The old system receives no deploys** once the workflows point at the new one. The publication and the switch should be days apart, not weeks.
- **Two live systems accepting commands.** Mitigated by the user operating from one address at a time; not enforced technically.
- **The new host could have its own hardware problems** (same provider): 14 days of observation with the old system still up.
- **Port 22 is public during preparation** (key-only login). Closed as soon as the tunnel and Access hostname work.
