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

## Tarea 2 · [frontend] Dirección de la API

- **Mecanismo:** `npm run build` + manual.
- **Pasos:** `frontend/scripts/deploy.ps1` escribe `https://api.amfxtrading.com`; build ✓; commit `cd69cf9` subido solo, pipeline del frontend en verde; el bundle publicado llama solo a `https://api.amfxtrading.com`.
- **Resultado:** ✅ confirmado por el operador el 2026-11-17 en `amfxtrading.com`: sigue con la sesión iniciada (la sesión de `v2` vale para todo el dominio), el historial carga y los precios se mueven.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 3 · [infra] Redirección y notificaciones

- **Mecanismo:** manual.
- **Pasos:** un segundo bloque `server` en `C:\nginx\conf\nginx.conf` (fuera de git; fichero anterior guardado como `nginx.conf.bak-048`) responde a `v2.amfxtrading.com` con un 301 a la misma ruta en `amfxtrading.com`; `nginx -t` OK, servicio reiniciado. El service worker solo gestiona notificaciones y no guarda páginas, así que las cargas de página siempre llegan a nginx; las suscripciones hechas en `v2` siguen entregando y al pulsarlas abren la dirección nueva.
- **Resultado:** ✅ `v2.amfxtrading.com/chart?broker=Demo&symbol=EURUSD` → 301 a `amfxtrading.com/chart?broker=Demo&symbol=EURUSD`; `amfxtrading.com`, `api.` y `api-v2.` 200. El operador permitió las notificaciones en `amfxtrading.com` y una alerta de precio llegó al dispositivo (2026-11-17). Se entregó al operador la lista de lo que cada usuario debe volver a hacer.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Tarea 4 · [infra] Repositorio de GitHub

- **Mecanismo:** manual.
- **Pasos:** el nombre `odeslad/amfxtrading` solo conservaba la redirección de GitHub a `amfxtrading-v1` (el MVP, renombrado antes ese mismo día); el repositorio se renombró de `odeslad/amfxtradingv2` a `odeslad/amfxtrading` con la API de GitHub; el remoto de la copia local y el de la copia del servidor (`C:\amfxtradingv2`) pasan a `https://github.com/odeslad/amfxtrading.git`.
- **Resultado:** ✅ `git fetch` funciona en local y en el servidor; los cuatro secretos de los pipelines (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `SSH_PRIVATE_KEY`, `SSH_USER`) siguen listados tras el renombrado; la copia del MVP sigue llegando a `amfxtrading-v1`.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 5 · [infra] Nombres en workflows y scripts de arranque

- **Mecanismo:** manual.
- **Pasos:** `amfxtradingv2` → `amfxtrading` y `ssh-v2.amfxtrading.com` → `ssh.amfxtrading.com` en los tres workflows, `infra/scripts/startup.ps1`, `infra/scripts/register-startup-tasks.ps1` e `infra/README.md`. No hay ningún analizador de YAML instalado en el PC, así que los workflows se comprobaron de otra forma: deshaciendo la sustitución se obtienen exactamente los ficheros del commit anterior, luego solo cambiaron los nombres. Los dos scripts de PowerShell se interpretan sin errores.
- **Resultado:** ✅ commit hecho, sin subir (sale en la tarea 10).
- **Est vs Actual:** 1 SP · 0.5 SP (tareas 5 a 9 hechas juntas).

## Tarea 6 · [backend] Nombres en scripts, tests y ejemplos

- **Mecanismo:** `npm run lint` + `npm run typecheck` + `npm test` + `npm run build`.
- **Pasos:** carpeta y nombre de la base de datos en `scripts/deploy.ps1`, `ecosystem.config.js` y `.env.example`; host en `scripts/db-tunnel.ps1`; el origen de ejemplo de `scripts/ws-measure.ts` y de los dos tests de WebSocket pasa a `https://amfxtrading.com`.
- **Resultado:** ✅ lint limpio, typecheck limpio, 17 ficheros de test / 146 tests correctos, build correcto. Commit hecho, sin subir.
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Tarea 7 · [frontend] Nombre de la carpeta en el script de despliegue

- **Mecanismo:** `npm run build`.
- **Pasos:** `Set-Location C:\amfxtrading` en `frontend/scripts/deploy.ps1`.
- **Resultado:** ✅ build correcto, el script se interpreta sin errores. Commit hecho, sin subir.
- **Est vs Actual:** 0.25 SP · 0.1 SP.

## Tarea 8 · [ea] Nombres en los scripts del EA y en el documento de despliegue

- **Mecanismo:** manual.
- **Pasos:** carpeta en `ea/scripts/compile-ea.ps1` y `ea/scripts/distribute-ea.ps1`; carpeta y host en `ea/docs/deploy.md`, donde el túnel se nombra ahora por su ID (su nombre en el panel de Cloudflare puede cambiar en la tarea 11).
- **Resultado:** ✅ no queda ningún nombre antiguo; los dos scripts se interpretan sin errores. Commit hecho, sin subir.
- **Est vs Actual:** 0.5 SP · 0.1 SP.

## Tarea 9 · [docs] Directrices del proyecto

- **Mecanismo:** manual.
- **Pasos:** título "AMFX Trading" y árbol de carpetas `amfxtrading/` en `.claude/CLAUDE.md`.
- **Resultado:** ✅ `git grep` de `amfxtradingv2`, `amfxtrading-v2`, `api-v2`, `ssh-v2`, `v2.amfxtrading`, `app-v2` y "Trading v2" no encuentra nada fuera de `archive/` y `specs/` (AC 7). Commit hecho, sin subir.
- **Est vs Actual:** 0.25 SP · 0.05 SP.

## Tarea 10 · [infra] Carpeta del servidor y base de datos

- **Mecanismo:** manual.
- **Cuándo:** 2026-11-17 desde las 20:55 UTC, **con el mercado abierto, por decisión del operador** (el diseño pedía el mercado cerrado). Brokers y terminales siguieron en marcha todo el tiempo.
- **Pasos:** un script en el servidor (`C:\backup\spec048\switch.log`), preparado para deshacer todo lo hecho si fallaba un paso: número de filas anotado (exacto en todas las tablas, estimación y tamaño en `candles`, cuya lectura completa ya tumbó PostgreSQL una vez); copia sin las filas de velas (`C:\backup\spec048\amfxtradingv2.dump`, 1,6 MB); `.env`, `brokers.json`, `ecosystem.config.js` y `nginx.conf` copiados aparte; tareas de arranque paradas y desactivadas; backend y nginx parados; `ALTER DATABASE amfxtradingv2 RENAME TO amfxtrading`; carpeta renombrada a `C:\amfxtrading`; `.env`, `ecosystem.config.js`, `nginx.conf`, exclusión del antivirus y rutas de las dos tareas de arranque actualizados; nginx y backend arrancados desde la carpeta nueva; pm2 guardado. Después, los commits de las tareas 5 a 9 subidos de uno en uno: infra y specs (sin pipeline), backend (solo, en verde; primer pipeline por `ssh.amfxtrading.com`), tareas de arranque reactivadas, frontend (en verde), ea y docs (sin pipeline).
- **Resultado:** ✅ backend y web parados unos 8 segundos (20:55:55 → 20:56:03). Número de filas idéntico antes y después (por ejemplo `trades` 50765, `balances` 872; `candles` ≈ 8,07 M filas, 2,1 GB). La carpeta antigua ya no existe y nada se ejecuta desde ella. 12/13 brokers conectados tras cada paso (el 13.º, `solidary isa`, no tiene EA, como antes). Pipelines de backend y frontend en verde.
- **Pipeline del EA:** compilación y distribución en verde; el paso de recarga paró y volvió a arrancar los 13 terminales de uno en uno, pero la sesión SSH del pipeline se cortó mientras esperaba al último (`SADA XII`), así que el paso termina con código 255. El vigilante volvió a arrancar ese terminal; su registro muestra 13/13 en marcha en cada pasada desde entonces. No tiene que ver con el renombrado (una conexión cortada); el código del EA no cambió.
- **Est vs Actual:** 2.5 SP · 1.5 SP.

## Tarea 11 · [infra] Pasos del operador (en curso)

- **Cloudflare (operador, 2026-11-18):** borrado el túnel muerto del servidor cancelado (`420ad992…`); el túnel en uso (`fb1c65c3…`) renombrado de `amfxtrading-v2` a `amfxtrading`. `cloudflared tunnel list` en el servidor muestra solo `amfxtrading` y `rubenlucas`; `amfxtrading.com` y `api.` 200, `v2.` 301, `api-v2.` 200. ✅
- **Hecho por el asistente:** quitado del PC el acceso SSH `amfx-vps-old` (copia guardada como `~/.ssh/config.bak-048`; `ssh amfx-vps` llega a `WIN-16ESVKMCVCR`); notas del asistente actualizadas a los nombres nuevos y copiadas a la carpeta de la ruta nueva (`~/.claude/projects/c--Work-Odeslad-amfxtrading`); las notas del MVP movidas a `…-amfxtrading-v1`. ✅
- **Pendiente (operador, con el editor cerrado):** renombrar `C:\Work\Odeslad\amfxtrading` → `amfxtrading-v1` y `C:\Work\Odeslad\amfxtradingv2` → `amfxtrading`, y abrir el proyecto desde la carpeta nueva. 🕐
- Nota: el servidor tiene cloudflared 2026.6.0 y avisa de que la actual es la 2026.11.1; actualizarlo queda fuera de esta spec.
