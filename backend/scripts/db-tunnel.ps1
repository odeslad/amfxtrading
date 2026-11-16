# Opens an SSH tunnel to the VPS PostgreSQL for local development.
# Requires: cloudflared installed, ~/.ssh/github_actions_vps key, and a
# Cloudflare Access allow policy for your email on ssh.amfxtrading.com
# (run `cloudflared access login https://ssh.amfxtrading.com` once).
# Keep this window open while developing; local port 5433 maps to the VPS database
# (5432 is taken by the locally installed PostgreSQL service).

ssh -N -L 5433:localhost:5432 `
  -o "ProxyCommand=cloudflared access ssh --hostname ssh.amfxtrading.com" `
  -o StrictHostKeyChecking=no `
  -i "$HOME/.ssh/github_actions_vps" `
  Administrator@ssh.amfxtrading.com
