# 063 — Configuraciones de split · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | prisma generate + build + diff del esquema | ✅ | 0.5 SP | 0.25 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 1 SP |
| 3 | lectura manual | ✅ | 0.25 SP | 0.25 SP |

## Tarea 1 — [db] tabla split_layouts
- Modelo `SplitLayout` (+ `User.splitLayouts`), único `(userId, name)`, índice en `userId`.
- `migration.sql` es la salida de `prisma migrate diff --from-schema-datamodel <esquema anterior> --to-schema-datamodel prisma/schema.prisma --script`, así que coinciden por construcción. La aplica el deploy (`prisma migrate deploy`).
- `npx prisma generate` ✅ · `npm run build` ✅.

## Tarea 2 — [backend] /split-layouts
- `GET /split-layouts` (las configuraciones del usuario por `position`) y `PUT /split-layouts` con `{ layouts: [...] }`. El PUT sustituye las filas del usuario en una transacción, conservando los ids que recibe y rechazando ids de otro usuario (400); primero libera los nombres para que dos configuraciones puedan intercambiarlos. Difunde `split_layouts` al usuario y responde con la lista guardada.
- `parseLayouts`: 20 como máximo; nombre recortado, de 1 a 40 caracteres, único (sin distinguir mayúsculas); broker de `config.brokers`; símbolo no vacío, en mayúsculas; temporalidad M5 · M15 · H1 · H4 · D1.
- `split-layouts.test.ts`: 4 tests ✅. Typecheck ✅ · eslint ✅ · build ✅ · `npm test` 245/246: el fallo intermitente conocido de `pipe-reader` (en CI se salta, ver spec 062).
- Desviación: las temporalidades son las cinco que ofrece el gráfico (`ChartToolbar`), no M1 · M5 · M15 · M30 · H1 · H4 · D1 como decía el diseño.

## Tarea 3 — [docs] arquitectura
- `backend/docs/architecture.md`: `/split-layouts` en la tabla de rutas, el mensaje WS `split_layouts`, la tabla `split_layouts`.
- `.claude/CLAUDE.md`: `split_layouts` en la lista del WebSocket, una sección "Configuraciones de split (spec 063)", 22 routers con `/split-layouts`, el modelo `SplitLayout`.
- Leídos en paralelo: la misma ruta, los mismos límites y el mismo mensaje ✅.
