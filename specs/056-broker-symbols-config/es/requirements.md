# 056 — Símbolos de cada broker desde el frontend

> Estado: **aprobado**

## Contexto
Cada terminal MT4 lee `bridge/config.json` (`brokerName`, `symbols`) cuando arranca el EA; `symbols` decide qué pares envía el EA al backend (ticks, velas activas, ficheros de velas). Hoy el fichero se edita a mano en el servidor y un cambio obliga a reiniciar el EA. Aparte, Settings › Visibility oculta brokers y símbolos solo en el frontend (`settings_display.hiddenSymbols`): un símbolo oculto se sigue recibiendo. El backend ya conoce la carpeta bridge de cada broker (`brokers.json`).

## Capas afectadas
- ea · backend · db · frontend

## Historias de usuario
- Como operador, quiero elegir desde el frontend qué símbolos del broker envía cada EA, para no editar ficheros en el servidor.
- Como operador, quiero un solo sitio para decidir qué símbolos existen en la app, para que "oculto" y "no recibido" no sean dos ajustes distintos.

## Criterios de aceptación
- AC 1. El EA informa al backend de todos los símbolos que ofrece su broker (la lista completa de MT4, no solo la Observación del mercado), al arrancar y cuando esa lista cambia.
- AC 2. Settings › Visibility lista, por broker, solo los cruces de AUD, EUR, NZD, USD, CAD, GBP y JPY que ofrece el broker (21 pares como mucho; se conserva el sufijo del broker, p. ej. `EURUSD.r`), por orden alfabético en una rejilla de 3 columnas, cada uno **activo** o **apagado**: activo = el EA lo envía y se ve en la app; apagado = el EA no lo envía y no aparece en ningún sitio.
- AC 3. CUANDO guardo un cambio ENTONCES el backend escribe el `bridge/config.json` de ese broker con los símbolos activos (conservando `brokerName` y cualquier otro campo) y el EA lo recoge solo en pocos segundos, sin reiniciar MT4.
- AC 4. `brokerName` nunca se edita desde el frontend.
- AC 5. Un símbolo con posiciones u órdenes pendientes abiertas en ese broker no se puede apagar; la pantalla dice por qué.
- AC 6. Ocultar un broker entero (Settings › Visibility) sigue funcionando como hoy.
- AC 7. Desaparece el ajuste antiguo de "símbolo oculto": al desplegar, los símbolos ocultos hoy se apagan en el `config.json` de su broker y se vacía `hiddenSymbols`, para que no reaparezca nada que estaba oculto.
- AC 8. Un broker cuyo EA aún no ha informado de sus símbolos (EA antiguo, terminal cerrado) muestra como activos los símbolos de su `config.json` actual, y la lista del resto no está disponible hasta que el EA informe.
- AC 9. CUANDO no se puede escribir `config.json` (carpeta inexistente, fichero bloqueado) ENTONCES el guardado falla con un mensaje claro y no cambia nada.
- AC 10. CUANDO se activa un símbolo ENTONCES su histórico de velas se sincroniza solo en cuanto el EA lo envía, en todas las temporalidades de Settings › Data (M5, M15, H1, H4, D1) con el objetivo por defecto, y solo para ese símbolo (no se tocan los demás símbolos del broker); su progreso se ve en Settings › Data como una sincronización manual.
- AC 11. CUANDO se apaga un símbolo ENTONCES sus velas guardadas se conservan (al volver a activarlo se vuelve a sincronizar).

- AC 12. (añadido en la tarea 7) Activar un par muestra su avance: Settings › Data marca el broker "waiting for the EA to stream it", luego "history requested", la sincronización en marcha y done, o un error si el EA no envía ticks o está desconectado; Settings › Visibility muestra lo mismo bajo el broker, con enlace a Data. Las velas con hora 0 (MT4 antes de cargar el histórico de un par nuevo) no se guardan nunca.

## Fuera de alcance
- Editar `brokerName` o añadir/quitar brokers (`brokers.json`).
- Gestionar la Observación del mercado de MT4 más allá de lo que el EA necesite para enviar un símbolo.
