# 045 — Indicador de estado del sistema · Diseño

## Enfoque

El backend ya sabe, por broker, si el EA tiene el pipe y qué antigüedad tiene su último tick. Aprende dos cosas más — la carga del servidor y si cada terminal está cargando histórico — lo reduce todo a un nivel (`ok` / `warn` / `bad`) con sus motivos, y envía ese pequeño resumen a todas las apps abiertas por el WebSocket cada 5 segundos. El frontend solo lo pinta: una luz en el footer y un tooltip. Lo único que el frontend decide por sí mismo es el caso que el backend no puede comunicar: que se ha perdido la conexión con el backend.

## Maqueta

Aprobada por el usuario el 2026-11-17: https://claude.ai/artifact/Jx9zzR2QdCdrS4WCwueqpQ

| Pantalla | Muestra |
|---|---|
| Desktop · orange | Luz del footer y tooltip mientras tres terminales cargan histórico, con progreso y retraso de ticks por broker |
| Desktop · green | Todo normal, tooltip corto |
| Desktop · red | Un broker desconectado 4 minutos y otro reiniciando |
| Mobile · orange, sheet open | La luz en la cabecera y el mismo contenido en un panel inferior |

Reglas de maquetación tomadas de ella: tooltip de 440 px de ancho con 24 px de margen y 20 px entre bloques; una frase de titular; cuatro cifras del servidor; solo se listan los brokers que requieren atención, el resto se resume en una línea; una frase final que dice si hay que hacer algo; las filas de broker siguen el patrón del panel Devices (dato en DM Mono 14 px, estado como etiqueta pequeña en mayúsculas); el rojo es un cuadrado, no un círculo, para distinguirse también por la forma. Textos en inglés, como el resto de la app.

## Flujo de datos

```
EA ──pipe──▶ backend ──WS 'system' cada 5 s──▶ luz + tooltip del frontend
 │ ticks (ya existe)       ├─ por broker: estado del pipe, retraso de ticks, progreso de la carga de histórico
 └ {"type":"status",…}     └─ servidor: % de CPU, memoria libre
```

## EA — `ea/HttpBridgeState.mq4`

Un mensaje nuevo por el pipe cada 5 segundos: `{"type":"status","version":"3.17","loading":true,"loadDone":12,"loadTotal":75}`. Es el EA quien sabe por dónde va su carga de histórico (`g_loadPair` / `g_pairCount`); `loading` vale true hasta que la carga termina y mientras haya exportaciones completas en cola.

Contrato: se añade un tipo de mensaje. Un backend que no lo conozca debe ignorarlo (se comprueba en la primera tarea de backend); un EA que no lo envíe se muestra sin progreso.

## Backend

### Entradas

- **Por broker** (`store/liveness.ts`, ampliado): estado del pipe y antigüedad del último tick, como hoy, más el tiempo desde que se perdió el pipe y el último mensaje `status` del EA.
- **Servidor** (`services/server-load.ts`, nuevo): CPU a partir de la diferencia entre dos lecturas de `os.cpus()` separadas 5 segundos, memoria libre y total con `os`. No se añade ninguna dependencia.
- **Brokers ocultos**: `hiddenBrokers` de los ajustes de display globales, leído al arrancar y refrescado al guardar Settings. Los brokers ocultos quedan fuera del nivel y de la lista.

### Reducción a un nivel — `services/system-status.ts` (puro, con tests)

Estado del broker:

| Estado | Cuándo |
|---|---|
| `connected` | Pipe conectado y el EA no está cargando |
| `loading` | Pipe conectado y el EA dice que está cargando histórico (con su progreso) |
| `restarting` | Pipe perdido desde hace menos que el periodo de gracia |
| `disconnected` | Pipe perdido desde hace más |

Nivel, el peor de todas las reglas:

| Regla | Naranja (`warn`) | Rojo (`bad`) |
|---|---|---|
| Estado del broker | alguno `loading` o `restarting` | alguno `disconnected` |
| Retraso de ticks de un broker conectado | ≥ 5 s | ≥ 60 s |
| CPU, promediada | ≥ 85 % durante 15 s | ≥ 95 % durante 60 s |
| Memoria libre | < 10 % | < 5 % |

Los umbrales y el periodo de gracia (120 s) viven en una única constante exportada de ese fichero. Un valor tiene que mantenerse dos muestras seguidas para cambiar el nivel, de modo que un pico no haga parpadear la luz. El retraso de ticks es el tiempo desde el último mensaje del terminal por el pipe, de cualquier tipo (`touchTick` en `pipe-reader.ts` ya funciona así): el EA corre en un solo hilo, de modo que cuando se atasca se para todo a la vez. Con el mercado cerrado el EA sigue enviando sus lotes, posiciones y cuenta con su temporizador, así que el retraso se queda en cero y no hace falta nada especial.

### Entrega

- Mensaje `system` por WebSocket a todos los clientes cada 5 segundos: `{ type: 'system', level, server: { cpuPct, freeMemMb, totalMemMb }, brokers: [{ name, state, tickDelayS, loadDone?, loadTotal?, disconnectedS? }], at }`. Alrededor de 1 KB.
- `GET /status` (autenticado) devuelve el mismo objeto, para el primer pintado antes del primer mensaje de WebSocket.
- `GET /health` no cambia: el script de deploy y el watchdog dependen de él.

## Frontend

- `lib/useSystemStatus.ts`: guarda el último mensaje `system`. Si el WebSocket está caído, o no llega ningún mensaje en 20 segundos, el nivel es `bad` con el motivo "connection to the server lost" — decidido en el navegador, porque el backend no puede decirlo.
- `app/layout/SystemStatus.tsx` + CSS module: la luz (un `<button>`), el tooltip al pasar el ratón y con el foco del teclado en escritorio, y un panel inferior al tocar en móvil, construidos según la maqueta con las variables del sistema de diseño. Se pinta en el footer de `AppLayout` en escritorio y en su cabecera en móvil, donde el footer está oculto.
- Las frases (titular, línea final, etiquetas de estado) se componen en el frontend a partir del nivel y de los estados de los brokers, en inglés.
- El gris secundario de la maqueta (`#9a9a9a`) es más claro que `--muted` (`#666`), que no llega a un contraste legible a 9–11 px. Se añade como variable del sistema de diseño (`--muted-strong`) y se documenta en `.claude/CLAUDE.md`; las pantallas existentes no se tocan.

## Ficheros a tocar

- `ea/HttpBridgeState.mq4`, `ea/docs/HttpBridgeState.md`
- `backend/src/bridge/pipe-reader.ts`, `backend/src/store/liveness.ts`, `backend/src/services/system-status.ts` (nuevo), `backend/src/services/server-load.ts` (nuevo), `backend/src/ws/ws.ts`, `backend/src/app.ts`, `backend/src/index.ts`, tests, `backend/docs/architecture.md`
- `frontend/src/lib/useSystemStatus.ts` (nuevo), `frontend/src/app/layout/SystemStatus.tsx` + `.module.css` (nuevos), `frontend/src/app/layout/AppLayout.tsx` + `.module.css`, el fichero de variables globales
- `.claude/CLAUDE.md` (mensajes del WebSocket, variable del sistema de diseño)

Sin cambios de base de datos. No se añade ninguna dependencia.

## Deploy

Backend → frontend → EA. **El EA va el último y con el mercado cerrado**: recargar los terminales dispara la carga de histórico, durante la cual los ticks llegan tarde (medido el 2026-11-17: picos de 83–107 s). Hasta que se despliegue el EA, la luz funciona sin el progreso de la carga de histórico: un terminal que está cargando se muestra como conectado, con el retraso de ticks que tenga.

## Riesgos

- **La propia luz no debe añadir carga.** Una lectura de `os.cpus()` y un envío de 1 KB cada 5 segundos; se mide en la validación.
- **Los umbrales son una primera estimación.** Están en una sola constante para poder ajustarlos tras observar la luz unos días.
- **Lectura de CPU en Windows.** Los tiempos de `os.cpus()` son acumulados por núcleo; el porcentaje se calcula con diferencias y se contrasta con el Administrador de tareas en la validación.
- **Un broker oculto que falle es invisible** para la luz, por diseño (AC 7).
