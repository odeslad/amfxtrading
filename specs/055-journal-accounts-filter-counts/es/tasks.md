# 055 — Cuentas del diario · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: db + backend → frontend.

- [x] 1. [db] Migración que añade `account_colors (broker PK, color)` y el modelo `AccountColor` · **Verificar:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` desde producción solo muestra esta tabla · **Est:** 0.25 SP
- [ ] 2. [backend] `GET /balances` con `color`; `PATCH /balances/color` (upsert, vacío borra) con tests · **Verificar:** lint + typecheck + test + build · **Est:** 0.75 SP
- [ ] 3. [frontend] `ColorBadge` con su propia función de guardado (posiciones y órdenes sin cambios); distintivo de color en las cuentas (tabla y tarjetas) · **Verificar:** build + eslint; local: el color de la cuenta rota y sobrevive a recargar; los distintivos de posiciones y órdenes siguen funcionando · **Est:** 1 SP
- [ ] 4. [frontend] "Trades / Orders" por cuenta desde las posiciones en vivo (columna en escritorio, ordenable; en la tarjeta del móvil en lugar de Number, Number en los detalles) · **Verificar:** build + eslint; local: los contadores coinciden con las pestañas Positions y Orders y cambian en vivo · **Est:** 1 SP
- [ ] 5. [frontend] Filtros de cuentas: `fields` en `FiltersPanel`, botón Filters en Accounts, Broker y Color, guardados en `localStorage`, mensaje vacío · **Verificar:** build + eslint; local: cada filtro, borrar, estado activo, recargar · **Est:** 1 SP
- [ ] 6. [docs] `.claude/CLAUDE.md` y `backend/docs/architecture.md`: `account_colors` y `PATCH /balances/color` · **Verificar:** manual · **Est:** 0.25 SP
- [ ] 7. [infra] Push del backend (tareas 1–2) solo, luego frontend cuando lo pida el usuario; **validar en producción**, escritorio y móvil: colores, filtros, Trades / Orders, distintivos de posiciones/órdenes sin cambios · **Verificar:** manual (validación del usuario) · **Est:** 0.5 SP
- [ ] 8. [specs] Est vs Real en `verification.md` (ambos idiomas), cerrar y archivar en `archive/YYYY-MM/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 5 SP
