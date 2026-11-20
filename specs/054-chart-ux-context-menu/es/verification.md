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
