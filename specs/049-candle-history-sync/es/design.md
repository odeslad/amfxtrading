# 049 — Sincronización del histórico de velas desde Settings · Diseño

## Enfoque (opción A, elegida por el operador)
Las páginas dañadas están en el fichero de la tabla `candles` actual; borrar e insertar filas no las repara, y reconstruir la tabla exige leerla entera, que es justo lo que falla. Por eso la migración **aparta la tabla actual como `candles_legacy`** y crea una **`candles` nueva y vacía**. Cada sincronización manual llena un broker y temporalidad en la tabla nueva. Mientras una pareja no esté sincronizada sigue leyendo y escribiendo en la tabla antigua igual que hoy, así ningún gráfico se queda vacío. Cuando todas las parejas están sincronizadas se borra la tabla antigua y el daño desaparece (AC 11).

## Flujo de datos
```
Settings › Data ──POST /candle-sync──▶ backend ──bridge/sync-command.json──▶ EA (HttpBridgeCommands)
                                                                           │ por paso: un símbolo × temporalidad
                                                                           │ (gráfico temporal si falta histórico)
                                       backend ◀──bridge/sync-status.json──┤ progreso
                                       backend ◀──bridge/sync/<SYM>_<TF>.json (velas)
     WS candle_sync ◀── backend: al completar una temporalidad → una transacción: borrar la pareja en la tabla nueva + insertar los ficheros
```

## Base de datos (`[db]`)
- Migración: `ALTER TABLE candles RENAME TO candles_legacy` (y su clave primaria), y `CREATE TABLE candles` con las mismas columnas y clave. Prisma: `Candle` mantiene `@@map("candles")`; modelo nuevo `CandleLegacy` → `candles_legacy`.
- Tabla nueva `candle_syncs` (modelo `CandleSync`), clave `(broker, timeframe)`: `target Int` · `candleCount Int?` · `lastSyncAt DateTime?` · `state` (`idle` | `queued` | `running` | `done` | `error`) · `detail String?` (símbolo en curso o motivo del error) · `requestId String?` · `updatedAt`.
  Objetivos por defecto al crear una fila: 10 000 en todas las temporalidades, para que la primera sincronización sea rápida (se cambian en Settings entre 100 y 50 000).
- Una pareja está **migrada** cuando su `lastSyncAt` no es nulo.
- Última tarea: `DROP TABLE candles_legacy` cuando todas las parejas estén migradas; después un `pg_dump` completo debe funcionar.

## Backend (`[backend]`)
- `services/candle-store.ts`: `tableFor(broker, timeframe)` → nueva o antigua, desde una caché en memoria de parejas migradas (cargada al arrancar, actualizada al final de cada sincronización). `upsertCandles` (watcher), `persistClosedCandle` (cierre en el tick), `GET /candles`, los evaluadores de alertas y notificaciones de EMA y `GET /setup-levels` pasan por ella; `GET /symbols` lista los símbolos de las dos tablas. Las parejas no migradas se comportan exactamente como hoy.
- `routes/candle-sync.ts` (`requireAuth`):
  - `GET /candle-sync` → cada broker × M5/M15/H1/H4/D1 con `target`, `candleCount`, `lastSyncAt`, `state`, `detail`. Las filas que falten se crean con el objetivo por defecto. `candleCount` se guarda al final de una sincronización, nunca se cuenta en vivo (contar la tabla antigua es lo que tumbó PostgreSQL).
  - `PUT /candle-sync/targets` `{ broker, targets: { M5?: n, … } }` → 400 fuera de 100 … 50 000 (rango fijado por el operador).
  - `POST /candle-sync` `{ broker, timeframes[] }` → 409 si ese broker tiene una sincronización en cola o en curso (AC 9); 503 si su pipe no está conectado (AC 8); si no, filas → `queued`, escribe `bridge/sync-command.json` (temporal + rename) `{ id, timeframes: [{ tf, target }] }`, 202.
- `bridge/sync-watcher.ts` (uno por broker, cada 1 s): lee `sync-status.json` `{ id, state, timeframe, symbol, done, total, message }` → actualiza la fila y emite. Cuando el EA marca una temporalidad `complete`: lee los `sync/<SYM>_<TF>.json` de esa temporalidad y, **en una transacción**, borra la pareja de la tabla nueva e inserta todas las velas cerradas (por lotes); después fija `candleCount`, `lastSyncAt`, `state = done`, marca la pareja como migrada y borra los ficheros. Cualquier fallo → rollback, `state = error` con el motivo: no se borra nada (AC 8).
- Vigilancia de bloqueo: 5 min sin cambios de estado en `running` → `error` «el EA ha dejado de responder»; se retira `sync-command.json` si sigue ahí.
- WS: mensaje nuevo `candle_sync` `{ broker, timeframe, state, detail, candleCount, lastSyncAt, done, total }` a todos los clientes (AC 7).
- El guardado diario sigue durante una sincronización: las velas que insertan el watcher o el cierre en el tick mientras corre la transacción usan `skipDuplicates`, así no se pierde ni se duplica nada (AC 10).

## EA (`[ea]`, `HttpBridgeCommands` 2.23)
- Lee `symbols` de `config.json` como `HttpBridgeState` (la misma lista).
- Su temporizador de 1 s mira `sync-command.json` **después** de `command.json`, así una orden nunca espera a una sincronización. El trabajo se hace **un símbolo × temporalidad por vuelta del temporizador** (AC 10):
  1. Si `iBars(sym, tf) < target`: `ChartOpen(sym, tf)` y, un paso por vuelta del temporizador, `ChartNavigate(CHART_BEGIN)` más la tecla Inicio enviada con `PostMessageW` a la ventana del gráfico (el método de la spec 044, commit `a86b7fb`; `ChartNavigate` solo no descarga nada, tarea 1), hasta `iBars ≥ target`, o un rato sin barras nuevas ni `ERR_HISTORY_UPDATING`, o un tiempo máximo por gráfico; `ChartClose` (AC 4). Necesita `user32.dll`: *Allow DLL imports* activado en este EA.
  2. Escribe `sync/<SYM>_<TF>.json` con las `min(target, iBars)` barras **cerradas** más recientes (mismos campos y `brokerOffset` que los ficheros de velas).
  3. Escribe `sync-status.json` (`running`, símbolo, hechos/total). Tras el último símbolo de una temporalidad: `complete` de esa temporalidad; tras la última: `finished`.
- Errores (el gráfico no abre, el fichero no se escribe) → `sync-status.json` `error` con el mensaje.
- **Contrato:** solo añade — ficheros nuevos `sync-command.json`, `sync-status.json` y carpeta `sync/`; los ficheros existentes y el pipe no cambian. Un EA sin la 2.23 nunca responde: la vigilancia de bloqueo convierte la sincronización en error y no se borra nada.

## Frontend (`[frontend]`)
- Pestaña nueva de Settings **Data** (`DataSyncTab.tsx` + `.module.css`): un bloque por broker (también los ocultos), una fila por temporalidad: casilla · TF · velas en BD · objetivo (input numérico sin flechas) · última sincronización · estado. Por broker: botón **Sincronizar marcadas** (desactivado mientras ese broker sincroniza o si no hay nada marcado); los objetivos se guardan con el botón Guardar de la página.
- Estado en vivo con el mensaje WS `candle_sync`; al abrir, `GET /candle-sync` (AC 7, también en otro dispositivo).
- Tabla en desktop, cards en móvil (patrón del proyecto).

## Maqueta
Aprobada por el operador el 2026-11-18: https://claude.ai/artifact/8Fjvb5F4h8cHGvnkkkEKDt

- **Desktop · Settings › Data**: barra de pestañas con la pestaña nueva DATA y *Save targets*; un bloque por broker con todos los estados — DEMO en reposo con dos filas marcadas y resultados parciales («broker has 6 212 of 10 000»), FTMO sincronizando (hecha / en curso con símbolo y barra de progreso / en cola; controles bloqueados), DARWINEX con error («EA stopped answering», no se borró nada), SOLIDARY ISA con el EA sin conectar.
- **Mobile · Settings › Data**: los mismos estados en una tarjeta por broker, filas de 56 px y botones de 44 px (*Sync selected*, *Save targets*, *Retry*).

## Requisito previo del operador
MT4 limita las barras por gráfico en *Herramientas › Opciones › Gráficos › Máx. barras en el gráfico*. En cada terminal debe ser ≥ 50 000 (el objetivo máximo), o la sincronización se queda en ese tope (la fila muestra entonces el número real alcanzado, AC 6). Se ajusta una vez por RDP antes de la primera sincronización.

## Riesgos
- **Descarga de histórico con `ChartNavigate`**: no está probado que MT4 baje barras antiguas así → la primera tarea del EA es una prueba en el terminal Demo antes de escribir el resto.
- **Transacción larga** para M5 × 15 símbolos × 50 000 barras como máximo (~750 000 filas; ~150 000 con los 10 000 por defecto): lotes con el `chunks()` existente; se mide en la prueba; si es lenta, insertar por símbolo en una tabla intermedia y cambiar en una transacción corta al final (sigue sin borrar nada si falla).
- **Al arrancar, el EA escribe todas las barras** (`999999`) de cada temporalidad: tras un reinicio una pareja migrada puede tener más velas que su objetivo. Aceptado (el guardado diario está fuera de alcance); el número mostrado es el guardado al final de la sincronización.
- **Disco**: la tabla antigua se queda hasta el final (2,1 GB) junto a la nueva; ~70 GB libres en el servidor.

## Ficheros
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_candle_sync/migration.sql`
- `backend/src/services/candle-store.ts` (nuevo), `services/candles.ts`, `services/candle-close.ts`, `routes/candles.ts`, `routes/candle-sync.ts` (nuevo), `bridge/sync-watcher.ts` (nuevo), `ws/ws.ts`, `index.ts`, `app.ts`
- `frontend/src/features/settings/SettingsPage.tsx`, `DataSyncTab.tsx` + `.module.css` (nuevos), tipos del cliente WS
- `ea/HttpBridgeCommands.mq4`
- `.claude/CLAUDE.md` y `backend/docs/architecture.md` (router nuevo, mensaje WS, ficheros del bridge)
