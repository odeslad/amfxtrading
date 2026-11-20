# 056 — Símbolos de cada broker desde el frontend · Diseño

## Enfoque
La carpeta bridge de cada broker (`brokers.json` → `bridgePath`) ya la comparten el EA y el backend, así que todo pasa por ficheros allí: el EA escribe la lista de símbolos del broker, el backend la lee y lee/escribe `config.json`, y el EA vuelve a leer `config.json` cuando cambia. El "símbolo oculto" del frontend pasa a ser "símbolo que no está en `config.json`", así que hay un solo ajuste. Sin tabla nueva.

## ea (los dos EAs; cambio de contrato con el EA, compatible hacia atrás)
- **Símbolos disponibles:** `HttpBridgeState` escribe `bridge/symbols-available.json` `{ "symbols": [...] }` con `SymbolsTotal(false)` / `SymbolName(i, false)` al arrancar y cada vez que cambia ese número (se mira cada 60 s, con las escrituras de estado).
- **Config en vivo:** los dos EAs guardan la hora de modificación de `config.json`; cada 5 s la comparan y, si cambió, vuelven a ejecutar `LoadConfig()` + `ParseSymbols()`. `HttpBridgeState` llama a `SymbolSelect(sym, true)` para cada símbolo, para que esté en la Observación del mercado y reciba ticks; el siguiente lote de ticks y las escrituras de velas usan la lista nueva. `brokerName` se vuelve a leer pero no se reabre el pipe (el backend nunca lo cambia).
- **Sincronizar algunos símbolos:** `sync-command.json` admite un array opcional `symbols`; si viene, `HttpBridgeCommands` sincroniza solo esos símbolos (el resto del flujo es el de la spec 049).
- Un backend antiguo ignora el fichero y el campo nuevos; un EA antiguo ignora el campo nuevo (sincronizaría todos los símbolos), así que el EA se despliega después del backend.

## backend
- `services/broker-symbols.ts`: por broker, `available()` (lee `symbols-available.json`, `null` si no existe), `configured()` (lee `symbols` de `config.json`), `write(symbols)` (lee el fichero, sustituye solo `symbols`, escribe `config.json.tmp` + rename, como `command.json`; lanza un error claro si no se puede escribir la carpeta o el fichero).
- Rutas (`routes/broker-symbols.ts`, bajo `requireAuth`):
  - `GET /broker-symbols` → `[{ broker, available: string[] | null, active: string[] }]`, donde `available` deja solo los cruces de AUD, EUR, NZD, USD, CAD, GBP y JPY (las seis primeras letras, conservando el sufijo del broker) para cada broker de `brokers.json`.
  - `PUT /broker-symbols/:broker { symbols }` → valida el broker, que cada símbolo esté en `available` (si se conoce) y que ningún símbolo que se apaga tenga posiciones u órdenes abiertas (`store/positions`; `409` con los símbolos); escribe `config.json`; encola la sincronización de velas de los símbolos recién activados (abajo); avisa por WS (`broker_symbols`); devuelve el estado nuevo.
- **Sincronización de los símbolos nuevos:** la entrada de sincronización de `routes/candle-sync.ts` admite `symbols` opcional; la petición espera a que el EA envíe el símbolo (primer tick visto, 2 min como mucho) y entonces escribe `sync-command.json` con cada temporalidad de Data a su objetivo configurado y `symbols`. `sync-watcher.ts` sustituye solo esos símbolos en su transacción (`deleteMany({ broker, timeframe, symbol: { in } })`) cuando el encargo los traía. El progreso va por el mensaje WS `candle_sync` que ya existe.
- **Paso de los símbolos ocultos (AC 7):** al arrancar el backend, si `settings_display.hiddenSymbols` no está vacío, por cada broker se quitan los símbolos ocultos de su `config.json` (salvo los que tengan posiciones abiertas, que siguen activos) y se vacía `hiddenSymbols`. Idempotente; queda en el log.
- `/settings` sigue aceptando `visibility.hiddenSymbols` pero lo ignora (clientes antiguos); `hiddenBrokers` sin cambios.

## db
Sin cambios de esquema; `hiddenSymbols` deja de usarse (se borra en una spec posterior, cuando el paso ya haya corrido, como `chart_indicators`).

## frontend
- `lib/visibility.ts`: `Visibility` añade `activeSymbols: Record<string, string[]>` desde `GET /broker-symbols` (y el mensaje WS `broker_symbols`); `isSymbolVisible` = broker visible y (sin lista aún para ese broker, o el símbolo está en ella). Todos los sitios que ya filtran con ella (listas del gráfico, diario, alertas, notificaciones…) la siguen sin cambios.
- Settings › Visibility: la columna Symbols de la tabla muestra "N on · M off" (o "list pending" si el EA aún no ha informado); el `SymbolsPanel` actual lista esos pares (21 como mucho) por orden alfabético en una rejilla de 3 columnas, cada uno activo o apagado, All on / All off, los símbolos con posiciones abiertas bloqueados en activo (con el motivo), y **Save to EA** (`PUT /broker-symbols/:broker`); errores como en la maqueta. El interruptor de broker visible se mantiene.

## Flujo de datos
EA → `symbols-available.json` → backend → `GET /broker-symbols` → Settings. Guardar → `PUT` → `config.json` → EA (5 s) → ticks nuevos → el backend ve el primer tick → `sync-command.json { symbols }` → EA → ficheros de sincronización → velas de ese símbolo sustituidas → WS `candle_sync`.

## Alternativas
- Mantener tres estados (activo / oculto / apagado): descartado por el operador; un solo ajuste.
- Guardar las listas en BD y mandarlas al EA: duplica `config.json`, que el EA tiene que leer igualmente.
- Reiniciar el terminal tras cada cambio: sin tocar el EA, pero el reinicio corta el pipe y las órdenes un minuto; descartado.

## Riesgos
- Escribir `config.json` mientras el EA lo lee: escritura a `.tmp` + rename (atómico en NTFS); el EA lee el fichero entero y conserva la config anterior si falla el parseo.
- Un broker con decenas de símbolos activos añade carga al pipe y a los ficheros; el panel muestra el recuento y el operador decide.
- El paso edita una vez las configs de los EAs en producción; respeta los símbolos con posiciones abiertas y deja cada cambio en el log.

## Maqueta
https://claude.ai/artifact/2n7KMYqaWDh9TytC7iiejw — artboards: Settings › Visibility (brokers con recuentos activo/apagado, lista pendiente); panel de símbolos (chips activo/apagado, símbolos bloqueados, Save to EA); guardado fallido; hoja en el móvil.
