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
