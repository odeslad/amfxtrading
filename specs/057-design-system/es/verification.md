# 057 — Sistema de diseño · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est vs Real |
|---|---|---|---|---|---|
| 1. Tokens + `/dev/ui` | build + servidor de desarrollo | `npm run build`; `eslint src/dev src/app/Router.tsx`; `grep -rl UiCatalog dist/`; vite dev en 5175 → `GET /dev/ui`, `GET /src/dev/UiCatalogPage.tsx` | ✅ | Build OK; lint limpio; el catálogo no está en `dist/` (grep sale con 1); ruta y módulo de desarrollo responden 200; los tokens nuevos se sirven en `variables.css` | 1,5 / 0,5 SP — menos de lo previsto |
