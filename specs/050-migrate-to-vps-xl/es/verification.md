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
