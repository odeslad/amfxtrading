# 051 — Monitor del servidor en Settings · Diseño

## Enfoque

El backend corre en el servidor del que informa, así que recoge los datos él mismo: sin agente ni proceso nuevo. Dos recolectores con costes distintos:

| Recolector | Cada | Fuente | Datos |
|---|---|---|---|
| rápido | 15 s | `os` de Node (sin proceso hijo) | % de CPU (diferencia de los tiempos de `os.cpus()`), memoria usada / total, tiempo encendido |
| lento | 60 s | una ejecución de PowerShell de un script del repo (`backend/scripts/server-probe.ps1`), JSON por la salida | uso del fichero de paginación, disco libre en C:, servicios (`postgresql-x64-17`, `nginx`, `Cloudflared`, `sshd`), procesos de terminal (ruta del ejecutable, memoria), hora del último arranque, nombre del equipo, versión de Windows |
| eventos | 10 min | el mismo script con `-Events` | eventos 41, 1001 y 6008 del registro Sistema de los últimos 30 días (hora, tipo, código del bugcheck y primer parámetro) |

Arrancar PowerShell cuesta unos 0,3–0,5 s de un núcleo; una vez por minuto es menos del 0,1 % de los 8 núcleos (AC 9). Los datos solo de Windows vienen de PowerShell porque Node no tiene API para servicios, el registro de eventos ni el fichero de paginación; `os` cubre el resto sin proceso hijo.

Cada muestra rápida se guarda en memoria (la foto actual); una vez por minuto el backend escribe una fila en la tabla de historial con la CPU media de las cuatro últimas muestras rápidas, la memoria usada, el uso del fichero de paginación y el número de terminales en marcha. Una tarea diaria borra las filas de más de 7 días (AC 8): las gráficas llegan como mucho a 7 días; la lista de cuelgues mantiene 30 días porque sale del registro de eventos de Windows, no de estas filas.

Terminales por broker: la sonda lenta devuelve las rutas de los `terminal.exe` en marcha; el backend relaciona cada broker con su ejecutable igual que `infra/scripts/startup.ps1` (`bridgePath` → carpeta de datos → `origin.txt` → `terminal.exe`), resuelto una vez al arrancar. El estado del pipe y la antigüedad del tick salen de `store/liveness`, como `/health`. Los datos del proceso del backend salen de Node (`process.uptime()`, `process.memoryUsage().rss`) y el número de reinicios de `pm2 jlist` en la sonda lenta (una línea más del script).

### Alternativas consideradas

| | Elegida: recoge el backend | Recolector aparte (tarea programada que escribe en la BD) | Leer el CSV de `RAM-Log` |
|---|---|---|---|
| Piezas | ninguna nueva | otro script, tarea y acceso a la BD que mantener | depende de una tarea del servidor fuera del repo |
| Datos en vivo | sí (15 s) | solo tan frescos como su programación | 1 min |
| Sobrevive a una caída del backend | hueco en el historial mientras está caído | sigue registrando | sigue registrando |

El hueco mientras el backend está caído es aceptable: la lista de eventos (del registro de Windows, no de nuestras muestras) sigue mostrando los cuelgues, y `RAM-Log` mantiene su propio CSV en el servidor.

## Cambios por capa

### db

Tabla nueva `server_samples`: `time` (timestamptz, PK), `cpu` (real, %), `memUsedMb` (int), `memTotalMb` (int), `pageFileMb` (int), `terminals` (smallint). Migración escrita a mano; unas 10 000 filas (7 días).

### backend

- `backend/scripts/server-probe.ps1` — imprime un objeto JSON; `-Events` añade la lista de eventos. Solo consultas de lectura.
- `src/services/server-monitor.ts` — arranca los dos recolectores, guarda la foto actual, escribe la fila de cada minuto, hace la limpieza diaria y relaciona brokers con terminales. Se arranca en `index.ts` detrás de un flag nuevo `FEATURE_SERVER_MONITOR` (se apaga solo con el literal `false`, como los demás; apagado en un backend local para no informar del PC del desarrollador). Un error de una sonda se registra y deja los valores anteriores marcados como antiguos; nunca para el backend.
- `src/routes/server.ts` (detrás de `requireAuth`, AC 10):
  - `GET /server` → `{ host, os, cores, memTotalMb, bootAt, uptimeS, lastBootAfterCrash, cpu, memUsedMb, pageFileMb, diskFreeGb, diskTotalGb, services: [{ name, state }], backend: { uptimeS, rssMb, restarts }, terminals: [{ broker, running, memMb, pipe, tickAgeS }], events: [{ at, kind: 'bugcheck'|'unexpected', code?, param1? }], sampledAt, staleS }`.
  - `GET /server/history?range=24h|7d` → `[{ t, cpu, memUsedMb, pageFileMb }]`; 24h devuelve las filas por minuto (≤ 1 440), 7d las promedia en tramos de 10 minutos (≤ 1 008) en SQL.
- Sin WebSocket: la pestaña pide `GET /server` cada 15 s mientras está abierta (AC 2); no se envía nada a otros clientes.

### frontend

- `src/lib/useServerStatus.ts` — pide `/server` cada 15 s mientras la pestaña está activa; carga `/server/history` al abrir y al cambiar de rango, y añade un punto cada minuto.
- `src/features/settings/ServerTab.tsx` + `.module.css` — secciones como en la maqueta: cabecera de la máquina (equipo, sistema, núcleos, último arranque con marca de cuelgue), cuatro indicadores (CPU, memoria, fichero de paginación, disco), servicios y backend, terminales (tabla en escritorio, tarjetas en móvil), gráficas de CPU/memoria con selector 24h / 7d (`lightweight-charts`, ya es dependencia, una serie de línea por dato; huecos donde faltan muestras), lista de eventos.
- `SettingsPage.tsx` — pestaña nueva `server`.

## Flujo de datos

```
Node os (15 s) ─┐
server-probe.ps1 (60 s / 10 min) ─┼─▶ services/server-monitor.ts ──▶ foto (memoria) ──▶ GET /server ──▶ ServerTab (cada 15 s)
store/liveness (pipes, ticks) ────┘            └──▶ server_samples (1/min, 7 días) ──▶ GET /server/history ──▶ gráficas
```

## Maqueta

Aprobada por el operador el 19-nov-2026: https://claude.ai/artifact/UZjr1LBNPQeXd5JL6d7TzS — artboards: escritorio (un terminal caído, último arranque tras un cuelgue), móvil, cargando / datos antiguos. Decisiones tomadas en la maqueta:

- **Cuelgue en las gráficas**: una línea roja en la hora del cuelgue con una etiqueta (tipo, código, hora, minutos caído), el hueco rayado y una línea verde discontinua en el siguiente arranque; las series terminan con un punto antes del hueco y empiezan de nuevo después, sin unirse por encima. Un apagado inesperado sin código se dibuja igual en ámbar.
- **Terminales**: todos los brokers siempre a la vista (sin «… más»), los problemas primero — parados (rojo), después en marcha sin ticks recientes (ámbar), después los que van bien y al final los brokers sin EA (gris).
- **Secciones plegables**: gráficas, servicios y backend, terminales y cuelgues tienen un botón de plegar en su cabecera; plegada, la cabecera mantiene un resumen de una línea (`12 / 13 running`, `4 / 4 running`, `2 events`). El estado se recuerda por dispositivo (`localStorage`).
- **Gráfica redimensionable** (pedida por el operador durante la tarea 5, con la maqueta ya aprobada): un tirador bajo la gráfica cambia su altura entre 140 y 600 px (220 por defecto; las flechas la mueven 20 px), recordada por dispositivo.

## Ficheros a tocar

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_server_samples/migration.sql`
- `backend/scripts/server-probe.ps1`, `backend/src/services/server-monitor.ts` (+ test), `backend/src/routes/server.ts` (+ test), `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/config.ts`, `backend/.env.example`
- `frontend/src/lib/useServerStatus.ts`, `frontend/src/features/settings/ServerTab.tsx`, `ServerTab.module.css`, `SettingsPage.tsx`
- `backend/docs/architecture.md`, `.claude/CLAUDE.md`

## Dependencias

Ninguna nueva.

## Riesgos

- **Arranque de PowerShell en el servidor**: se mide al implementar; si una sonda tarda más de unos segundos se sube el intervalo lento, nunca el rápido.
- **Acceso al registro de eventos**: el backend corre como `Administrator` (pm2 en la sesión del autologon), que puede leer el registro Sistema; si no, la lista de eventos muestra «no disponible» y el resto funciona.
- **El % de CPU de `os.cpus()`** incluye todos los procesos (es la CPU de la máquina), que es lo que se busca.
- **Las caídas del propio backend** dejan huecos en el historial; se muestran como huecos, sin interpolar.
