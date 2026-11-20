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

## Tarea 5 · [ea] Lista de símbolos del broker, config en vivo y sincronización de un par

- **Mecanismo:** compilado por el pipeline del EA al desplegar; prueba manual en un terminal (tarea 9).
- **Pasos:** `HttpBridgeState` 3.16: `SelectSymbols` (Observación del mercado), `WriteAvailableSymbols` (`symbols-available.json` con los nombres de `SymbolsTotal(false)`, al arrancar y cuando cambia el número, mirado cada 60 s), `ReloadConfigIfChanged` cada 5 s por la hora de modificación de `config.json` (`FileGetInteger`, `FILE_MODIFY_DATE`), conservando el nombre de broker del pipe. `HttpBridgeCommands` 2.24: la misma recarga cada 5 s; `ExtractStringArray` lee `symbols` de `sync-command.json` y la sincronización recorre esa lista (si no, todos los símbolos enviados). Visto al escribirlo: un `symbols` vacío hace que el EA vuelva a su lista interna por defecto, así que el backend ya no deja guardar una lista vacía ("Keep at least one pair on", arreglo aparte del backend).
- **Resultado:** 🕐 pendiente de la compilación del pipeline y la prueba en el terminal.
- **Est vs Real:** 3 SP · 1 SP (código).

## Tarea 6 · [frontend] La visibilidad sigue a los pares enviados

- **Mecanismo:** `npm run build` + eslint; prueba local contra producción.
- **Pasos:** `lib/visibility.ts`: `activeSymbols` cargado de `GET /broker-symbols` junto a `/settings`, `isSymbolVisible` = está en la lista activa del broker (sin distinguir mayúsculas; un broker sin lista lo muestra todo), `setBrokerSymbols` para el mensaje WS `broker_symbols` (conectado en `AppLayout`), `publishVisibility` conserva las listas activas al guardar Settings; `hiddenSymbols` ya no filtra.
- **Resultado:** ✅ build y lint limpios; el operador comprobó que solidary y solidary II solo listan EURUSD y que FTMO / darwinex conservan sus 15 pares.
- **Est vs Real:** 1 SP · 0.4 SP.

## Tarea 7 · [frontend] Pares en Settings › Visibility

- **Mecanismo:** `npm run build` + eslint; prueba local contra producción; un guardado real en demo (activar NZDUSD) vigilado en el servidor.
- **Pasos:** `lib/useBrokerSymbols.ts` (GET, WS, guardar, símbolos abiertos de `/positions/live`); `SymbolsPanel` reescrito (pares en rejilla de 3 columnas, pares bloqueados con posiciones abiertas, All on / All off, Save to EA, errores en el panel, hoja en el móvil); `VisibilityTab` muestra "N on · M off" o "list pending" y un botón **Pairs**; `SettingsPage` deja de editar los símbolos ocultos. Prueba en demo: `config.json` añadió NZDUSD, el EA lo recargó sin reiniciar, el backend sincronizó solo NZDUSD (H1 10 000, el resto 2 047: lo que MT4 tenía cargado) y una vela D1 con hora 0 escrita por el EA antes de cargar el histórico quedó sustituida por la sincronización.
- **Acordado en la prueba (AC 12):** mostrar el avance de la activación (el backend marca las filas del broker "waiting for the EA" / "history requested" / error y lo emite; Visibility muestra la sincronización bajo el broker con enlace a Data; el aviso al guardar nombra los pares que se sincronizan) y no guardar nunca velas con hora 0 (watcher de ficheros, cierres por tick, sincronización), en dos commits del backend.
- **Resultado:** ✅ build y lint limpios; el operador revisó la pantalla y el guardado en demo. 🕐 El avance se comprueba tras desplegar el backend (tarea 9).
- **Est vs Real:** 2 SP · 1.25 SP.

## Tarea 8 · [docs] Documentación

- **Mecanismo:** revisión manual del diff.
- **Pasos:** `ea/docs/deploy.md` (`symbols` gestionado desde la app, recarga en vivo, `symbols-available.json`); `backend/docs/architecture.md` (`/broker-symbols`, sustitución acotada en la sincronización, sincronización de pares nuevos con sus estados, velas con hora 0, `hiddenSymbols` sin uso); `.claude/CLAUDE.md` (ficheros bridge, 20 routers, sección "Pares de cada broker", `hiddenSymbols` sin uso).
- **Resultado:** ✅ los tres documentos coinciden.
- **Est vs Real:** 0.5 SP · 0.25 SP.
