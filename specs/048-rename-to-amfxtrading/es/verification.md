# 048 — Renombrar el proyecto a amfxtrading · Verificación

## Tarea 1 · [infra] Direcciones nuevas en el túnel

- **Mecanismo:** manual.
- **Pasos (2026-11-17, 18:40–18:49 UTC):**
  - Fichero del túnel del servidor: las tres direcciones nuevas añadidas junto a las antiguas; `cloudflared tunnel ingress validate` → OK; fichero anterior guardado como `config.yml.bak-048`. Aplicado con una tarea puntual de SYSTEM que reiniciaba el servicio y restauraba el fichero anterior si `api-v2` dejaba de responder; no hizo falta (log: "new config running, old address answers"). La tarea se borró después.
  - DNS: `api.` y `ssh.amfxtrading.com` apuntados a este túnel con `cloudflared tunnel route dns --overwrite-dns`. El registro de `amfxtrading.com` no se pudo sobrescribir con la herramienta; el operador cambió su destino en el panel de Cloudflare a `fb1c65c3-9f0b-4aae-ada6-69b794760ee0.cfargotunnel.com`. Los registros MX y TXT de `amfxtrading.com` (correo) no se tocaron.
  - SSH: la huella del servidor detrás de `ssh.amfxtrading.com` (ED25519 `SHA256:hbHZ3E1O…`) es la misma que detrás de `ssh-v2`; actualizada en los hosts conocidos del PC (copia guardada como `known_hosts.bak-048`); `ssh amfx-vps` llega a `WIN-16ESVKMCVCR`.
  - Cloudflare Access: la aplicación "VPS SSH" cubre `ssh-v2.amfxtrading.com` más otro dominio, con la política `github-actions`. El token de GitHub en sí se comprueba en la tarea 10, cuando los pipelines pasen por la dirección nueva.
- **Resultado:** ✅ `amfxtrading.com` 200 (la misma página que `v2`), `api.amfxtrading.com/health` 200 con 12/13 brokers conectados (el 13.º, `solidary isa`, no tiene EA, como antes), `v2.`, `api-v2.` y `www.` 200, el SSH por la dirección nueva funciona.
- **Est vs Actual:** 1.5 SP · 1 SP.
