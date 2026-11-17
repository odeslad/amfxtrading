# 048 — Rename the project to amfxtrading · Verification

## Task 1 · [infra] New addresses on the tunnel

- **Mechanism:** manual.
- **Steps (2026-11-17, 18:40–18:49 UTC):**
  - Tunnel file of the server: the three new addresses added next to the old ones; `cloudflared tunnel ingress validate` → OK; previous file kept as `config.yml.bak-048`. Applied by a one-off SYSTEM task that restarted the service and would restore the previous file if `api-v2` stopped answering; it was not needed (log: "new config running, old address answers"). The task was deleted afterwards.
  - DNS: `api.` and `ssh.amfxtrading.com` pointed at this tunnel with `cloudflared tunnel route dns --overwrite-dns`. The record of `amfxtrading.com` could not be overwritten by the tool; the operator changed its target in the Cloudflare panel to `fb1c65c3-9f0b-4aae-ada6-69b794760ee0.cfargotunnel.com`. The MX and TXT records of `amfxtrading.com` (mail) were not touched.
  - SSH: the host key behind `ssh.amfxtrading.com` (ED25519 `SHA256:hbHZ3E1O…`) is the same as behind `ssh-v2`; the PC's known hosts updated (copy kept as `known_hosts.bak-048`); `ssh amfx-vps` reaches `WIN-16ESVKMCVCR`.
  - Cloudflare Access: the application "VPS SSH" covers `ssh-v2.amfxtrading.com` plus one other domain, with the `github-actions` policy. The GitHub token itself is proved in task 10, when the pipelines run through the new address.
- **Outcome:** ✅ `amfxtrading.com` 200 (same page as `v2`), `api.amfxtrading.com/health` 200 with 12/13 brokers connected (the 13th, `solidary isa`, has no EA, as before), `v2.`, `api-v2.` and `www.` 200, SSH through the new address works.
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 2 · [frontend] API address

- **Mechanism:** `npm run build` + manual.
- **Steps:** `frontend/scripts/deploy.ps1` writes `https://api.amfxtrading.com`; build ✓; commit `cd69cf9` pushed alone, frontend pipeline green; the published bundle calls `https://api.amfxtrading.com` only.
- **Outcome:** ✅ confirmed by the operator on 2026-11-17 at `amfxtrading.com`: still logged in (the session of `v2` is valid for the whole domain), history loads, prices move.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 3 · [infra] Redirect and notifications

- **Mechanism:** manual.
- **Steps:** a second `server` block in `C:\nginx\conf\nginx.conf` (outside git; previous file kept as `nginx.conf.bak-048`) answers `v2.amfxtrading.com` with a 301 to the same path at `amfxtrading.com`; `nginx -t` OK, service restarted. The service worker only handles notifications and caches no pages, so page loads always reach nginx; subscriptions made at `v2` keep delivering and their clicks land on the new address.
- **Outcome:** ✅ `v2.amfxtrading.com/chart?broker=Demo&symbol=EURUSD` → 301 to `amfxtrading.com/chart?broker=Demo&symbol=EURUSD`; `amfxtrading.com`, `api.` and `api-v2.` 200. The operator allowed notifications at `amfxtrading.com` and a price alert reached the device (2026-11-17). The list of what each user must do again was given to the operator.
- **Est vs Actual:** 1 SP · 0.5 SP.
