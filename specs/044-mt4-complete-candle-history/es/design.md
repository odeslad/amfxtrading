# 044 — MT4 como fuente completa y única de velas · Diseño

## Enfoque

Tres correcciones independientes, una por causa, para que la base de datos converja a lo que tiene MT4 sin ningún paso manual:

| Causa | Capa | Corrección |
|---|---|---|
| Una vela atrasada se guarda como vela cerrada con el precio de hoy | backend | La vela de cambio de barra solo se genera cuando la barra anterior era de verdad la barra en curso |
| Una vela guardada mal nunca se corrige | backend | Cada vela cerrada de un fichero del EA sobrescribe la fila guardada cuando sus valores difieren |
| El histórico descargado después de arrancar el EA no se exporta; MT4 no lo descarga por sí solo | ea | El EA hace que MT4 cargue el histórico y lo vuelve a exportar completo cada vez que crece |

El contrato EA ↔ backend existente no cambia (mismos ficheros de velas, mismo JSON, mismos mensajes del pipe); se **añade** un fichero, `history_status.json`. Un EA antiguo sigue funcionando con el backend nuevo y al revés.

## Backend

### 1. Vela de cambio de barra solo desde una barra en curso — `services/candle-close.ts`

Hoy `trackCandleCloses` emite el snapshot anterior como vela cerrada siempre que cambia `<tf>_time`. El snapshot pasa a guardar la hora de servidor de su último tick, `serverNow = tick.time + tick.broker_offset * 1000` (que equivale al `TimeCurrent` de MT4, en la misma base de hora de broker que la hora de la barra), y solo se emite una vela cuando se cumplen las dos condiciones:

- `prev.time <= prev.serverNow < prev.time + 2 × periodo` — la barra era la que estaba en curso en su último tick. El segundo periodo es el margen para un símbolo que no cotiza en los primeros segundos (o minutos) de la barra siguiente: su hora de barra aún no se ha movido aunque el reloj del servidor sí;
- `prev.low <= prev.bid <= prev.high` — el precio de cierre pertenece a la barra.

Un terminal que arranca con el histórico atrasado no cumple la primera (barra del 20 de octubre, hora de servidor de hoy), así que no se guarda nada ni se emite el mensaje `candle`. La vela real llega con el fichero del EA. En fin de semana `TimeCurrent` se queda en la última cotización del viernes, así que la última barra del viernes sigue cumpliendo y se emite en la apertura del lunes, como hoy.

Efectos secundarios aceptados: un símbolo sin cotización durante más de una barra entera deja de recibir su vela de cambio de barra por ticks, le llega con el siguiente fichero del EA (≤ 60 s después); un terminal que estuvo desconectado menos de dos periodos todavía puede producir una vela cerrada con un bid tardío, que el fichero del EA corrige después (punto 2). La vela activa del frontend no se ve afectada.

### 2. El fichero del EA tiene autoridad sobre todas las velas cerradas — `services/candles.ts`

Hoy: `createMany … skipDuplicates` más un upsert de las dos últimas velas cerradas. Se sustituye por una sola sentencia por bloque:

```sql
INSERT INTO candles (broker, symbol, timeframe, time, open, high, low, close)
SELECT … FROM unnest(…)
ON CONFLICT (broker, symbol, timeframe, time) DO UPDATE
  SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close
  WHERE (candles.open, candles.high, candles.low, candles.close)
        IS DISTINCT FROM (EXCLUDED.open, EXCLUDED.high, EXCLUDED.low, EXCLUDED.close);
```

- Las filas que ya coinciden no se reescriben (el `WHERE` deja el update sin efecto), así que el ciclo normal de 60 s cuesta lo mismo que hoy: una sentencia indexada por fichero (AC 6).
- Una exportación completa corrige toda fila guardada que difiera — esto es lo que elimina las 216 velas falsas (AC 5, AC 7).
- Desaparecen `AUTHORITATIVE_TAIL` y los upserts fila a fila; la regla "el fichero del EA conserva la autoridad" (spec 025) pasa a cubrir todas las velas en lugar de dos.
- Se ejecuta con `db.$executeRaw` y arrays tipados; sin cambio de esquema ni migración.

### Alternativas consideradas para el punto 2

| | Elegida: autoridad sobre todas las velas | Marca `"full": true` en el fichero | Fichero aparte para la exportación completa |
|---|---|---|---|
| Cambio de contrato | ninguno | campo opcional nuevo | nombre de fichero nuevo |
| Corrige una vela errónea dentro de las últimas 100 | sí | no | no |
| Caminos de código | uno | dos | dos |

## EA — `ea/HttpBridgeState.mq4`

### 3. Volver a exportar completo cuando el histórico crece

Por símbolo y temporalidad el EA recuerda el número de barras de su última exportación. En cada ciclo de estado (60 s): si `iBars` ha crecido más que la única barra que puede añadir un ciclo, ese par se encola para una exportación **completa**; si no, las `RECENT_BARS` de siempre. La cola se vacía a un fichero por segundo desde `OnTimer`, de modo que una ráfaga de 75 exportaciones completas nunca bloquea los lotes de ticks de 100 ms (hoy `OnInit` escribe las 75 de golpe antes del primer tick).

### 4. Hacer que MT4 cargue el histórico

MT4 solo conserva en disco el histórico que algo le ha pedido, y una petición de serie temporal desde un EA devuelve lo guardado mientras la descarga ocurre en segundo plano (error `4066`, el histórico se actualizará). Qué descarga MT4 realmente para un símbolo sin gráfico abierto, y hasta dónde, **no está establecido**: en el VPS nuevo FTMO pasó de 201 a 2.093 velas M15 de octubre entre dos arranques del EA, mientras que las cuentas Solidary se quedaron entre 1.088 y 1.720 de 2.112. Por eso la primera tarea del EA es una medición en el terminal `Demo`, y el mecanismo se elige según su resultado:

| | E1. Peticiones de serie temporal | E2. Gráficos temporales |
|---|---|---|
| Cómo | Pedir cada símbolo y temporalidad (`iBars` / `CopyRates`) y reintentar mientras MT4 responda `4066`, hasta que el número de barras sea estable | `ChartOpen` de cada símbolo y temporalidad, `ChartNavigate` al principio para traer bloques más antiguos, `ChartClose` cuando el número sea estable |
| Pros | Sin efecto visible, sencillo | Es lo que hace aparecer los datos cuando el usuario abre un gráfico a mano |
| Contras | Puede no rellenar un hueco en mitad del histórico guardado | 75 gráficos abiertos y cerrados al arrancar, pico de memoria, más código |

Evidencia obtenida con el usuario el 2026-11-16: en `Demo` la app tenía unas 2.090 velas M5 por símbolo, todas desde el 5 de noviembre. El usuario desplazó el gráfico EURUSD M5 hasta enero en MT4 y recargó el EA: EURUSD M5 pasó a 65.000 velas desde el 2 de enero de 2026, mientras que los otros 14 símbolos y las demás temporalidades de EURUSD no cambiaron. Así que el camino de exportación entrega lo que tenga MT4, y lo que carga el histórico es desplazar el gráfico — lo que hace de E2 el mecanismo probable. La cifra redonda de 65.000 sugiere un límite del terminal ("Max bars in chart"); no verificado.

Se elija el que se elija, se ejecuta escalonado (un símbolo y temporalidad cada vez) y su único resultado es un `iBars` mayor, que el punto 3 exporta después.

## Cómo se sabe que está completo (AC 9, AC 10)

MQL4 no tiene ninguna llamada que pregunte al broker "cuánto histórico existe". Lo que sí se puede establecer, y basta para detectar todos los problemas vistos hasta ahora, son tres hechos por símbolo y temporalidad:

| Hecho | Quién lo mide | Cómo |
|---|---|---|
| MT4 ha terminado de descargar | EA | Ningún `4066` pendiente y número de velas estable durante ciclos consecutivos |
| El histórico no tiene huecos | EA | **Cruce con D1**: todo día que tiene vela D1 dentro del rango de esa temporalidad debe tener al menos una vela en ella. D1 es la referencia porque es pequeño y MT4 lo conserva completo (desde 2018–2020 en estas cuentas). Un día presente en D1 y ausente en M15 es un hueco, nunca un fin de semana ni un festivo |
| La base de datos es igual a MT4 | backend | Velas cerradas guardadas entre la primera y la última hora que da el EA = velas que da el EA menos la que está en curso |

- El EA escribe un fichero más, `bridge/history_status.json`: por símbolo y temporalidad `bars`, `first`, `last`, `downloading` (bool) y `missingDays` (número, más las primeras fechas). Fichero nuevo, aditivo: un backend que no lo conozca lo ignora.
- El backend lo lee con el mismo watcher, lo compara con `candles` y guarda el resultado en memoria por broker: `complete`, `downloading` o `incomplete` con la lista de pares símbolo y temporalidad y el motivo (hueco en MT4 / base de datos por detrás). `GET /health` gana un campo `history` por broker; no se persiste nada y el `status` de `/health` no depende de él.
- El propio EA usa `missingDays`: mientras sea mayor que cero, ese par sigue en la cola de descarga del punto 4.

Lo que esto no puede decir: si el broker tiene histórico más antiguo que la primera vela que conserva MT4. Queda fuera de la spec.

## Flujo de datos

Sin cambios: EA → `candles_<SYM>_<TF>.json` → file watcher → `candles`; ticks → vela de cambio de barra → `candles` + mensaje `candle` por WS. Solo cambia lo que se permite escribir.

## Convergencia del sistema nuevo (AC 7)

Tras el deploy, las siguientes exportaciones completas de cada terminal sobrescriben las velas falsas y rellenan los huecos. La comprobación son dos consultas sobre la base nueva, que deben llegar a su objetivo sin tocar filas a mano: velas con apertura o cierre fuera del máximo–mínimo = 0; velas M15 de EURUSD de octubre iguales para todas las cuentas del mismo feed de broker.

## Ficheros a tocar

- `backend/src/services/candle-close.ts`, `candle-close.test.ts`
- `backend/src/services/candles.ts` (+ test)
- `backend/docs/architecture.md`, `.claude/CLAUDE.md` — "Velas activas y alertas" / autoridad de las velas
- `ea/HttpBridgeState.mq4` (subida de versión, `history_status.json`), `ea/docs/`
- `backend/src/bridge/file-watcher.ts`, un `services/history-status.ts` nuevo (+ test), `routes` de `/health`

## Dependencias

No se añade ninguna.

## Deploy

Backend primero, después EA, solo en el sistema **nuevo**: el push de esta spec lleva los cuatro commits pendientes de la spec 043 (tareas 9–12) que apuntan los pipelines al servidor nuevo. El VPS antiguo conserva su código actual.

## Riesgos

- **Puede que MT4 no descargue un hueco en mitad de su histórico por ningún medio programático.** Entonces el AC 3 no se puede cumplir del todo; la tarea de medición lo dice antes de escribir el EA y el usuario decide.
- **Las exportaciones completas son grandes** (hasta ~27.000 velas por fichero, 75 ficheros por terminal, 13 terminales). El escalonado en el EA y el `WHERE` sin efecto en el backend acotan la carga; memoria y CPU se leen en el VPS nuevo durante la validación.
- **Base de hora del servidor.** La regla del cambio de barra depende de que `time + broker_offset` sea igual al `TimeCurrent` de MT4; se cubre con tests sobre muestras reales de ticks, incluida una secuencia de fin de semana.
- **Una vela falsa cuya barra MT4 no llegue a obtener nunca** se quedaría guardada. La consulta de validación lo muestra; no se borra a mano sin la decisión del usuario.
