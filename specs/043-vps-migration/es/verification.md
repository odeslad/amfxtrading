# 043 — Migración de VPS · Verificación

## Tarea 1 — Sistema base del VPS nuevo

- **Mecanismo:** manual — ajustes leídos por SSH en `WIN-E5FGF0D8OH7` (`<IP del VPS nuevo>`) después de aplicarlos, comparados con la misma lectura en el VPS antiguo.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**

| Ajuste | VPS antiguo | VPS nuevo tras la tarea |
|---|---|---|
| Zona horaria | UTC | UTC (ya lo estaba) |
| Plan de energía | Equilibrado, suspensión e hibernación "nunca" con corriente | igual (ya lo estaba) |
| Política de Windows Update | `NoAutoRebootWithLoggedOnUsers=1` | `NoAutoRebootWithLoggedOnUsers=1`, `AUOptions=3` (descarga y pregunta antes de instalar — valor por defecto del proveedor, conservado) |
| Horas activas | 0–23 | 0–23 |
| Exclusiones de ruta de Defender | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Work` | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Users\Administrator\AppData\Roaming\MetaQuotes` |
| Exclusiones de proceso de Defender | `cloudflared.exe`, `node.exe`, `postgres.exe`, `terminal.exe` | igual |
| Protección en tiempo real de Defender | **desactivada** | activada |
| `C:\monitoring`, `C:\deploy` | existen | creadas |
| Fichero de paginación | fijo de 8192 MB | gestionado por el sistema (1920 MB ahora) |

- **Desviaciones:**
  - La protección en tiempo real está desactivada en el VPS antiguo; en el nuevo se ha **dejado activada** (no está en el diseño y rebaja la protección de la máquina). Con las exclusiones de arriba no debería interferir; se revisa solo si la tarea 6 muestra un coste medible.
  - El fichero de paginación se ha dejado gestionado por el sistema en lugar de los 8 GB fijos del antiguo: la máquina nueva tiene el doble de RAM. Se revisa con la lectura de memoria de la tarea 6.
  - Incidencia al aplicar: el script recreó la clave de la política de Windows Update y perdió el `AUOptions=3` del proveedor; se restauró en la misma sesión y se volvió a leer.
- **Est vs Actual:** 1 SP vs 0,5 SP — la mayoría de los ajustes ya coincidían.

## Tarea 2 — Software en las versiones del inventario

- **Mecanismo:** manual — listado de versiones y estado de los servicios leídos por SSH en el VPS nuevo, comparados con el inventario del antiguo.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**

| Software | VPS antiguo | VPS nuevo |
|---|---|---|
| Node / npm | 24.16.0 / 11.13.0 | 24.16.0 / 11.13.0 |
| pm2 (global, `%APPDATA%\npm`) | 7.0.1 | 7.0.1 |
| git | 2.54.0.windows.1 | 2.54.0.windows.1 |
| PostgreSQL | 17.10 | 17.10 |
| nginx | 1.26.2 | 1.26.2 |
| nssm | 2.24-101-g897c7ad | 2.24-101-g897c7ad (`C:\nssm\nssm.exe`) |
| cloudflared | 2026.6.0 | 2026.6.0 |

  - Servicios en el VPS nuevo: `postgresql-x64-17` en marcha, automático, `NetworkService`; `nginx` en marcha, automático, `LocalSystem` (mismos ajustes de `nssm` que el antiguo); ningún servicio ni proceso de `cloudflared`.
  - PostgreSQL: superusuario `postgres` con la contraseña del `DATABASE_URL` antiguo, puerto 5432, datos en `C:\Program Files\PostgreSQL\17\data`; líneas activas de `postgresql.conf` y `pg_hba.conf` idénticas a las del VPS antiguo.
  - `C:\nginx\conf\nginx.conf` es el fichero del VPS antiguo, byte a byte (no nombra ningún host: `server_name localhost`). nginx responde `500` en `/` hasta que exista `frontend\dist` (tarea 4), como se esperaba.
- **Desviaciones:**
  - nginx es la descarga oficial 1.26.2 más el `nginx.conf` antiguo, no una copia de toda la carpeta `C:\nginx` (evita arrastrar logs y temporales).
  - `nssm` vive en `C:\nssm` en lugar de la carpeta de enlaces de winget.
  - El instalador de PostgreSQL falla lanzado desde una sesión SSH ("Error writing file … temp_check_comspec.bat"); se ejecutó con una tarea programada puntual como `SYSTEM`, eliminada después.
  - Limpieza pendiente: `C:\deploy\backend.env` (copia del `.env` antiguo, usada para leer la contraseña de la base) se mueve a `backend\.env` en la tarea 4; `C:\deploy\installers` se puede borrar al final.
- **Est vs Actual:** 2 SP vs 1,5 SP.

## Tarea 3 — Dominio raíz como origen permitido

- **Mecanismo:** vitest + `npm run build` (más `npm run lint`).
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `ALLOWED_ORIGINS` en `backend/src/ws/policy.ts`: `/\.amfxtrading\.com(:\d+)?$/` → `/(^https:\/\/|\.)amfxtrading\.com(:\d+)?$/`. La misma lista alimenta CORS (`app.ts`) y el upgrade del WebSocket.
  - `npx vitest run src/ws/policy.test.ts`: pasan 13 tests. Casos nuevos: `https://amfxtrading.com` y `https://api.amfxtrading.com` aceptados; `https://evilamfxtrading.com` y `http://amfxtrading.com` rechazados. Los casos existentes (subdominios aceptados, `amfxtrading.com.evil.com` rechazado) siguen pasando.
  - `npm run build` (tsc) y `npm run lint` limpios.
  - `backend/docs/architecture.md` actualizado en el mismo commit (orígenes permitidos).
- **Aún sin probar:** el navegador real en `https://amfxtrading.com` contra el backend desplegado — esa es la verificación de la tarea 8.
- **Est vs Actual:** 0,5 SP vs 0,25 SP.

## Tarea 4 — Proyecto en el VPS nuevo

- **Mecanismo:** los dos builds en el VPS nuevo + el frontend cargado desde el PC del desarrollador por `ssh -L 8080:127.0.0.1:80`.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `git clone https://github.com/odeslad/amfxtradingv2.git C:\amfxtradingv2` (anónimo: el repositorio es de lectura pública) → `ff3d307`, el mismo commit que tiene desplegado el VPS antiguo.
  - `backend\.env`: el fichero del VPS antiguo con `FEATURE_ALERTS=false` (flags: `PIPE=true`, `WATCHER=true`, `ENGINE=false`, `ALERTS=false`, `WS_BROADCAST=true`). `backend\brokers.json`: el fichero del VPS antiguo, 13 brokers. La copia temporal `C:\deploy\backend.env` ya no existe.
  - Backend: `npm install`, `npx prisma generate`, `npm run build` → existe `dist\index.js`.
  - Frontend: `.env.production` = `VITE_API_BASE=https://api.amfxtrading.com`, `npm ci`, `npm run build` → existe `dist\index.html`; el único host de API dentro del bundle es `api.amfxtrading.com`.
  - nginx responde `200` en `/` en local; por la redirección de puertos `http://127.0.0.1:8080/` devuelve `200` (título `AMFX`) y la ruta de la SPA `/settings` devuelve `200`.
  - `git status` en el VPS nuevo limpio (el cambio de `package-lock.json` que deja `npm install` se descartó, como hace `deploy.ps1` con `git reset --hard`).
- **Aún sin probar:** el backend no se ha arrancado (todavía no hay base de datos — tarea 5); el clon no incluye el commit de la tarea 3 hasta que se suba `master` y se haga pull.
- **Est vs Actual:** 1,5 SP vs 0,75 SP.
- **Añadido (mismo día) — se quita `v2` de los nombres del servidor**, a petición del usuario (ver "Quitar el nombre `v2`" en el diseño): `C:\amfxtradingv2` renombrada a `C:\amfxtrading` en el VPS nuevo; `backend\.env` tiene ahora `DATABASE_URL` → base `amfxtrading` y `BROKERS_FILE` → `C:\amfxtrading\backend\brokers.json`; `nginx.conf` con `root C:/amfxtrading/frontend/dist`, nginx reiniciado y respondiendo `200`; la exclusión de ruta de Defender pasa a `C:\amfxtrading`; `git status` limpio tras el renombrado. Los scripts del repo siguen diciendo `C:\amfxtradingv2` hasta las tareas 9–12.

## Push de las tareas 1–4 (2026-11-16)

- `master` subido en `4e8022c`. Antes del push se reescribieron los cinco commits locales para que la IP del VPS nuevo no aparezca en ninguno (el repositorio es de lectura pública); los documentos dicen ahora `<IP del VPS nuevo>`.
- El push disparó el pipeline del backend en el VPS **antiguo**: su cabeza de `git` pasó a `4e8022c` y `https://api-v2.amfxtrading.com/health` respondió `200` con 11 de 13 brokers conectados y recibiendo ticks. `solidary isa` y `demo` aparecen con `pipe: listening`; el usuario confirmó que los dos ya estaban desconectados antes del deploy.

## Tarea 8 — Túnel, DNS y Access

- **Mecanismo:** manual — comprobaciones desde el PC del desarrollador tras crear el túnel.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - El `cert.pem` copiado del VPS antiguo fue aceptado: `cloudflared tunnel list` mostró los túneles de la cuenta, y `cloudflared tunnel create amfxtrading` creó el túnel `420ad992-bc3a-4079-b5c0-8f1bcd6d4820`. No hizo falta el `cloudflared tunnel login` del usuario.
  - `C:\Users\Administrator\.cloudflared\config.yml`: ingress `ssh.amfxtrading.com` → `ssh://localhost:22`, `amfxtrading.com` → `http://localhost:80`, `api.amfxtrading.com` → `http://localhost:3000`, 404 para el resto; `ingress validate` OK.
  - DNS: `tunnel route dns --overwrite-dns` añadió el CNAME de los tres nombres (los registros anteriores de la raíz y de `api` quedaron sustituidos).
  - Servicio `Cloudflared`: en marcha, automático, `LocalSystem`, misma línea de comandos que en el VPS antiguo; `tunnel info` muestra un conector con cuatro conexiones al edge.
  - `https://amfxtrading.com/` → `200` (título `AMFX`), `/settings` → `200`. `https://api.amfxtrading.com/health` → `502`, esperado: el backend no se arranca hasta las tareas 5–6.
  - `ssh` a través de `ssh.amfxtrading.com` (`cloudflared access ssh`) devuelve `WIN-E5FGF0D8OH7`.
  - Sin cambios: `https://v2.amfxtrading.com/` → `200`, `https://api-v2.amfxtrading.com/health` → `200`, `https://www.amfxtrading.com/` → `200` (título "AMFX Trading Terminal v1.0").
- **Pendiente:**
  - Hecho por el usuario: `ssh.amfxtrading.com` añadido a la aplicación "VPS SSH" de Access junto a `ssh-v2`. Comprobado después: una petición sin autenticar a cualquiera de los dos hostnames se redirige (`302`) al login de Cloudflare Access, y `ssh` llega a `WIN-16ESVKMCVCR` por `ssh-v2` y a `WIN-E5FGF0D8OH7` por `ssh`. El service token `github-actions` en el hostname nuevo lo prueban los workflows tras el push conjunto.
  - El login público y los ticks en vivo en `https://amfxtrading.com` se verifican en la tarea 6, cuando corran el backend y los terminales.
- **Est vs Actual:** 2 SP vs 1 SP — el certificado antiguo sirvió, así que no hizo falta el paso de login.

## Tarea 5 — Ensayo del traslado de datos

- **Mecanismo:** recuento de filas en ambos lados + `prisma migrate status` en la base nueva, cronometrado.
- **Resultado:** ✅ pasa con una desviación acordada con el usuario (2026-11-16): todas las tablas salvo los datos de `candles`, que está dañada en el VPS antiguo (ver abajo y "Velas" en el diseño).
- **Qué pasó en el VPS antiguo:**
  - El `pg_dump -Fc` de la base completa falló tres veces seguidas en el mismo punto: `COPY public.candles … ERROR: invalid memory alloc request size 18446744073709551613`. No es el error transitorio "invalid page" que esperaba el diseño: la tabla tiene al menos una fila dañada de forma permanente.
  - `pg_dump --exclude-table-data=public.candles` funcionó: 2,0 MB, 1 segundo. Todas las demás tablas se pueden leer.
  - `select count(*) from candles` respondió (7.766.113 filas; 2004 MB con índices). La consulta siguiente, `select min(time), max(time) from candles`, **tumbó un proceso servidor de PostgreSQL a las 15:30:40 UTC**; PostgreSQL hizo la recuperación automática (redo en menos de un segundo) y volvió a aceptar conexiones enseguida. El proceso del backend no se reinició (`/health` después: los mismos 11 de 13 brokers conectados, uptime sin interrupción). Producción perdió el acceso a la base durante unos segundos, en horario de mercado, por esta consulta.
  - No se ha lanzado ninguna consulta más contra `candles` en el VPS antiguo.
- **Recuento de filas en el VPS antiguo (2026-11-16 15:31 UTC):** `_prisma_migrations` 39 · `balance_operations` 625 · `balances` 859 · `book_schemes` 459 · `book_trades` 888 · `candles` 7.766.113 · `chart_indicators` 1 · `drawings` 46 · `ema_cross_alerts` 0 · `ema_notification_events` 25 · `ema_notifications` 1 · `mirror_presets` 7 · `position_colors` 0 · `price_alerts` 7 · `push_subscriptions` 2 · `settings_display` 1 · `trades` 50.736 · `users` 1.
- **Restore en el VPS nuevo:** base `amfxtrading` creada (UTF8) y `pg_restore` del dump de 2,0 MB: salida 0, 3 segundos. Recuento de filas idéntico a la lista de arriba en todas las tablas; `candles` existe y está vacía. `npx prisma migrate status`: "38 migrations found … Database schema is up to date!" (usado en lugar de `prisma migrate diff`, que necesita una base sombra).
- **Tiempos para el cambio:** dump 1 s + transferencia + restore 3 s; la copia de la base es cuestión de segundos, no los 15–40 minutos estimados cuando incluía `candles`.
- **Decisión (usuario):** `candles` no se migra; el VPS nuevo la rellena desde sus propios terminales (histórico completo al arrancar el EA) y con eso basta. No hay rescate de la tabla antigua.
- **Est vs Actual:** 1,5 SP vs 1,25 SP.

## Tarea 6 — Terminales MT4 y backend en el VPS nuevo

- **Mecanismo:** comparación de carpetas, `/health` en los dos sistemas, lectura de memoria, prueba de CORS.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - Copia: las 13 carpetas de instalación (507 MB empaquetadas) y el árbol `MetaQuotes` (196 MB empaquetado) se archivaron en el VPS antiguo a baja prioridad (67 s, sin errores de lectura), se pasaron por el PC del desarrollador (42 s) y se desempaquetaron en las mismas rutas. Para cada uno de los 13 brokers de `brokers.json`: mismo hash de carpeta de datos, `origin.txt` apuntando a un `terminal.exe` existente, los dos `HttpBridge*.ex4` presentes, `config.json` del bridge presente.
  - Antes de arrancar nada se buscaron `command.json`, `pending.json` y `result.json` en todas las carpetas bridge copiadas, para que ninguna orden capturada en la copia pudiera ejecutarse otra vez: no había ninguno.
  - Arranque con `AMFX-Startup` en la sesión interactiva (los scripts con las rutas nuevas se copiaron a mano al árbol de trabajo; llegan a `master` con las tareas 9–12): `startup.log` — backend arriba tras `pm2 start`, 13 terminales arrancados con 20 s de separación, "13/13 running", "run end: OK". Los 13 `terminal.exe` corren en la sesión 2 (visibles por RDP).
  - `https://api.amfxtrading.com/health`: 11 de 13 brokers `connected` con `tickAgeS: 0`; `solidary isa` y `demo` en `listening` — **los mismos dos que están desconectados en el VPS antiguo**. Los logins guardados de las 11 cuentas conectadas sobrevivieron a la copia; nadie tuvo que iniciar sesión por RDP.
  - VPS antiguo durante y después: `https://api-v2.amfxtrading.com/health` mantiene sus 11 de 13 conectados, uptime del backend sin interrupción. Ningún broker expulsó la sesión antigua al entrar la nueva.
  - Log del backend: `[FEATURES] Disabled: alerts`; log de errores vacío.
  - Memoria con todo arrancado: 3,6 GB libres de 8,2 GB (terminales 0,54 GB, PostgreSQL 0,87 GB, node 0,19 GB), CPU en torno al 37 % mientras carga el histórico de velas. El VPS antiguo lleva la misma carga con 0,75 GB libres de 4 GB.
  - `candles` rellenándose desde los terminales: 2.257.096 filas a los pocos minutos del arranque (la tabla antigua tiene 7,77 millones; la cifra final se lee en la tarea 14).
  - Tras `git pull` a `4e8022c` (origen raíz), rebuild y `pm2 restart`: una petición a `https://api.amfxtrading.com/health` con `Origin: https://amfxtrading.com` responde `access-control-allow-origin: https://amfxtrading.com` y `access-control-allow-credentials: true`.
  - Comprobación del usuario en el navegador: `https://amfxtrading.com/journal` abre con la sesión existente (sin nuevo login) y la pestaña Accounts muestra balance, equity y P&L del día en vivo de 11 brokers; `demo` aparece atenuado y `solidary isa` no aparece, lo que coincide con las dos cuentas desconectadas. Esto prueba el origen raíz de extremo a extremo (CORS, cookie de sesión y WebSocket).
- **Est vs Actual:** 2 SP vs 1,5 SP.

## Tarea 7 — Tareas de arranque, Autologon y reinicio

- **Mecanismo:** reinicio del VPS nuevo sin que nadie inicie sesión; `startup.log`, `/health` y lista de procesos leídos después.
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `AMFX-Startup` y `AMFX-Watchdog` registradas con `register-startup-tasks.ps1` (rutas nuevas). `PoolWatch` replicada (registro de memoria cada 30 s, como `SYSTEM` al arrancar, escribiendo en `C:\monitoring\pool-monitor.log`). `RAM-Log` no existe en el VPS antiguo, así que no había nada que replicar.
  - Autologon activado por el usuario por RDP (Sysinternals): `AutoAdminLogon=1`, usuario `Administrator`, dominio `WIN-E5FGF0D8OH7`, sin contraseña en claro en el registro.
  - Reinicio pedido a las 16:01:16 UTC; hora de arranque 16:01:29 UTC. `query user` después: `administrator` en `console`, con sesión desde las 16:01 sin abrir ninguna sesión RDP.
  - `startup.log`: backend sano, terminales arrancados con 20 s de separación, "13/13 running", "run end: OK" a las 16:07. 13 `terminal.exe`, ningún ejecutable duplicado, todos en la sesión interactiva.
  - `https://api.amfxtrading.com/health` a los 242 s del arranque del backend: 11 brokers `connected` (los mismos 11 que antes del reinicio). Servicios `postgresql-x64-17`, `nginx`, `Cloudflared` y `sshd` en marcha; `PoolWatch` en ejecución y registrando; 3,5 GB de RAM libres.
- **Nota:** `AMFX-Startup` y `AMFX-Watchdog` se solaparon durante el arranque (una ejecución dice 6 terminales arrancados, la otra 13). No produjo terminales duplicados, y es como ya se comportan los scripts en el VPS antiguo.
- **Est vs Actual:** 1,5 SP vs 1 SP.

## Velas en el sistema nuevo — hallazgo fuera de esta spec (2026-11-16)

- El usuario avisó de huecos en octubre y de mechas largas falsas en `https://amfxtrading.com`. Medido en la base nueva: EURUSD M15 en octubre tiene entre 1.088 y 2.093 velas por broker cuando un mes completo son unas 2.112; 216 velas guardadas tienen el cierre fuera del rango máximo–mínimo.
- Causa, leída en el código: el EA exporta todo el histórico solo al arrancar y después solo las últimas 100 velas; `services/candle-close.ts` guarda una vela cerrada con el último bid cuando un terminal arranca con el histórico atrasado; `services/candles.ts` inserta las filas que faltan pero solo sobrescribe las dos últimas. Nada de esto lo causa la migración: el mismo código corre en el VPS antiguo, cuya tabla se fue llenando poco a poco durante meses.
- Se empezó un rescate desde la base antigua y **se abandonó a petición del usuario** ("las velas tienen que venir de MT4, no reponerse a mano"): se restauró una copia en bruto del clúster antiguo como instancia de pruebas en el VPS nuevo y sus velas se cargaron en una tabla aparte (se pudieron leer todas las páginas menos 2 de 173.715). No se mezcló nada en `candles`; la tabla aparte, la instancia de pruebas y el fichero de copia se borraron.
- Continuación: spec 044 (EA + backend) para que MT4 sea la fuente completa y única.

## Tareas 9, 10 y 12 — Repo apuntando al servidor nuevo (verificadas con el push del 2026-11-16)

- **Mecanismo:** los tres workflows ejecutándose contra el VPS nuevo tras el push conjunto (`a86b7fb`, junto con la spec 044).
- **Resultado:** ✅ pasa (2026-11-16) para las tareas 9, 10 y 12. La tarea 11 sigue abierta: `db-tunnel.ps1` está cambiado y subido, pero los alias locales de `~/.ssh/config` (`amfx-vps` → nuevo, `amfx-vps-old` → antiguo) aún no se han cambiado y `db-tunnel.ps1` no se ha ejecutado contra el host nuevo.
- **Evidencia:**
  - Workflow del EA: correcto — compiló en el VPS nuevo desde `C:\amfxtrading\ea`, repartió a los 13 terminales y los recargó con `AMFX-Watchdog` (tarea 12, y la compilación, reparto y recarga del AC 6).
  - Workflow del frontend: correcto — `deploy.ps1` corrió en `C:\amfxtrading`; el bundle de `https://amfxtrading.com` ya llamaba a `api.amfxtrading.com` (tarea 10).
  - Workflow del backend: `check` pasó; `deploy` falló en "Upload deploy script" por un corte de conexión a través del túnel, se ejecutó a mano por SSH, y pasó cuando el usuario lo relanzó (intento 2). Los dos pushes de backend posteriores (`fad0803`, `d3a6b0a`) desplegaron al primer intento. El service token `github-actions` funciona en `ssh.amfxtrading.com` (tarea 9).
  - Ninguno tocó el VPS antiguo: su backend siguió respondiendo en `api-v2.amfxtrading.com` con 11 de 13 brokers todo el tiempo.
- **Est vs Actual:** tareas 9, 10, 12: 2,5 SP vs alrededor de 1 SP.

## Tarea 11 — Acceso local apuntando al servidor nuevo (2026-11-17)

- **Resultado:** ✅ pasa para los alias y el script del túnel; el inicio de sesión de Cloudflare que usan los dos está fallando para toda la cuenta (ver abajo).
- **Evidencia:** `~/.ssh/config` en el PC del desarrollador: `amfx-vps` → `ssh.amfxtrading.com`, nuevo `amfx-vps-old` → `ssh-v2.amfxtrading.com`. `backend/scripts/db-tunnel.ps1` usa `ssh.amfxtrading.com` (subido con el commit de la tarea 11).
- **Sin verificar de extremo a extremo:** `ssh amfx-vps`, `ssh amfx-vps-old` y `db-tunnel.ps1` no se pudieron ejercitar el 2026-11-17 porque `cloudflared access login` falla en todos los hostnames del team de Cloudflare, incluido `ssh.rubenlucas.es` de otro proyecto: con cloudflared 2026.5.2 "Empty app domain"; tras actualizar el PC del desarrollador a 2026.11.0 "metadata JWT verification failed … JWK with matching kid not found in JWK Set". La redirección de login lleva un token de metadatos firmado con la clave `5a40ea5d…`, y el `/cdn-cgi/access/certs` del team solo publica `9081125…` y `db6d164…`. Los pipelines no están afectados (service token). Causa sin establecer; no viene de los cambios de esta spec.
- **Acceso usado mientras tanto:** SSH por IP con la clave de deploy. VPS nuevo: puerto 22 abierto desde el arranque inicial. VPS antiguo: el usuario añadió una regla en IONOS y otra en el firewall de Windows (`AMFX-SSH-Migration`) para el puerto 22, restringidas a la IP pública del desarrollador.

## Tarea 14 — Cambio (2026-11-17, hacia las 06:35–06:45 UTC)

- **Mecanismo:** recuento de filas en ambos lados, logs del backend, comprobaciones públicas.
- **Resultado:** ✅ pasa en los servidores; los pasos propios del usuario (usar `amfxtrading.com`, reinstalar la app en el móvil, reactivar las push) le corresponden a él.
- **Evidencia:**
  - Tablas creadas por el usuario volcadas en el VPS antiguo (`pg_dump -Fc -a`, 13 tablas, 69 KB), transferidas y restauradas en el nuevo tras una copia de seguridad de su propia versión (`C:\deploy\userdata-new-before-20261117-063710.dump`), un `TRUNCATE` de esas tablas y `pg_restore -a --single-transaction`: salida 0. Recuentos idénticos en ambos lados: users 1, settings_display 1, position_colors 0, price_alerts 7, ema_cross_alerts 0, ema_notifications 1, ema_notification_events 25, push_subscriptions 2, drawings 46, chart_indicators 1, mirror_presets 7, book_schemes 459, book_trades 888.
  - `trades`, `balances`, `balance_operations` y `candles` no se volvieron a copiar: vienen de los terminales (las tres primeras se copiaron el 2026-11-16).
  - Alertas: backend antiguo reiniciado con `FEATURE_ALERTS=false` — log "[FEATURES] Disabled: alerts", 11 de 13 brokers; backend nuevo arrancado con `FEATURE_ALERTS=true` — log "[FEATURES] Disabled: none", 12 de 13 brokers, ticks a 0 s. `pm2 save` en el VPS nuevo.
  - Comprobaciones públicas: `https://amfxtrading.com/` 200, `https://api.amfxtrading.com/health` 200 y responde `access-control-allow-origin: https://amfxtrading.com`; `v2` y `api-v2` siguen en 200.
- **Desviación:** el runbook de la tarea 13 no se escribió como documento aparte antes del cambio; el usuario pidió terminar el mismo día y aprobó los pasos listados en la conversación. La vuelta atrás es la del diseño: devolver `FEATURE_ALERTS` a su valor en los dos backends y volver a `v2.amfxtrading.com`; los datos creados en el sistema nuevo después de las 06:37 UTC habría que llevarlos de vuelta.
- **Est vs Actual:** 2 SP vs 1 SP — sin `candles` la copia tarda segundos.

## Tarea 15 — Documentación

- **Resultado:** ✅ pasa (2026-11-17). Actualizados `infra/README.md` (carpeta, número de terminales, comando de Autologon sin nombre de host fijo) y `ea/docs/deploy.md` (carpeta, hostname SSH); `backend/docs/architecture.md` y `.claude/CLAUDE.md` se actualizaron con las specs 043 y 044. Las cadenas `app-v2` que quedan son orígenes de test y el nombre del árbol del repo; se dejan como están.

## Sigue abierto

- Tarea 13: el puerto 22 sigue abierto en los dos servidores (hace falta hasta que el login de Cloudflare vuelva a funcionar o se configure un service token para el PC del desarrollador).
- Tarea 16: 14 días de observación; después el usuario da de baja el VPS antiguo y se eliminan los registros DNS del túnel antiguo.
