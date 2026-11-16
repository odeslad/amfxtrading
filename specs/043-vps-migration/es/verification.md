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
