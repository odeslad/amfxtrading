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
