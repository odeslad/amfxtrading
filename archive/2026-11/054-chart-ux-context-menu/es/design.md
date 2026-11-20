# 054 — UX del gráfico · Diseño

## Enfoque
Tres piezas independientes que se entregan en este orden: (1) la configuración de órdenes rápidas (db + backend + Settings), (2) el menú contextual del gráfico con sus acciones, que sustituye a los botones flotantes, (3) acoplar New Trade y el panel de edición de posición al lado del gráfico. Sin dependencias nuevas.

## db
Migración que añade `settings_display."quickOrders" JSONB NULL` (null = sin configurar). Forma:

```ts
{ lotsMode: 'fixed' | 'risk_pct'; size: number; slPips: number | null;
  tpMode: 'pips' | 'r' | null; tp: number | null; mirrorPresetId: number | null }
```

Vive con el resto de ajustes de display (una fila), así que es la misma en todos los dispositivos, como los ajustes del overlay.

## backend
`routes/settings.ts`: `display.quickOrders` se lee y escribe con el resto; validado: `size > 0`; `slPips > 0` o null; `tpMode`/`tp` los dos null o los dos puestos con `tp > 0`; `tpMode: 'r'` y `lotsMode: 'risk_pct'` exigen `slPips`; `mirrorPresetId` un preset existente o null (un preset borrado vuelve a null al leer). `null` la borra. Tests junto a los de `parseDisplay`. Sin cambios en `/commands`: las órdenes rápidas envían los mismos comandos que New Trade.

## frontend

### Menú contextual
- `features/chart/ChartContextMenu.tsx` (+ CSS module): una lista posicionada de secciones `{ label, hint, tone, onSelect }`, dibujada dentro del contenedor del gráfico (así funciona también a pantalla completa) y ajustada a él; se cierra con Esc, al pulsar fuera, al elegir una opción y al desplazar o hacer zoom (`subscribeVisibleLogicalRangeChange`).
- `LightweightChart.tsx` lo abre:
  - Escritorio: `contextmenu` en el contenedor → `preventDefault` y se abre en el puntero.
  - Táctil: un temporizador de pulsación larga (500 ms) que arranca con un `touchstart` de un dedo en el área; se cancela si el dedo se mueve más de 8 px, si entra un segundo dedo o con `touchend`. No se arma con una herramienta de dibujo o la regla activas, ni cuando el toque empieza el arrastre de un nivel. Al dispararse se queda con el resto de ese toque, así que no le sigue ni clic, ni selección ni arrastre. El doble toque y el pellizco siguen igual.
  - Objetivo bajo el puntero, en este orden: una línea de posición u orden (el hit test de niveles que ya existe con `HIT_PX`/`TOUCH_HIT_PX`, ampliado a las líneas de entrada), un dibujo (`TrendlineManager` expone su `hitTest` privado como `drawingAt(clientX, clientY)`), y si no el área vacía. El precio es `series.coordinateToPrice(y)` redondeado a la precisión del símbolo.
- Opciones (maqueta): órdenes rápidas (si están configuradas y el gráfico no está bloqueado) → Buy at / Sell at / New trade → Price alert at → acciones del objetivo (posición: Editar, Quitar SL, Quitar TP, Cerrar / Cancelar orden — ocultas con el gráfico bloqueado; dibujo: Borrar dibujo) → Borrar todos los dibujos (si hay, con confirmación).
- Limit o stop: `orderTypeAt(side, price, bid, ask)` en `lib/orderType.ts`: compra → `price < ask ? 'buylimit' : 'buystop'`; venta → `price > bid ? 'selllimit' : 'sellstop'`. Con tests.
- Las acciones reutilizan lo que hay: Editar → `onEditPosition`; Cerrar → la confirmación de `ClosePositionPanel`; Quitar SL/TP → `onModifyPosition(ticket, 0, tp)` / `(ticket, sl, 0)`; Alerta → `useAlerts.create` con `direction = price > bid ? 'above' : 'below'`; Buy/Sell at → `onNewTrade` con `{ action, price }`; dibujos → `deleteSelected` / `clearAll` del manager.
- Se quitan los botones flotantes `.drawingActions` y su CSS; la tecla Supr/Retroceso se queda en `DrawingTools`.

### Orden en un precio
`NewTradePanel` recibe un `initialOrder?: { action: CommandAction; price?: number }` opcional; cuando cambia con el panel abierto, el formulario toma esa acción y ese precio (SL/TP sin tocar). `ChartPage.newTradeTimeframe` pasa a ser `newTradeRequest { timeframe, action?, price? }`.

### Órdenes rápidas
- `lib/useQuickOrders.ts`: lee `display.quickOrders` de `/settings`; `buildQuickOrder(config, { side, broker, symbol, price | null, bid, ask, presets })` devuelve los comandos y un resumen. SL = entrada ∓ `slPips × pipSize(symbol)`; TP en pips, o `entrada ± R × distancia del SL`; entrada = precio pulsado, o ask/bid a mercado. Mirror: un comando por cada broker activo del preset, con sus lotes y `lotsMode` (como el modo mirror de New Trade); si no, el broker del gráfico con el tamaño configurado. Con tests.
- `QuickOrderConfirm.tsx`: una confirmación pequeña y centrada (maqueta) sobre `ConfirmPanel`; Confirmar llama a `sendCommand` por cada comando. El aviso del resultado ya lo da `AppLayout`, que muestra cada `command_result`.
- Settings: una sección "Quick orders" al final de la pestaña Mirror (junto a los presets que puede usar): modo y tamaño, SL en pips, modo y valor del TP, selector de preset y botón "Clear". Se guarda con los ajustes de display.

### Paneles acoplados
- `NewTradePanel` y `BulkEditPanel` reciben una prop `docked?: boolean`. Acoplado, el panel deja el velo y el `position: fixed`, y `ChartPage` lo dibuja como hermano de `.chartArea` dentro de una fila flex nueva (`.workspace`). Escritorio: gráfico + panel de 320 px; el `ResizeObserver` del gráfico ya lo redimensiona (y la vista partida se reparte el ancho que queda). Móvil (≤ 768 px): la fila pasa a columna y el panel ocupa `50dvh` con su propio scroll; el gráfico se queda la mitad de arriba.
- Un solo panel acoplado a la vez: abrir New Trade cierra el de edición y al revés.
- `JournalPage` sigue con la capa superpuesta (sin `docked`). Los paneles de alertas, indicadores y filtros no se tocan.

## Flujo de datos
Settings (frontend) → `PUT /settings` (`display.quickOrders`) → `settings_display`. Menú del gráfico → `POST /commands` (sin cambios) → EA → `command_result` por WS → aviso de `AppLayout`. Sin cambios en el contrato con el EA.

## Alternativas
- Guardar la configuración en `localStorage` (como el preset de mirror elegido): sin backend, pero distinta en móvil y escritorio. Descartada (se pidió en Settings).
- Una tabla de órdenes rápidas: solo tiene sentido con varias configuraciones con nombre, que no se han pedido.
- Sacar el menú a `document.body`: más fácil de ajustar, pero desaparecería a pantalla completa. Descartada.
- Pulsación larga con eventos de lightweight-charts: la librería no tiene ese evento y su gestión táctil desplazaría el gráfico; un listener propio en fase de captura, como hace `DrawingTools`, da el control.

## Riesgos
- Conflictos de gestos táctiles (pulsación larga frente a desplazar, dibujar, arrastrar niveles, el menú de selección de texto de iOS). Mitigación: se cancela al mover, no se arma dibujando ni arrastrando, `-webkit-touch-callout: none` y `user-select: none` en el gráfico; se prueba en iPhone en la validación.
- Una orden rápida es una orden real en dos toques: siempre se confirma y se oculta con el gráfico bloqueado.
- Acoplar cambia el ancho del gráfico al abrir un panel; el gráfico conserva el rango visible al redimensionar (comportamiento por defecto de lightweight-charts); se comprueba en la validación.

## Maqueta
https://claude.ai/artifact/Qox8veBEwiDiFfrN8dcty7 — artboards: Desktop · menu on empty area; Desktop · menu on a position line; Desktop · menu on a drawing; Desktop · quick order confirmation; Desktop · New Trade docked, chart narrowed; Phone · long press menu; Phone · New Trade as bottom sheet; Settings · Quick orders (desktop); Settings · Quick orders (phone).
