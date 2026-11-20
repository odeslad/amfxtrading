# 054 — UX del gráfico · Verificación

## Tarea 1 · [db] Columna de órdenes rápidas

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde producción.
- **Pasos:** la migración `20261120100000_quick_orders` añade `settings_display."quickOrders" JSONB` (admite null); `quickOrders Json?` en `SettingsDisplay`.
- **Resultado:** ✅ esquema válido, cliente generado, build en verde; el diff desde producción es exactamente esta columna.
- **Est vs Real:** 0.5 SP · 0.2 SP.
