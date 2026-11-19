# Infra — arranque automático del VPS

Scripts de operación del servidor que no pertenecen a ninguna capa (EA, backend, frontend).

## Qué hace

Tras un reinicio del VPS, Windows entra solo con `Administrator` y dos tareas programadas
levantan el backend (pm2) y los 13 terminales MT4 de `backend/brokers.json`, sin intervención manual.

```
reinicio → autologon Administrator
              │
              ├── AMFX-Startup   (al iniciar sesión, +1 min)  → startup.ps1
              └── AMFX-Watchdog  (cada 5 min)                 → startup.ps1
```

## `scripts/startup.ps1`

Idempotente. En cada ejecución:

1. Espera a que `postgresql-x64-17` esté en marcha (máx. 120 s).
2. Backend: si `http://localhost:3000/health` no responde, `pm2 resurrect`; si sigue caído,
   `pm2 start backend/ecosystem.config.js` (la misma definición que usa `backend/scripts/deploy.ps1`) y `pm2 save`.
3. Terminales: por cada broker de `brokers.json` resuelve `bridgePath → data dir → origin.txt → terminal.exe`
   y lo lanza si no hay ya un proceso con ese ejecutable. 20 s entre lanzamientos para no saturar el VPS.
4. Escribe el resultado en `C:\monitoring\startup.log` (`OK` o `DEGRADED (backend=… terminals=…)`).

Un terminal que se cierre a mitad del día lo relanza el watchdog en menos de 5 minutos.

## `scripts/register-startup-tasks.ps1`

Registra (o reemplaza) las dos tareas. Ejecutar una vez en el VPS:

```powershell
powershell -ExecutionPolicy Bypass -File C:\amfxtrading\infra\scripts\register-startup-tasks.ps1
```

Las tareas corren como `Administrator` en modo **interactivo** (no en sesión 0), para que las
ventanas de MT4 sean visibles por RDP. Por eso solo se ejecutan con la sesión abierta, y por eso
hace falta el autologon.

## Autologon (paso manual, una sola vez)

Requiere la contraseña de `Administrator`; hacerlo por RDP en el VPS con
[Autologon de Sysinternals](https://learn.microsoft.com/sysinternals/downloads/autologon),
que guarda la contraseña cifrada como secreto LSA (no en texto plano en el registro):

```powershell
Invoke-WebRequest https://live.sysinternals.com/Autologon64.exe -OutFile C:\deploy\Autologon64.exe
C:\deploy\Autologon64.exe /accepteula Administrator $env:COMPUTERNAME <contraseña>
```

Si se cambia la contraseña de `Administrator`, hay que volver a ejecutarlo.

## Registro de memoria

Dos tareas como `SYSTEM`, al arrancar, que no dependen de la sesión (spec 050):

| Tarea | Script | Escribe |
|---|---|---|
| `RAM-Log` | `C:\monitoring\ram-log.ps1`, cada minuto | `C:\monitoring\ram-YYYYMM.csv`: hora, RAM usada y libre, memoria comprometida y su límite, uso del fichero de paginación, terminales abiertos |
| `PoolWatch` | `C:\pool-watch.ps1`, bucle cada 30 s | `C:\pool-monitor.log`: pools paginado y no paginado del núcleo, RAM libre |

Sirven de evidencia si el servidor vuelve a colgarse: la memoria de los minutos anteriores queda en disco.

## Comprobar

```powershell
Get-Content C:\monitoring\startup.log -Tail 20
Get-ScheduledTask -TaskName 'AMFX-*' | Format-Table TaskName, State
Get-ScheduledTaskInfo -TaskName AMFX-Watchdog | Select-Object LastRunTime, LastTaskResult
Get-Content "C:\monitoring\ram-$(Get-Date -Format yyyyMM).csv" -Tail 5
```

## Lo que no cubre

- Cuenta de broker con contraseña caducada o no guardada en el terminal: MT4 arranca pero no conecta.
- Pantallas que Windows muestre al arrancar (raro en Server) y que bloqueen el autologon.
