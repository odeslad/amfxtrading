# 054 — UX del gráfico · Verificación

## Tarea 1 · [db] Columna de órdenes rápidas

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde producción.
- **Pasos:** la migración `20261120100000_quick_orders` añade `settings_display."quickOrders" JSONB` (admite null); `quickOrders Json?` en `SettingsDisplay`.
- **Resultado:** ✅ esquema válido, cliente generado, build en verde; el diff desde producción es exactamente esta columna.
- **Est vs Real:** 0.5 SP · 0.2 SP.

## Tarea 2 · [backend] Órdenes rápidas en `/settings`

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `routes/quick-orders.ts` (`parseQuickOrders`: undefined conserva, null borra; tamaño > 0, SL/TP > 0, tpMode y tp juntos, R y % de riesgo exigen SL; `readQuickOrders`: un preset borrado se lee como ninguno, un valor roto como sin configurar); `/settings` lee y escribe `display.quickOrders` y rechaza un preset que no existe; `quick-orders.test.ts`.
- **Resultado:** ✅ 212 tests en verde, typecheck, build y lint limpios.
- **Est vs Real:** 1 SP · 0.5 SP.

## Tarea 3 · [frontend] Configuración de Quick market / orders

- **Mecanismo:** `npm run build` + eslint; prueba local (Vite 5174 contra el API de producción).
- **Pasos:** `lib/quickOrders.ts` (tipo, valor por defecto, `quickOrdersError` con las reglas del backend); `QuickOrdersSection` al final de Settings › Mirror ("Quick market / orders": tamaño Lots / Risk %, SL en pips, TP en pips / R, mirror preset, Set up / Clear), guardada con los ajustes de display; Save rechaza una configuración no válida con un aviso. Acordado en la prueba: el tamaño se desactiva al elegir un preset (cada broker del preset usa su propio tamaño), y el título y la ayuda distinguen mercado y pendiente. `useQuickOrders` (lectura desde el gráfico) pasa a la tarea 8, donde se usa.
- **Resultado:** ✅ build y lint limpios; el operador revisó la sección.
- **Est vs Real:** 1.5 SP · 0.75 SP.

## Tarea 4 · [frontend] Tipo de orden y plan de la orden rápida

- **Mecanismo:** `npm run build` + eslint; los dos módulos ejecutados con `tsx` sobre precios de ejemplo (script desechable fuera del repo, `commands.ts` sustituido porque `api.ts` necesita Vite).
- **Pasos:** `lib/orderType.ts` (`orderTypeAt`); `buildQuickOrder` en `lib/quickOrders.ts` (entrada = precio pulsado o ask/bid, SL en pips, TP en pips o R, un comando por cada broker activo del preset con su tamaño, rechaza % de riesgo sin SL y un preset sin brokers activos).
- **Comprobado (EURUSD bid 1.0830 / ask 1.0831, SL 15 p, TP 2R):** compra a mercado → buy, SL 1.0816, TP 1.0861; venta a mercado → SL 1.0845, TP 1.0800; compra en 1.0800 → buylimit; venta en 1.0800 → sellstop; compra en 1.0900 → buystop; USDJPY venta, TP 30 p → SL 150.25, TP 149.80; preset → dos comandos con el tamaño de cada broker, el desactivado fuera; % de riesgo sin SL → rechazado.
- **Resultado:** ✅ build y lint limpios, cada caso como lo calcularía New Trade.
- **Est vs Real:** 0.75 SP · 0.5 SP.

## Tarea 5 · [frontend] Menú contextual con clic derecho

- **Mecanismo:** `npm run build` + eslint; prueba local en escritorio (Vite 5174 contra el API de producción).
- **Pasos:** `ChartContextMenu` (secciones de opciones, dentro del gráfico y ajustado a él; se cierra con Esc, al pulsar fuera, con la rueda, al redimensionar, al perder el foco y al elegir); `LightweightChart` informa del clic derecho en el área (`ChartContextRequest`: posición, precio en el puntero, bid/ask) y bloquea el menú del navegador, ignorando la escala de precios y las etiquetas interactivas; `chartMenu.ts` arma Buy at / Sell at (tipo con `orderTypeAt`), New trade y Price alert at; `ChartSlot` guarda el menú; `NewTradePanel.initialOrder` aplica la acción y el precio elegidos una vez por petición; `ChartPage` pasa la orden y `createAlert`.
- **Resultado:** ✅ build y lint limpios; el operador comprobó cada opción y las reglas de cierre.
- **Est vs Real:** 2.5 SP · 1 SP.

## Tarea 6 · [frontend] Objetivos del menú y botones flotantes quitados

- **Mecanismo:** `npm run build` + eslint; prueba local en escritorio.
- **Pasos:** `LightweightChart` guarda cada línea de posición/orden (entrada, SL, TP) y resuelve el objetivo bajo el puntero (línea a menos de 6 px, si no un dibujo con el nuevo `TrendlineManager.drawingAt`); la petición lleva el número de dibujos y las acciones de borrar / borrar todos; `chartMenu.ts` añade la sección de posición (Editar, Quitar SL / TP si existen, Cerrar / Cancelar; oculta con el gráfico bloqueado) y la de dibujos (Borrar dibujo, Borrar todos los dibujos… con `ConfirmPanel`); el botón derecho ya no empieza un arrastre de nivel ni un punto de dibujo; quitados los botones flotantes "+ New Trade", "Delete" y "Clear all" y su CSS (la tecla Supr se queda).
- **Resultado:** ✅ build y lint limpios; el operador comprobó las acciones de posición y de dibujo.
- **Est vs Real:** 2 SP · 1 SP.

## Tarea 7 · [frontend] Pulsación larga en táctil

- **Mecanismo:** `npm run build` + eslint; prueba local en el modo dispositivo de Chrome DevTools (el móvil no llega al Vite local); la prueba en el iPhone real pasa a la tarea 11 (producción), como ya preveía la spec.
- **Pasos:** `LightweightChart` arma un temporizador de 500 ms con un toque de un dedo (no con una herramienta de dibujo activa), que se cancela al mover más de 8 px, con un segundo dedo, touchend o touchcancel; al dispararse abre el menú 24 px por debajo del dedo (tolerancia de 18 px para líneas y dibujos) y se queda con el resto del toque (no pulsa una opción ni arrastra); el `contextmenu` de Android por pulsación larga se ignora en punteros táctiles; el gráfico tiene `user-select: none` y `-webkit-touch-callout: none`. `openMenuAt` compartido entre ratón y táctil.
- **Arreglos durante la prueba:** las opciones del menú actúan al levantar el puntero (solo si se pulsó en la misma opción), porque un manejador táctil del gráfico podía anular el clic sintético; los manejadores táctiles del gráfico ignoran los toques que empiezan en el menú; los listeners de la pulsación larga pasan al documento para que un toque sobre un dibujo también la arme; el menú ofrece "Delete selected drawing" cuando el clic no cae justo sobre la línea (precisión sin cambios, a petición del operador).
- **Resultado:** ✅ build y lint limpios; el operador lo comprobó en modo dispositivo. 🕐 Gestos en iPhone pendientes hasta la tarea 11.
- **Est vs Real:** 1.5 SP · 0.75 SP.

## Tarea 8 · [frontend] Órdenes rápidas en el menú

- **Mecanismo:** `npm run build` + eslint; prueba local del menú y de la confirmación (solo Cancel; el envío se valida en producción, tarea 11).
- **Pasos:** `lib/useQuickOrders.ts` lee la configuración y los presets; `chartMenu.ts` añade Quick buy / Quick sell (a mercado, con el tamaño o el nombre del preset) y Quick buy / sell at en el precio pulsado (limit o stop), ocultas sin configuración, con el gráfico bloqueado o sin precio; `ChartSlot` arma el plan con `buildQuickOrder` (los errores como aviso); `QuickOrderConfirm` (sobre `ConfirmPanel`, detalle en varias líneas) muestra tipo, precio, cada broker con su tamaño, preset, SL y TP, y envía un comando por broker al Confirmar; el aviso del resultado lo da `AppLayout`. La confirmación es el `ConfirmPanel` lateral existente en vez de la tarjeta centrada de la maqueta, para reutilizar el patrón del resto de confirmaciones.
- **Resultado:** ✅ build y lint limpios; el operador revisó el menú y la confirmación. 🕐 Envío pendiente hasta la tarea 11.
- **Est vs Real:** 1.5 SP · 0.5 SP.

## Tarea 9 · [frontend] Paneles New Trade y edición de posición acoplados

- **Mecanismo:** `npm run build` + eslint; prueba local en escritorio.
- **Pasos:** `shared/ui/DockedPanel.module.css` (`docked`: en el flujo, 320 px, sin transform; `hidden` cerrado; en el móvil 50dvh a todo el ancho); `NewTradePanel` y `BulkEditPanel` reciben `docked` (sin velo); `ChartPage` dispone `.workspace` = área de gráficos + los dos paneles acoplados (en columna en el móvil), y abrir uno cierra el otro. El diario sigue con la capa superpuesta. Los gráficos se redimensionan con su propio `ResizeObserver`.
- **Resultado:** ✅ build y lint limpios; el operador lo comprobó en escritorio (vista simple y partida). 🕐 Hoja inferior del móvil pendiente hasta la tarea 11.
- **Est vs Real:** 2.5 SP · 0.75 SP.

## Tarea 10 · [docs] Documentación de arquitectura

- **Mecanismo:** revisión manual del diff.
- **Pasos:** `backend/docs/architecture.md` (`/settings` y `settings_display` con `quickOrders`); `.claude/CLAUDE.md` (`SettingsDisplay.quickOrders` y una sección "Menú contextual del gráfico").
- **Resultado:** ✅ los dos documentos coinciden.
- **Est vs Real:** 0.25 SP · 0.15 SP.
