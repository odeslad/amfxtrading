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
