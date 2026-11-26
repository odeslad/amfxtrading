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
