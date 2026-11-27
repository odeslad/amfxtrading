# 063 — Configuraciones de split · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | prisma generate + build + diff del esquema | ✅ | 0.5 SP | 0.25 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 1 SP |
| 3 | lectura manual | ✅ | 0.25 SP | 0.25 SP |
| 4 | build + eslint + revisión contra la maqueta; visual → tarea 6 🕐 | ✅ / 🕐 | 3 SP | 1 SP |
| 5 | build + eslint + revisión contra la maqueta; visual → tarea 6 🕐 | ✅ / 🕐 | 3 SP | 1 SP |

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

## Tarea 4 — [frontend] sección de Settings
- `lib/useSplitLayouts.ts`: tipos, `fetchSplitLayouts` / `saveSplitLayouts`, `isLinkedLayout`, y el hook `useSplitLayouts` (GET + recarga con el WS `split_layouts`) para el gráfico.
- `SplitLayoutsSection` construido con `shared/ui` con el patrón de Mirror presets: una `Section`; una barra con el `Select` Layout, el `TextInput` Name, **+ New** y **Delete**; una `Table` Left/Right × Broker/Pair/Timeframe con tarjetas en móvil. Sin configuraciones muestra un estado vacío y + New.
  - Los pares de un broker son sus pares activos (Settings › Visibility). Al cambiar el broker se conserva el par si ese broker lo ofrece; si no, EURUSD o su primer par.
- `SettingsPage`: su propio `useAutosave` (validación: nombre obligatorio, sin nombres repetidos), unido al estado de la página con `combineSaves`; las configuraciones nuevas reciben su id del guardado sin remontar campos.
- `npm run build` ✅ · eslint ✅.
- Desviación: Settings ya no tiene sección "Display" (la spec 058 la reagrupó en Trading, Chart, Indicators…). La sección va en **Settings › Chart**, cuyo resumen ahora incluye "Split layouts".
- 🕐 La prueba en la app en marcha necesita el backend desplegado (antes no existe la ruta `/split-layouts`). Pasa a la tarea 6.

## Tarea 5 — [frontend] botón, panel y aplicar en el gráfico
- `IconSplitLayouts` en `shared/ui/icons`. `ChartToolbar` / `ChartSlot`: un botón `onSplitLayouts` junto al del split, solo en el gráfico izquierdo y solo en escritorio (`splitAvailable` + `desktopOnly`), resaltado mientras el panel está abierto.
- `SplitLayoutsPanel` sobre el `SidePanel` compartido:
  - cada configuración muestra I/D `broker · par · temporalidad` y linked/unlinked;
  - **Active** cuando el split está abierto y los dos lados coinciden;
  - **Unavailable**, con el motivo, cuando un broker está oculto o un par apagado, y el botón queda desactivado;
  - un estado vacío y un enlace a Settings › Chart.
- `ChartPage.applySplitLayout`: fija el broker, el par y la temporalidad del izquierdo, y luego el split `{ on, rightTimeframe, linked, rightBroker, rightSymbol }`. `linked` se activa cuando los dos lados comparten broker y par; el ancho no se toca; se borra la memoria de cerrar/reabrir; el panel se cierra. Las configuraciones salen de `useSplitLayouts` (recarga por WS).
- `npm run build` ✅ · eslint de `features/chart` e `icons` ✅.
- 🕐 La prueba en la app en marcha pasa a la tarea 6 (necesita el backend desplegado).

## Ajustes pedidos durante la validación (2026-11-27)
- El botón de configuraciones de split está también en la barra del gráfico derecho (la maqueta lo ponía solo a la izquierda); los dos abren el mismo panel.
- El panel es menos apretado:
  - más espacio entre las configuraciones y dentro de cada una;
  - el nombre en la cabecera con la etiqueta Active / Unavailable en un recuadro;
  - una fila por gráfico con la etiqueta Left / Right, con broker, par y temporalidad en columnas propias;
  - enlazado / desenlazado como una pequeña etiqueta debajo.
- `npm run build` ✅ · eslint ✅.
