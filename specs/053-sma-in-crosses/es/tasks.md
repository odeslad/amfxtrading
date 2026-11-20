# 053 — SMA en cruces · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: db + backend → frontend.

- [x] 1. [db] Migración que añade `fastType`/`slowType` a `ema_cross_alerts` y `ema_notifications`, y `emaTradesFastType`/`emaTradesSlowType` a `settings_display` (por defecto `'ema'`) · **Verificar:** `prisma validate` + `prisma generate` + build; `prisma migrate diff` desde producción solo muestra estas columnas · **Est:** 0.5 SP
- [ ] 2. [backend] `calculateSma` + `calculateMa` con tests (misma serie que el gráfico) · **Verificar:** vitest · **Est:** 0.5 SP
- [ ] 3. [backend] `ema-cross.ts` y `/setup-levels` con los tipos (opcionales, por defecto ema) · **Verificar:** vitest + build · **Est:** 0.75 SP
- [ ] 4. [backend] Alertas y notificaciones: las rutas validan los tipos, los evaluadores usan `calculateMa`, textos del push con las etiquetas · **Verificar:** lint + typecheck + test · **Est:** 1.5 SP
- [ ] 5. [backend] Campos de tipo del overlay en `/settings` · **Verificar:** lint + typecheck + test · **Est:** 0.25 SP
- [ ] 6. [frontend] `MaTypeToggle` + tipos en `useEmaAlerts` y `AlertsPanel` (escritorio y móvil) · **Verificar:** `npm run build` + prueba local contra el API de producción · **Est:** 1.25 SP
- [ ] 7. [frontend] Notificaciones: `useEmaNotifications`, `NotificationPanel`, tabla/cards y confirmación de borrado · **Verificar:** `npm run build` + prueba local · **Est:** 1 SP
- [ ] 8. [frontend] Overlay: `useEmaTradesSettings`, `DisplayTab`, `useEmaCrossTrades` enviando los tipos a `/setup-levels` · **Verificar:** `npm run build` + prueba local · **Est:** 0.75 SP
- [ ] 9. [docs] `backend/docs/architecture.md` y `.claude/CLAUDE.md` (y quitar el router `/chart-indicators` que sobra) · **Verificar:** manual · **Est:** 0.25 SP
- [ ] 10. [infra] Push del backend (tareas 1–5) solo, luego frontend cuando lo pida el usuario; **validar en producción**: alertas/reglas/overlay existentes iguales (AC 7); una alerta y una regla con SMA creadas y disparadas con el texto correcto; overlay con SMA coincidiendo con el gráfico; móvil · **Verificar:** manual (validación del usuario) · **Est:** 1 SP
- [ ] 11. [specs] Est vs Real en `verification.md` (ambos idiomas), cerrar y archivar en `archive/2026-11/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 8 SP
