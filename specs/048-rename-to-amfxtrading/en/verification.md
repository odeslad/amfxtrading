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
