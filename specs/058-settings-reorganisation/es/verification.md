# 058 — Reorganización de Settings · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est vs Real |
|---|---|---|---|---|---|
| 1. NavList, SaveStatus, useAutosave | build + demo en el catálogo | `npm run build`; `eslint src/shared/ui src/dev src/lib/useAutosave.ts`; `/dev/ui` en vite 5175 | ✅ | Build OK; lint limpio; demo en el catálogo con guardado simulado (OK / SLOW / FAIL, no válido por debajo de 1); el usuario pidió seguir. Pendiente y no válido se calculan en el render (sin setState en efectos); los guardados se encadenan mientras lleguen cambios | 2,5 / 1,5 SP |
