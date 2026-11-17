# 048 — Rename the project to amfxtrading · Design

## Approach

The rename is split into seven blocks, ordered from least to most risk. Each block leaves the system working and can be undone on its own, so the work can stop after any of them. Only block 4 (server folder and database) needs a window with the market closed.

| Block | What | Stops the system | Who |
|---|---|---|---|
| 1 | Public addresses | No (a few seconds of the tunnel) | Assistant; operator only if Cloudflare asks for a login |
| 2 | GitHub repository | No | Assistant |
| 3 | Names inside the repository | No (goes out with block 4) | Assistant |
| 4 | Server folder and database | Yes, backend and web for some minutes | Assistant, with the operator present |
| 5 | Cloudflare tunnel name and leftovers | No | Operator in the Cloudflare panel |
| 6 | Local folders | No | Operator, with the editor closed |
| 7 | Retire the old addresses, 30 days later | No | Assistant |

No application code changes behaviour. No dependency is added. The EA ↔ backend contract is not touched.

## What was found on the server and in the code

- **The tunnel is configured on the server** (`C:\Users\Administrator\.cloudflared\config.yml`): it lists `ssh-v2`, `v2` and `api-v2`. New addresses are added by editing that file; they do not depend on the Cloudflare panel, except for the DNS record of each address.
- **The backend already accepts the new addresses**: its rule allows `amfxtrading.com` and any subdomain. No code change.
- **The session cookie belongs to `.amfxtrading.com`**, so a user who is logged in at `v2.amfxtrading.com` stays logged in at `amfxtrading.com`. Logging in again should not be needed (to be checked in block 1).
- **What the browser keeps per address is lost**: the permission for notifications, the installed app on the phone, and the local preferences (chart selection, chart tools, split view).
- **nginx** serves the web from `C:/amfxtradingv2/frontend/dist`; its configuration is on the server only, not in git.
- **The terminals do not depend on the project folder**: MT4 and the bridge files live in the user profile. Block 4 does not need to stop them.
- **Two scheduled tasks** (`AMFX-Startup`, `AMFX-Watchdog`) point at the startup script inside the folder.
- **The database** `amfxtradingv2` weighs about 2 GB and is used only by the backend.

## Block 1 — Public addresses

1. Add `amfxtrading.com`, `api.amfxtrading.com` and `ssh.amfxtrading.com` to the tunnel configuration on the server, next to the three old ones. The file is validated (`cloudflared tunnel ingress validate`) before the service is restarted.
2. Point the three DNS records at this tunnel. Today they point at the tunnel of the cancelled server. Done from the server with `cloudflared tunnel route dns --overwrite-dns` if the server holds the Cloudflare login certificate; otherwise the operator changes the three records in the Cloudflare panel.
3. Check the Cloudflare Access rule of `ssh.amfxtrading.com`: it exists since the cancelled migration and must let in the same service tokens as `ssh-v2` (the one of GitHub and the one of the operator's PC).
4. Frontend: the address of the API written by `frontend/scripts/deploy.ps1` becomes `https://api.amfxtrading.com`; frontend deploy.
5. Redirect: nginx answers requests for `v2.amfxtrading.com` with a permanent redirect to the same path at `amfxtrading.com`. `api-v2` and `ssh-v2` keep working without redirect during the 30 days (the pipelines and tools move to the new ones in block 3).

Notifications during the 30 days: the subscriptions made at the old address stay stored and keep delivering, so nobody stops receiving alerts on the day of the change. A device that allows notifications again at the new address may receive each alert twice until block 7 removes the old subscriptions.

Undo: remove the three new addresses from the tunnel file, remove the redirect, deploy the frontend with the old API address.

## Block 2 — GitHub repository

The repository is renamed to `odeslad/amfxtrading` (the name was freed on 2026-11-17 by renaming the MVP to `amfxtrading-v1`). The remote of the local copy and the remote of the server copy are updated. GitHub keeps redirecting the old name, and the secrets and workflows of the repository survive the rename.

Undo: rename back.

## Block 3 — Names inside the repository

18 files outside `archive/`:

| Layer | Files | Change |
|---|---|---|
| infra | 3 workflows, `infra/scripts/startup.ps1`, `register-startup-tasks.ps1`, `infra/README.md` | folder `C:\amfxtrading`, host `ssh.amfxtrading.com` |
| backend | `scripts/deploy.ps1`, `ecosystem.config.js`, `scripts/db-tunnel.ps1`, `.env.example`, `scripts/ws-measure.ts`, 2 tests | folder, database name, hosts; the tests use a sample address |
| frontend | `scripts/deploy.ps1` | folder (the API address changes in block 1) |
| ea | `scripts/compile-ea.ps1`, `scripts/distribute-ea.ps1`, `docs/deploy.md` | folder, host, tunnel name |
| docs | `.claude/CLAUDE.md` | title and folder tree |

One commit per layer. They are pushed during block 4, in this order and one at a time, because each push deploys into the new folder: infra first (it triggers no pipeline and carries the workflows), then backend, then frontend, then ea. The backend push goes alone, with no other pipeline running.

## Block 4 — Server folder and database (window with the market closed)

1. Record the row count of every table. Take a backup of the database **without the rows of `candles`**: that table has damaged pages and a full dump fails on it; its rows come from MT4 and the rename does not rewrite them. Copy `.env`, `brokers.json` and `nginx.conf` aside.
2. Pause `AMFX-Watchdog`, stop the backend (pm2) and nginx. The terminals keep running; they reconnect by themselves when the backend comes back.
3. Rename the database: `ALTER DATABASE amfxtradingv2 RENAME TO amfxtrading`. It changes only the name, in an instant.
4. Rename the folder `C:\amfxtradingv2` to `C:\amfxtrading`.
5. Update what is outside git: `DATABASE_URL` and `BROKERS_FILE` in `.env`, the web root in `nginx.conf`, the antivirus exclusion, the two scheduled tasks (registered again with the new path).
6. Push the commits of block 3 one at a time; each pipeline deploys into the new folder. The EA pipeline reloads the 13 terminals, one by one.
7. Start nginx, resume `AMFX-Watchdog`, check: `/health`, the same brokers connected, the app, an alert, row counts equal to step 1.

Expected stop: 10 to 20 minutes of backend and web.

Undo at any step: rename the folder and the database back, put the three copied files back, start the backend with pm2. The commits of block 3 are reverted if they were already pushed.

## Block 5 — Cloudflare tunnel name and leftovers (operator)

- Delete the tunnel of the cancelled server (it is called `amfxtrading` and is dead).
- Rename the tunnel `amfxtrading-v2` to `amfxtrading` if the Cloudflare panel allows it. If it does not, the name stays: it is visible only in that panel and in one document, which will say so.

## Block 6 — Local folders (operator, editor closed)

- `c:\Work\Odeslad\amfxtrading` (the MVP) → `amfxtrading-v1`.
- `c:\Work\Odeslad\amfxtradingv2` → `amfxtrading`.
- The assistant's notes for this project are kept in a folder named after the path; they are copied to the folder of the new path so that they are not lost.
- SSH shortcuts of the PC: `amfx-vps` points at `ssh.amfxtrading.com`; `amfx-vps-old` is removed.

The assistant cannot rename the folder it is working in, so it leaves the exact commands and the operator runs them with the editor closed.

## Block 7 — Retire the old addresses (30 days after block 1)

Remove `v2`, `api-v2` and `ssh-v2` from the tunnel file and their DNS records, remove the redirect from nginx, and delete the notification subscriptions made before block 1.

## What each user has to do again (AC 8)

| What | Needed? |
|---|---|
| Log in | Probably not (the session is valid for the whole domain); checked in block 1 |
| Allow notifications, on each device | Yes |
| Reinstall the app on the phone, if it was installed | Yes |
| Chart selection, chart tools, split view | Yes, they start at their defaults |
| Alerts, drawings, indicators, settings | No, they are stored on the server |

## Risks

- **Losing access to the server** if the tunnel does not come back after a change to its file. The file is validated before the restart and a copy of the previous one is kept; the operator keeps remote desktop or the provider's console as the way back in.
- **The server has 4 GB and a history of restarts** during deploys and starts. Block 4 deploys three times and reloads the terminals; everything goes one at a time, with the market closed.
- **Backup without candle rows.** Accepted by the operator on 2026-11-17 (the candles and the state of the database go to a later spec): a full dump is not possible on this server. The rename itself does not rewrite data, and the row count of `candles` is compared before and after.
- **Double notifications** for 30 days on devices that subscribe at the new address.
- **`www.amfxtrading.com`** (future corporate site) is not touched; the app takes the address without `www`.
