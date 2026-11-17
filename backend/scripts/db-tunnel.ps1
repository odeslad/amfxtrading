# Opens an SSH tunnel to the VPS PostgreSQL for local development.
# Requires: cloudflared installed and the `amfx-vps` host in ~/.ssh/config, which
# carries the key and the Cloudflare Access credentials (a service token, so no
# browser login is needed).
# Keep this window open while developing; local port 5433 maps to the VPS database
# (5432 is taken by the locally installed PostgreSQL service).

ssh -N -L 5433:localhost:5432 amfx-vps
