# 062 — Grupos de entradas mirror · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | build + diff del esquema | ✅ | 0.75 SP | 0.5 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 3 SP | 1.5 SP |
| 3 | vitest + typecheck/lint/build (curl → tarea 10) | ✅ | 2.5 SP | 1 SP |
| 4 | lectura manual | ✅ | 0.5 SP | 0.25 SP |
| 5 | build + eslint; /dev/ui 🕐 | ✅ / 🕐 | 1.5 SP | 0.75 SP |
| 6 | build + eslint; visual → tarea 10 🕐 | ✅ / 🕐 | 1.5 SP | 0.75 SP |
| 7 | build + eslint + ejecución de asMirrorGroup en node | ✅ | 0.75 SP | 0.5 SP |
| 8 | build + eslint + simulación en node | ✅ | 1.5 SP | 0.75 SP |
| 9 | build + eslint + ejecución de utilidades en node + revisión de código; visual → tarea 10 🕐 | ✅ / 🕐 | 4 SP | 2 SP |
| 10 | vitest + lint/typecheck/test/build | ✅ | 2 SP | 1 SP |

## Tarea 1 — [db] tablas entry_groups
- `npx prisma generate` y `npm run build` (tsc): correctos.
- El túnel local estaba caído, y aplicar la migración a través de él habría tocado producción. En su lugar, `prisma migrate diff --from-schema-datamodel <esquema en HEAD> --to-schema-datamodel prisma/schema.prisma --script` genera el mismo SQL que `20261126100000_entry_groups/migration.sql` (tablas, índices, FK). La migración la aplica el deploy (`prisma migrate deploy`).
- Desviación: `entry_groups.color` tiene por defecto `""`, porque un grupo con un solo miembro todavía no tiene color (el diseño lo asigna al llegar el 2.º miembro).

## Tarea 2 — [backend] store de grupos
- `src/store/entry-groups.ts`: un mapa en memoria persistido a través de un repo (Prisma en producción, en memoria en los tests); las escrituras en BD van en serie.
- `entry-groups.test.ts`: 8 tests ✅ que cubren la paleta (primer color libre, luego el menos usado), el color solo a partir del 2.º miembro, un grupo de uno en formación que se conserva, un grupo con color que se queda con un miembro y se borra, el cierre de uno de tres, la espera de la lista vacía, sacar del grupo, los avisos y la carga tras reinicio.
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ · `npm test`: 234/235. El único fallo es `pipe-reader.test.ts` (un named pipe real, una comprobación de tiempos con la carga de toda la suite); ejecutado solo pasa 2/2 y esta spec no lo toca.
- Ajuste del diseño: "un grupo con menos de 2 miembros se borra" se aplica solo a un grupo que ya tiene color (ha tenido 2 miembros); si no, un grupo se borraría antes de que llegue el resultado de su 2.º broker.

## Tarea 3 — [backend] groupId en los comandos, /entry-groups, WS entry_groups
- `POST /commands` acepta un `groupId` opcional (mismo patrón que `id`, 400 en close/modify). Un resultado `ok` con ticket, también uno tardío, llama a `entryGroups.addMember`.
- `index.ts`: `entryGroups.load()` al arrancar, `syncOpenTickets` en el handler de `positions`, `onChange` → WS `entry_groups` (tras `FEATURE_WS_BROADCAST`).
- `GET /entry-groups` y `DELETE /entry-groups/members` (404 si la entrada no está en un grupo), tras `requireAuth`.
- `routes/entry-groups.test.ts`: 5 tests ✅ (`parseMember`, `groupId` opcional, mal formado, rechazado en close/modify). Typecheck ✅ · lint ✅ · build ✅ · `npm test` 239/240: el mismo fallo intermitente de tiempos de `pipe-reader` que en la tarea 2, que en CI se salta (`skipIf(platform !== win32)`).
- Desviación: la prueba con curl contra un backend local no es posible antes del deploy. El backend local usa la BD de producción por el túnel, donde las tablas no existen hasta que corre `prisma migrate deploy`, y `load()` fallaría al arrancar. El GET, el DELETE y un 400 pasan a la validación en producción (tarea 10).

## Tarea 4 — [docs] arquitectura
- `backend/docs/architecture.md`: flujo de datos, ruta `/entry-groups`, `groupId` en `POST /commands`, WS `entry_groups`, una sección "Entry groups (spec 062)", las tablas y `store/entry-groups.ts` en el árbol del proyecto.
- `.claude/CLAUDE.md`: `groupId` en Comandos, `entry_groups` en la lista del WebSocket, una sección "Grupos de entradas mirror (spec 062)", 21 routers con `/entry-groups`, los modelos `EntryGroup` / `EntryGroupMember`.
- Leídos en paralelo: la misma paleta, las mismas reglas de limpieza y la misma espera de 5 s ✅.

## Tarea 5 — [frontend] store de grupos, utilidades, GroupStar
- `lib/entryGroups.ts`: `groupOf`, `openMembers`, `activeGroupOf` (un grupo cuenta mientras tiene color y 2 o más miembros abiertos), `expandToGroup`, `expandAllToGroups` (sin duplicados).
- `lib/useEntryGroups.ts`: una copia para toda la app (`useSyncExternalStore`), `loadEntryGroups`, `setEntryGroups`, `takeOutOfGroup`. `AppLayout` la carga y aplica el WS `entry_groups`.
- `shared/ui/GroupStar` exportado desde `shared/ui`, y los seis colores de la paleta en `/dev/ui` (Badge · StatusDot · GroupStar · ProgressBar).
- `npm run build` ✅ · eslint de los archivos tocados ✅.
- El frontend no tiene herramienta de tests y añadirla es una dependencia que la spec no recoge; las utilidades se comprueban en la revisión de la tarea 9.
- 🕐 Revisión visual en `/dev/ui` (`npm run dev`, luego http://localhost:5174/dev/ui): pendiente del usuario.

## Tarea 6 — [frontend] estrella en Positions y Orders
- `useGroupMarks(open)`: una búsqueda `(broker, ticket) → { id, color }` sobre las posiciones en vivo, que cuenta solo los grupos con color y 2 o más miembros abiertos (AC 3, AC 11).
- `OpenPositions` / `PendingOrders`: una estrella delante del broker; al pasar el ratón por una fila se resaltan todas las de su grupo (`.groupRow`, `--tint-selected`). `PositionCard` / `OrderCard`: una estrella en la cabecera de la tarjeta, delante de la insignia de color, y en el campo Broker.
- `npm run build` ✅ · eslint de los archivos tocados ✅.
- Desviación: la revisión visual en local contra la maqueta necesita grupos reales, y solo existen cuando el backend está desplegado (tarea 3: sin backend local contra la BD de producción antes de la migración). Pasa a la validación en producción (tarea 10) 🕐.

## Tarea 7 — [frontend] groupId desde New Trade y las órdenes rápidas
- `lib/commands.ts`: `Command.groupId?` y `asMirrorGroup(cmds)`, que da el mismo id nuevo a todos los comandos cuando hay 2 o más y deja intacto un comando único. Lo usan `NewTradePanel` (modo mirror) y `planQuickOrder` (`lib/quickOrders.ts`, que `QuickOrderConfirm` envía tal cual).
- `npm run build` ✅ · eslint ✅.
- En lugar de la comprobación en la red (sin backend local antes del deploy, ver tarea 3), `asMirrorGroup` empaquetado con esbuild y ejecutado en Node da 1 broker → `groupId` undefined, y 3 brokers → el mismo id en los tres, que cumple `^[A-Za-z0-9_-]{1,64}$` ✅. La petición real se comprueba en la tarea 10.

## Tarea 8 — [frontend] un único aviso resumen por lote
- `lib/commandBatch.ts`: `trackBatch(label, commands)` (solo con 2 o más), `takeBatchResult(msg)` (true cuando el resultado pertenece a un lote), `summaryOf`, y una espera máxima de 35 s que da por "No response from EA" a los brokers que faltan. `AppLayout` no muestra su propio aviso para un resultado que recoge un lote.
- Conectado también en esta tarea: New Trade (mirror) y las órdenes rápidas siguen sus envíos como "Order placed", así que una entrada mirror también tiene un solo aviso.
- `npm run build` ✅ · eslint ✅.
- `commandBatch` + `toast` empaquetados con esbuild y ejecutados en Node (espera acortada a 300 ms): 3 resultados con un error → `error: SL updated in 2 of 3 · FTMO — Invalid stops`; todos bien → `success: Closed in 2 of 2`; un id ajeno y un lote de un comando no se recogen (se queda su propio aviso); un resultado que no llega → `error: TP updated in 1 of 2 · FTMO — No response from EA` ✅.
- Desviaciones: el aviso de fallo parcial usa el estilo `error` existente (no hay tipo de aviso de advertencia y añadirlo queda fuera de esta tarea). Un comando que el backend rechaza con 400 nunca recibe resultado por WS, así que se cuenta como "No response" pasados 35 s, además del aviso de rechazo que ya muestra quien lo envía.

## Tarea 9 — [frontend] propagación y controles del grupo
- Ampliación en el momento del clic (`features/journal/groupExpansion.ts` → `expandWithGroups`, sobre el feed en vivo del Diario o las filas de todos los brokers del gráfico):
  - Positions › Edit y Close (`OpenPositions`), Orders › Edit y Cancel (`JournalPage`);
  - el panel de edición del gráfico, el de cierre (`ClosePositionPanel` ahora recibe una lista) y `onModifyPosition` (arrastre de SL/TP, quitar SL/TP desde el menú contextual).
- `GroupInfo` (en `BulkEditPanel` y `EditOrderPanel`): una caja de aviso con la estrella, "Applies to the N entries of the group: brokers", y **Take <broker> out of group** (`DELETE /entry-groups/members`, cierra el panel). Solo aparece cuando el panel contiene exactamente los miembros abiertos de un grupo activo.
- `BulkEditPanel`: **Remove SL** / **Remove TP** a todas las entradas, "Save · N entries". `EditOrderPanel`: "Save · N orders". Las confirmaciones de cierre listan broker y lotes: "Close group of 3?", "Close 3".
- Todo envío a varias entradas pasa por `trackBatch` (SL/TP updated, SL removed, TP removed, Order updated, Closed, Orders cancelled).
- `npm run build` ✅ · eslint de `features/journal`, `ChartPage`, `lib` ✅.
- Las utilidades de la tarea 5, empaquetadas con esbuild y ejecutadas en Node: un grupo de 3 abierto desde su 2.ª entrada → esa entrada primero y luego las otras dos; sin grupo → la entrada sola; un grupo en formación (sin color) → sola; un grupo con 1 abierta → sola (`activeGroupOf` null); dos entradas del mismo grupo → 3 entradas sin duplicados ✅.
- Revisión de código contra la maqueta: el panel de edición (caja, Remove SL/TP, sacar del grupo, Save · N), el de orden (caja, precio, sacar del grupo, Save · N orders), la confirmación de cierre del grupo con brokers y lotes, un aviso por lote ✅. En móvil se abren los mismos paneles como hoja.
- Desviación: como en la tarea 6, la prueba en la app en marcha necesita grupos reales, así que pasa a la tarea 10 🕐. El TP por ratio R de `BulkEditPanel` sigue calculando el TP de cada entrada desde su propio precio de apertura; es un cálculo explícito por entrada y se mantiene tal cual.

## Tarea 10 — [backend] partir un grupo ejecutado en parte (añadida en la validación)
- El usuario pidió, el 2026-11-26, que un grupo de órdenes ejecutado en parte se convierta en dos grupos: las órdenes que siguen pendientes (conservan el color) y las posiciones ejecutadas (color nuevo). Se actualizaron el AC 8 y el diseño.
- `store/entry-groups.ts`: `syncOpenEntries(broker, [{ ticket, type }])` sustituye a `syncOpenTickets`. Las posiciones de un grupo de órdenes pasan a `<id>_f` mientras quedan órdenes pendientes a su lado o cuando `<id>_f` ya existe; un grupo lanzado a mercado nunca se parte; una entrada cuyo broker aún no ha informado se deja como está. Un grupo ahora solo se borra cuando se queda vacío, porque un grupo de órdenes con 1 tiene que seguir conociendo su hermano `_f` cuando esa orden se ejecute (la estrella ya se oculta con menos de 2 abiertas).
- vitest: 10 tests del store + 5 de las rutas ✅, entre ellos 4 órdenes → se ejecuta 1 (`g1` conserva 3 con su color, `g1_f` 1 sin color) → 2 más (`g1_f` 3 con otro color) → la última (`g1` borrado, `g1_f` 4), un grupo a mercado sin partir, y se conserva con 1 abierta / se borra sin ninguna.
- `npm run typecheck` ✅ · eslint ✅ · `npm run build` ✅ · `npm test` 242/242 ✅.
