# 056 — Símbolos de cada broker desde el frontend · Verificación

## Tarea 1 · [backend] Ficheros de símbolos del broker

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `services/broker-symbols.ts`: `isTrackedPair` (cruces de AUD, EUR, NZD, USD, CAD, GBP, JPY por las seis primeras letras, admite sufijo), `readAvailable` (`symbols-available.json`, tolera BOM, null hasta que el EA informa, únicos y ordenados), `readActive` (lista separada por comas de `config.json`), `writeActive` (conserva el resto de campos, `.tmp` + rename, `BrokerSymbolsError` si falta la carpeta o el fichero no se puede leer); tests sobre una carpeta temporal.
- **Resultado:** ✅ 4 tests en verde, typecheck, build y lint limpios.
- **Est vs Real:** 1.5 SP · 0.5 SP.

## Tarea 2 · [backend] Rutas `/broker-symbols`

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `routes/broker-symbols.ts` (bajo `requireAuth`): `GET` devuelve `{ broker, available, active }` de cada broker de `brokers.json`; `PUT /:broker { symbols }` valida la lista (400), rechaza símbolos que el broker no ofrece (400) y apagar símbolos con posiciones u órdenes abiertas (409, `openSymbols` del store de posiciones), escribe `config.json` (un fallo de escritura es un 409 claro), avisa por WS con `broker_symbols` y pasa los símbolos recién activados a un manejador (conectado en la tarea 3); `parseSymbols` y `planChange` con tests.
- **Resultado:** ✅ 223 tests en verde, typecheck, build y lint limpios.
- **Est vs Real:** 1.5 SP · 0.5 SP.

## Tarea 3 · [backend] Sincronización del histórico de los pares activados

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `SyncCommand.symbols` (opcional); `syncNewSymbols` en `routes/candle-sync.ts` espera al primer tick de cada par nuevo (2 min), a que acabe cualquier sincronización en curso (30 min) y al pipe, y entonces marca las filas del broker como en cola y escribe `sync-command.json` con cada temporalidad de Data a su objetivo y `symbols`; conectado desde `PUT /broker-symbols` en `index.ts` (el resultado queda en el log). `sync-watcher` ahora sustituye solo los símbolos entregados de una temporalidad, así una sincronización de un par no toca el resto y un par apagado conserva sus velas (AC 11). Tests del encargo, los tres casos en que se abandona y el borrado acotado.
- **Resultado:** ✅ suite completa en verde, typecheck, build y lint limpios.
- **Est vs Real:** 2 SP · 0.75 SP.

## Tarea 4 · [backend] Paso de los símbolos ocultos

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `services/hidden-symbols-rollout.ts`: `planRollout` (pura: por broker, los pares ocultos que se quitan de la lista activa, reconociendo el sufijo del broker; los pares con posiciones abiertas siguen activos; los brokers cuyas posiciones aún no se conocen quedan para después) y `rollOutHiddenSymbols` (escribe cada `config.json`, deja cada cambio en el log, conserva en `hiddenSymbols` solo los brokers pendientes); arrancado desde `index.ts` con el watcher activo, primera vez 1 min tras arrancar y se repite cada 10 min mientras quede algo. `/settings` ya no guarda el `hiddenSymbols` que reciba (clientes antiguos). Desviación del diseño: el paso espera a las posiciones de cada broker en vez de correr nada más arrancar, porque el store de posiciones está vacío hasta que el EA envía.
- **Resultado:** ✅ suite completa en verde, typecheck, build y lint limpios.
- **Est vs Real:** 1 SP · 0.5 SP.
