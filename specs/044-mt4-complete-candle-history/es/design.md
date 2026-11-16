# 044 — MT4 como fuente completa y única de velas · Diseño

## Enfoque

Tres correcciones independientes, una por causa, para que la base de datos converja a lo que tiene MT4 sin ningún paso manual:

| Causa | Capa | Corrección |
|---|---|---|
| Una vela atrasada se guarda como vela cerrada con el precio de hoy | backend | La vela de cambio de barra solo se genera cuando la barra anterior era de verdad la barra en curso |
| Una vela guardada mal nunca se corrige | backend | Cada vela cerrada de un fichero del EA sobrescribe la fila guardada cuando sus valores difieren |
| El histórico descargado después de arrancar el EA no se exporta; MT4 no lo descarga por sí solo | ea + backend | El EA hace que MT4 cargue el histórico con un gráfico temporal, exporta el tramo sin huecos en un fichero propio, y el backend lo guarda y borra lo que queda detrás de un hueco |

El contrato EA ↔ backend existente no cambia (mismos ficheros de velas, mismo JSON, mismos mensajes del pipe); se **añade** un fichero, `fullcandles_<SYM>_<TF>.json`. Un EA antiguo sigue funcionando con el backend nuevo y al revés.

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

## EA — `ea/HttpBridgeState.mq4` (tal como se construyó y midió en `Demo`)

### 3. Hacer que MT4 cargue el histórico: un gráfico temporal llevado a su principio

Medido en el terminal `Demo` el 2026-11-16, con el EA real:

| Mecanismo | Velas EURUSD M15 |
|---|---|
| Antes | 2.065 |
| Peticiones de serie temporal (`iBars` / `iTime`, esperando en el error 4066) | 2.065 — nada |
| `ChartOpen` + `ChartNavigate(CHART_BEGIN)` | 2.064 — nada |
| `ChartOpen` + la **tecla Inicio** enviada a la ventana del gráfico | 65.425, hasta abril de 2024 |

Así que el EA carga los 15 símbolos × 5 temporalidades de un par en un par: abre un gráfico temporal, quita el autoscroll y, una vez por segundo, navega al principio y envía `WM_KEYDOWN`/`WM_KEYUP` de `VK_HOME` a la ventana del gráfico (`user32.dll`, que se suma al import de `kernel32.dll` que el EA ya necesita). El gráfico se cierra cuando no llega ninguna vela durante `CANDLES_IDLE_S` (5 s), o, si ya habían empezado a llegar, durante `CANDLES_STABLE_S` (12 s), o pasados `CANDLES_CHART_MAX_S` (120 s). MT4 conserva unas 65.000 velas por gráfico.

Tiempos en `Demo`: primera carga, desde el broker, unos 75 minutos para los 75 pares; con el histórico ya en disco, unos 12 minutos. Los lotes de ticks de 100 ms no se interrumpieron nunca (0 timeouts del pipe en todas las pasadas).

### 4. Histórico completo en su propio fichero, exportado al cargarse y al crecer

- Las últimas `RECENT_BARS` siguen yendo a `candles_<SYM>_<TF>.json` cada 60 s, como antes.
- Un histórico **completo** va a `fullcandles_<SYM>_<TF>.json`, escrito con nombre `.tmp` y renombrado. Se encola cuando un par termina de cargar y siempre que su número de velas crezca más de lo que puede añadir un ciclo de estado; la cola se vacía a un fichero por segundo.
- Hizo falta un fichero aparte: en la primera versión el histórico completo se escribía en el fichero normal y el siguiente ciclo de 60 s lo pisaba antes de que un backend ocupado lo hubiera leído (CADJPY M15 llegó al log del EA con 65.430 velas y a la base de datos con 2.070).

### 5. Solo el tramo sin huecos

MT4 puede conservar una isla antigua de histórico a la que las velas recientes no se conectan (en `Demo`: H4 de EURUSD, GBPUSD y USDJPY desde 2009, y después nada hasta 2022 o 2025). La tecla Inicio salta a la primera vela de la isla y no trae nada de en medio.

Por eso la exportación completa contiene solo las velas, contadas desde la más reciente, que forman un histórico sin huecos: en D1, ningún salto de más de cinco días entre velas consecutivas; en las demás temporalidades, todo día que tenga vela D1 debe tener al menos una vela, comprobado desde hoy hacia atrás hasta el primer día que falla. Las velas más antiguas que el histórico D1 también se dejan fuera. Cuando se han dejado velas fuera, el fichero lleva `"cutAtHole": true`.

## Backend — el fichero de histórico completo

- `bridge/file-watcher.ts` reconoce `fullcandles_<SYM>_<TF>.json`, se lo pasa a `onFullCandles` y **borra el fichero** una vez guardado, de modo que no se vuelve a leer ni en la siguiente vuelta ni tras un reinicio. Un guardado fallido lo deja para la siguiente vuelta; el fichero `.tmp` se ignora.
- `services/candles.ts` `replaceCandleHistory`: guarda las velas con la sentencia del punto 2 y, solo cuando el fichero dice `cutAtHole` y trae al menos 500 velas cerradas, borra las velas guardadas de ese par anteriores a la primera vela del fichero. Sin `cutAtHole` no se borra nada, así que la tabla acumula más allá de la ventana de 65.000 velas del terminal. El suelo de 500 velas evita que un terminal que no ha cargado su histórico vacíe lo guardado.

Contrato: se añade un fichero (`fullcandles_*`); un backend antiguo lo ignora, un EA antiguo no lo escribe nunca.

## Flujo de datos

Sin cambios: EA → `candles_<SYM>_<TF>.json` → file watcher → `candles`; ticks → vela de cambio de barra → `candles` + mensaje `candle` por WS. Solo cambia lo que se permite escribir.

## Convergencia del sistema nuevo (AC 7)

Tras el deploy, las siguientes exportaciones completas de cada terminal sobrescriben las velas falsas y rellenan los huecos. La comprobación son dos consultas sobre la base nueva, que deben llegar a su objetivo sin tocar filas a mano: velas con apertura o cierre fuera del máximo–mínimo = 0; velas M15 de EURUSD de octubre iguales para todas las cuentas del mismo feed de broker.

## Ficheros a tocar

- `backend/src/services/candle-close.ts`, `candle-close.test.ts`
- `backend/src/services/candles.ts` (+ test)
- `backend/docs/architecture.md`, `.claude/CLAUDE.md` — "Velas activas y alertas" / autoridad de las velas
- `ea/HttpBridgeState.mq4` (versión 3.16), `ea/docs/`
- `backend/src/bridge/file-watcher.ts` (+ test), `backend/src/index.ts`

## Dependencias

No se añade ninguna.

## Deploy

Backend primero, después EA, solo en el sistema **nuevo**: el push de esta spec lleva los cuatro commits pendientes de la spec 043 (tareas 9–12) que apuntan los pipelines al servidor nuevo. El VPS antiguo conserva su código actual.

## Riesgos

- **Un hueco en mitad del histórico de MT4 no se descarga por ningún medio encontrado.** Resuelto exportando solo el tramo sin huecos y borrando lo que queda detrás (decisión del usuario); el coste es profundidad: el H4 de USDJPY en `Demo` empieza en julio de 2025.
- **Las exportaciones completas son grandes** (hasta ~27.000 velas por fichero, 75 ficheros por terminal, 13 terminales). El escalonado en el EA y el `WHERE` sin efecto en el backend acotan la carga; memoria y CPU se leen en el VPS nuevo durante la validación.
- **Base de hora del servidor.** La regla del cambio de barra depende de que `time + broker_offset` sea igual al `TimeCurrent` de MT4; se cubre con tests sobre muestras reales de ticks, incluida una secuencia de fin de semana.
- **Una vela falsa cuya barra MT4 no llegue a obtener nunca** se quedaría guardada. La consulta de validación lo muestra; no se borra a mano sin la decisión del usuario.
