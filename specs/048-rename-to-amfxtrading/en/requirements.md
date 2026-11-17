# 048 — Rename the project to amfxtrading

> Status: **implementing**

## Context

The project was born as the second version of an earlier MVP and carries "v2" in almost every name: the GitHub repository (`odeslad/amfxtradingv2`), the folder on the server (`C:\amfxtradingv2`), the database (`amfxtradingv2`), the public addresses (`v2.amfxtrading.com`, `api-v2.amfxtrading.com`, `ssh-v2.amfxtrading.com`), the Cloudflare tunnel (`amfxtrading-v2`), the local working folder and the documents. The MVP is no longer in use and this system is the only one in production, so the "v2" has no meaning any more. The operator wants the project to be called just `amfxtrading` everywhere.

The plain name is partly taken: the MVP keeps a local folder `c:\Work\Odeslad\amfxtrading` and may keep a GitHub repository with that name, and the addresses `amfxtrading.com`, `api.amfxtrading.com` and `ssh.amfxtrading.com` still point at the tunnel of the server cancelled on 2026-11-17 and answer with an error.

In the repository the name appears in 18 files outside `archive/` (workflows, deploy and startup scripts, backend tests and tools, documents): 32 mentions of `amfxtradingv2`, 24 of `ssh-v2`, 28 of `v2.amfxtrading`.

## Affected layers

- infra (workflows, startup and deploy scripts, server folder, scheduled tasks, nginx, Cloudflare tunnel and addresses)
- backend (deploy script, pm2 definition, allowed origins, tests, `.env`)
- frontend (deploy script, address of the API)
- ea (compile and distribute scripts, documents)
- db (database name only; no schema change)

## Decisions taken by default, to confirm with this document

- **Scope: everything.** Public addresses, GitHub repository, server folder, database, Cloudflare tunnel, local folder and documents.
- **The MVP keeps existing, renamed.** Its GitHub repository was renamed to `odeslad/amfxtrading-v1` on 2026-11-17 (done, and its local copy points at it), which frees the name on GitHub. Its local folder becomes `amfxtrading-v1` too.
- **The old addresses keep working for a while.** `v2.amfxtrading.com` sends the visitor to `amfxtrading.com` during 30 days and is then removed.
- **Closed specs are not rewritten.** The documents under `archive/` keep the names they had when they were written.

## User stories

- As the operator, I want the project called `amfxtrading` in every place where it has a name, so that nothing reminds of a version that no longer exists.
- As a user of the app, I want to open it at `amfxtrading.com`, so that the address is the natural one.
- As the operator, I want the change done in one planned window with the market closed, so that trading is not affected.
- As the operator, I want to know beforehand what each user has to do again after the change, so that nobody is surprised.

## Acceptance criteria

- AC 1. WHEN the work ends THEN the app answers at `amfxtrading.com`, the API at `api.amfxtrading.com` and SSH at `ssh.amfxtrading.com`, all served by the server in use.
- AC 2. WHEN a user opens `v2.amfxtrading.com` during the 30 days after the change THEN the browser is sent to the same page at `amfxtrading.com`.
- AC 3. WHEN the work ends THEN the GitHub repository is `odeslad/amfxtrading`, the local copy pushes to it, and the three deploy pipelines run well against it.
- AC 4. WHEN the work ends THEN the server runs the system from `C:\amfxtrading` with the database `amfxtrading`, and nothing running on the server (backend process, scheduled tasks, nginx, tunnel, EA scripts) refers to the old folder or the old database.
- AC 5. WHEN the database is renamed THEN it keeps every table and every row (row counts before and after are recorded), and a backup taken just before (everything except the rows of `candles`, whose table cannot be dumped) is kept until the operator validates the change.
- AC 6. WHEN the work ends THEN the 13 terminals are running and the same brokers as before are connected; ticks, positions, history and alerts work as before.
- AC 7. WHEN the work ends THEN no file of the repository outside `archive/` contains `amfxtradingv2`, `amfxtrading-v2`, `api-v2`, `ssh-v2`, `v2.amfxtrading` or "AMFX Trading v2".
- AC 8. WHEN the change of address is done THEN the operator has, beforehand, the list of what each user must do again: log in, allow notifications again on each device, reinstall the app on the phone if it was installed, and set again what the browser remembered per address (chart selection, chart tools, split view).
- AC 9. WHEN notifications are allowed again on a device THEN a price alert reaches that device from the new address.
- AC 10. WHEN the local folder is renamed THEN the project opens from `c:\Work\Odeslad\amfxtrading` with its tools working (git, builds, SSH access, the assistant's project notes).
- AC 11. WHILE the change is being made THEN it happens with the market closed, and if a step fails the system can be started again as it was before that step.

## Out of scope

- Any change of behaviour of the app, the backend or the EA.
- Changing the server or its size.
- Renaming things inside closed specs under `archive/`.
- The corporate website at `www.amfxtrading.com`.
- Renaming the brokers, the pipes or the MT4 terminals.
- Repairing the `candles` table and bringing the database up to date: a later spec, as agreed with the operator on 2026-11-17. This spec only renames the database; the backup taken before the rename leaves out the candle rows.
