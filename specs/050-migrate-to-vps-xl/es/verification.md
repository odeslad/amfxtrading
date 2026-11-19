# 050 — Migrar la plataforma al VPS XL+ · Verificación

## Tarea 1 · [infra] Inventario del M+ y sistema base del XL+

- **Mecanismo:** inventario leído por SSH en los dos servidores (19-nov-2026); ajustes del XL+ leídos de vuelta.
- **Inventario:**

| Elemento | M+ (`WIN-16ESVKMCVCR`) | XL+ (`WIN-5SSFL41HHDI`) antes |
|---|---|---|
| Node / npm / pm2 | 24.16.0 / 11.13.0 / 7.0.1 | sin instalar |
| git | 2.54.0.windows.1 | sin instalar |
| PostgreSQL | 17.10, servicio `postgresql-x64-17` (NetworkService, automático) | sin instalar |
| nginx | 1.26.2 en `C:\nginx`, servicio `nginx` con nssm (enlace de WinGet en el perfil de Administrator, no `C:\nssm`) | sin instalar |
| cloudflared | 2026.6.0, servicio `Cloudflared` (LocalSystem, automático, `--config C:\Users\Administrator\.cloudflared\config.yml`) | sin instalar |
| OpenSSH | 9.5p2, `sshd` automático | 9.5p2, `sshd` automático |
| Tareas programadas | `AMFX-Startup`, `AMFX-Watchdog`, `PoolWatch` (`C:\pool-watch.ps1`). **No existe ninguna tarea `RAM-Log`** | ninguna |
| Instalaciones de MT4 | 13 | 0 |
| Zona horaria / plan de energía | UTC / Equilibrado | UTC / Equilibrado |
| Windows Update | `NoAutoRebootWithLoggedOnUsers=1`, horas activas 0–23 | `AUOptions=3`, nada más |

- **Sistema base aplicado en el XL+:** suspensión, hibernación y apagado de pantalla a 0 con corriente; `NoAutoRebootWithLoggedOnUsers=1` y horas activas 0–23 como en el M+; creadas `C:\monitoring`, `C:\deploy` y `C:\backup`. Leído de vuelta: índice de suspensión 0, `NoAutoRebootWithLoggedOnUsers=1`, horas activas 0–23, UTC.
- **Hallazgo:** el registro de RAM en el que se apoya el diseño nunca existió en el M+ (solo `PoolWatch`); la tarea 6 lo crea en el XL+.
- **Resultado:** ✅
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 2 · [infra] Software en el XL+

- **Mecanismo:** instaladores oficiales descargados en el XL+ en `C:\deploy\installers` y ejecutados en silencio por SSH; versiones y servicios leídos de vuelta con el mismo script de inventario de la tarea 1.
- **Pasos:** Node 24.16.0 (MSI), Git 2.54.0 (instalación silenciosa), cloudflared 2026.6.0 (MSI, queda en `C:\Program Files (x86)\cloudflared` como en el M+; sin crear el servicio), nssm 2.24-101 en `C:\nssm`, `npm i -g pm2@7.0.1`, PostgreSQL 17.10 (instalador de EDB con una tarea programada puntual como `SYSTEM`, 180 s, contraseña de superusuario sacada del `DATABASE_URL` del M+, puerto 5432, tarea borrada después), `C:\nginx` copiado del M+ sin `logs` ni `temp` y registrado con nssm con los ajustes del M+ (`AppDirectory C:\nginx`, `AppExit Restart`, automático, LocalSystem).
- **Resultado:**

| Elemento | M+ | XL+ |
|---|---|---|
| Node / npm | 24.16.0 / 11.13.0 | 24.16.0 / 11.13.0 |
| pm2 | 7.0.1 | 7.0.1 |
| git | 2.54.0.windows.1 | 2.54.0.windows.1 |
| PostgreSQL | 17.10, `postgresql-x64-17` en marcha, automático, NetworkService | igual |
| nginx | 1.26.2, `nginx` en marcha, automático, LocalSystem | igual (nssm en `C:\nssm` en vez del enlace de WinGet) |
| nssm | 2.24-101-g897c7ad | 2.24-101-g897c7ad |
| cloudflared | 2026.6.0 | 2026.6.0 |

- **Nota:** npm escribe avisos por la salida de error, lo que paró el script con `ErrorActionPreference = Stop` después de instalar pm2; el resto se lanzó aparte.
- **Resultado:** ✅
- **Est vs Actual:** 1.5 SP · 0.5 SP.

## Tarea 3 · [infra] Proyecto en el XL+

- **Mecanismo:** los pasos de build de los scripts de deploy ejecutados a mano por SSH; `/health` y nginx comprobados en el XL+.
- **Pasos (19-nov-2026):** `git clone` del repositorio público en `C:\amfxtrading` (`c2c4730`, el `master` subido); `backend\.env` y `backend\brokers.json` copiados del M+, `FEATURE_ALERTS=false` puesto con node (sin BOM); backend `npm install`, `prisma generate`, `tsc --outDir dist`; frontend `.env.production` con `VITE_API_BASE=https://api.amfxtrading.com`, `npm ci`, `npm run build`; tras la base de datos de la tarea 4, `prisma migrate status` («Database schema is up to date!»), `pm2 start ecosystem.config.js`, `pm2 save`.
- **Resultado:** ✅ `http://localhost:3000/health` en el XL+ responde con los 13 brokers en `listening` (aún sin terminales); `http://localhost/` por nginx responde 200 con el frontend compilado. El frontend llama a `api.amfxtrading.com`, que es el M+ hasta el cambio, así que la app en el navegador se comprueba en la tarea 9.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Tarea 4 · [db] Ensayo de la copia de la base de datos

- **Mecanismo:** `pg_dump -Fc` en el M+, paso por el PC, `pg_restore --no-owner` en una base de datos `amfxtrading` nueva en el XL+; `count(*)` exacto de cada tabla pública en los dos lados con el mismo script.
- **Tiempos:** volcado 9,2 s (38,1 MB) · transferencia 6,7 s · restauración 21,2 s — unos 37 s en total.
- **Número de filas (igual en los dos servidores):**

| Tabla | Filas |
|---|---|
| `_prisma_migrations` | 41 |
| `balance_operations` | 626 |
| `balances` | 895 |
| `book_schemes` | 459 |
| `book_trades` | 888 |
| `candle_syncs` | 65 |
| `candles` | 3 125 066 |
| `chart_indicators` | 1 |
| `drawings` | 48 |
| `ema_cross_alerts` | 0 |
| `ema_notification_events` | 25 |
| `ema_notifications` | 1 |
| `mirror_presets` | 7 |
| `position_colors` | 0 |
| `price_alerts` | 1 |
| `push_subscriptions` | 2 |
| `settings_display` | 1 |
| `trades` | 50 783 |
| `users` | 1 |

- **Resultado:** ✅ 19 tablas, mismos números; `prisma migrate status` al día en el XL+.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 5 · [ea] Terminales MT4 en el XL+

- **Mecanismo:** `tar` (sin comprimir, a disco, poca memoria en el M+ de 4 GB) de las 13 carpetas de instalación (882 MB, 2 s) y de `AppData\Roaming\MetaQuotes` sin `logs` (631 MB, 4 s), los dos con salida 0 con los terminales del M+ en marcha; paso por el PC (42 s de bajada, 32 s de subida); extraídos en el XL+ en las mismas rutas. Terminales arrancados por `AMFX-Startup` / `AMFX-Watchdog` cuando el operador entró por RDP (tarea 6).
- **Comprobaciones:** 13 instalaciones; las 13 carpetas de datos tienen los mismos nombres hash y el mismo `origin.txt` que en el M+; existen los 13 `bridgePath` de `brokers.json`.
- **Brokers (19-nov-2026 10:31, los dos servidores a la vez, mismas cuentas):** XL+ 12 `connected` con `tickAge 0` y `solidary isa` en `listening` — lo mismo que el M+ en ese momento. Los logins guardados sobrevivieron a la copia; ningún broker cortó ninguno de los dos lados.
- **Memoria con 13 terminales:**

| | M+ | XL+ |
|---|---|---|
| RAM usada / total | 2,67 / 4 GB | 5,29 / 16 GB |
| Memoria en uso de los 13 terminales | 0,38 GB | 1,56 GB |

  En el M+ los terminales están casi enteros en el fichero de paginación (0,38 GB para 13), que es el tráfico de paginación donde salta su bugcheck.
- **Seguir o no:** seguir — mismos brokers y antigüedad de ticks 0 en los dos; el XL+ tiene más de 10 GB libres.
- **Resultado:** ✅
- **Est vs Actual:** 1.5 SP · 0.75 SP.

## Tarea 6 · [infra] Tareas de arranque, registro de RAM, Autologon y reinicio

- **Pasos:** `register-startup-tasks.ps1` registró `AMFX-Startup` (al iniciar sesión) y `AMFX-Watchdog` (cada 5 min), las dos interactivas. El operador activó el Autologon por RDP (Sysinternals). `PoolWatch` replicada con el `C:\pool-watch.ps1` del M+ (SYSTEM, al arrancar, `C:\pool-monitor.log` cada 30 s). `RAM-Log` nueva (SYSTEM, al arrancar y cada minuto) escribiendo `C:\monitoring\ram-YYYYMM.csv`: hora, usada, libre, comprometida, límite, uso del fichero de paginación, terminales.
- **Autologon leído de vuelta:** `AutoAdminLogon=1`, usuario `Administrator`, dominio `WIN-5SSFL41HHDI`, sin contraseña en texto plano en el registro.
- **Prueba de reinicio (19-nov-2026):** `shutdown /r` por SSH a las 10:31; arrancó a las 10:31:59; sin que nadie tocara nada, 13 terminales en marcha unos 5 minutos después, `startup.log` con `13/13 running (13 started now)` y `run end: OK`, servicios `postgresql-x64-17`, `nginx` y `sshd` en marcha, `/health` con los mismos 12 brokers `connected` (antigüedad 0) y `solidary isa` en `listening`, fichero de RAM creciendo cada minuto (5,2 GB usados, 13 terminales).
- **Resultado:** ✅
- **Est vs Actual:** 1 SP · 0.5 SP.
