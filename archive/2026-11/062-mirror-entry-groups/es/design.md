# 062 — Grupos de entradas mirror · Diseño

> Status: **approved**

## Enfoque

Un grupo es un conjunto de pares `(broker, ticket)` más un color, guardado en el backend. Lo crea el propio backend cuando los comandos de un mismo envío mirror vuelven con su ticket, así que no depende de que el navegador siga abierto. La propagación se queda en el frontend, que ya envía un comando por entrada (los paneles de edición y cierre aceptan listas): una acción sobre una entrada agrupada se amplía a todas las entradas abiertas de su grupo antes de enviarla. El contrato EA ↔ backend no cambia.

En MT4 una orden pendiente conserva su ticket al ejecutarse. Para el AC 8 el backend distingue posiciones de órdenes por su tipo en el mensaje `positions`: las posiciones ejecutadas de un grupo de órdenes pasan a su grupo hermano `<id>_f` (tarea 10).

### Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **A. El backend crea el grupo a partir de los resultados de los comandos (elegida)** | Funciona aunque la pestaña se cierre antes de llegar los tickets; una sola fuente de verdad | `POST /commands` gana un campo opcional |
| B. El frontend espera los tickets y da de alta el grupo | No toca `/commands` | Se pierde si se cierra la pestaña o se corta el WS mientras espera; carreras entre resultados |
| C. Propagación en el backend (`POST /entry-groups/:id/modify`) | Una llamada por acción | Duplica el circuito de comandos y la cola por broker; los paneles ya envían listas |

## Flujo de datos

```
New Trade / orden rápida (mirror, ≥2 brokers)
  → POST /commands × N, todos con el mismo groupId
  → backend: command_result ok + ticket → el store de grupos añade (broker, ticket) a groupId
  → al llegar el 2.º miembro: fila en entry_groups con un color libre de la paleta
  → WS { type: "entry_groups", groups } a todos
Positions/Orders (frontend): mapa posKey → { groupId, color }; estrella si hay ≥ 2 miembros abiertos
Editar / cerrar / cancelar / quitar SL·TP / arrastre en el gráfico de una entrada agrupada
  → el frontend la amplía a los miembros abiertos → sendCommands (uno por broker, como hoy)
  → los command_result los recoge un lote → un único aviso resumen (AC 7)
mensaje positions del pipe (por broker) → se quitan los miembros cuyo ticket ya no está abierto;
  un grupo sin miembros se borra; las órdenes ejecutadas pasan a `<id>_f` → WS entry_groups
```

## Cambios por capa

### [db]
Migración `2026112xxxxxxx_entry_groups` (SQL a mano):

```prisma
model EntryGroup {
  id        String             @id            // groupId generado por el frontend (^[A-Za-z0-9_-]{1,64}$)
  color     String
  createdAt DateTime           @default(now()) @map("created_at")
  members   EntryGroupMember[]
  @@map("entry_groups")
}

model EntryGroupMember {
  id      Int        @id @default(autoincrement())
  groupId String     @map("group_id")
  broker  String
  ticket  Int
  group   EntryGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@unique([broker, ticket])
  @@map("entry_group_members")
}
```

`@@unique([broker, ticket])`: una entrada pertenece como mucho a un grupo.

### [backend]
- `routes/commands.ts`: `groupId` opcional (mismo patrón que `id`), solo admitido en las acciones de apertura. Cuando el resultado es `ok` con ticket → `addMember(groupId, broker, ticket)`. Un resultado tardío (`late: true`) también cuenta.
- `store/entry-groups.ts` (nuevo): caché en memoria + BD.
  - `addMember`: crea el grupo con su primer miembro, todavía sin color. Al llegar el segundo le asigna el primer color de la paleta que no use otro grupo, o el menos usado si están todos cogidos.
  - `syncOpenEntries(broker, entries)` (antes `syncOpenTickets`, renombrado en la tarea 10; recibe ticket y tipo): se llama desde el handler de `positions` de `index.ts`, como `syncColors`, pero solo cuando cambian las entradas abiertas. Quita los miembros que ya no están abiertos y borra los grupos que se quedan sin miembros (tarea 10; hasta entonces un grupo con color se borraba con menos de 2). El frontend oculta la estrella de un grupo con menos de 2 miembros abiertos. Las posiciones de un grupo de órdenes pasan a `<id>_f` cuando quedan órdenes pendientes a su lado o cuando `<id>_f` ya existe.
  - `removeMember(broker, ticket)`: saca la entrada de su grupo (AC 10).
  - Cada cambio → difusión `entry_groups`.
- `routes/entry-groups.ts` (nuevo, `requireAuth`): `GET /entry-groups` devuelve `[{ id, color, members: [{ broker, ticket }] }]`, y `DELETE /entry-groups/members` con cuerpo `{ broker, ticket }`.
- `ws`: `broadcastEntryGroups(groups)`, a todos (como `positions`).
- Paleta (constante en el backend): `#f5a623 · #3a7bd5 · #c77dff · #2ec4b6 · #ff6fa8 · #e8e8e8`. Son los colores de estrella aprobados; evitan el verde y el rojo para no confundirse con compra o venta.

**Salvaguarda ante un `positions` vacío**: si el EA se está reconectando y manda una lista vacía para un broker que tenía entradas abiertas, los miembros no se quitan hasta que la misma lista vacía llegue en dos mensajes separados por 5 s o más. Si no, un reinicio del EA borraría todos los grupos.

### [frontend]
- `lib/useEntryGroups.ts` (nuevo): carga `GET /entry-groups` y escucha `entry_groups`. Expone `groupOf(broker, ticket)` → `{ id, color, members }`, contando solo los miembros abiertos en el snapshot en vivo (`useLivePositions`).
- `shared/ui/GroupStar` (componente compartido nuevo): estrella SVG de 12 px con el color del grupo y `aria-label`.
- `OpenPositions`, `PendingOrders`, `PositionCard`, `OrderCard`: la estrella delante del broker cuando el grupo tiene 2 o más miembros abiertos. Al pasar el ratón por una fila se resaltan los demás miembros (`--tint-selected`).
- `lib/entryGroups.ts`: `expandToGroup(entry, livePositions)` → la entrada más sus hermanas abiertas. Se aplica en:
  - `BulkEditPanel`: la edición de una posición abierta desde la tabla y desde el gráfico. El SL/TP que se escribe va a todos los miembros; el campo que no se toca conserva el valor de cada uno (la lógica actual).
  - `EditOrderPanel`: precio, SL y TP.
  - La confirmación de cerrar/cancelar en el Diario y en el gráfico. El mensaje lista los brokers y los lotes, como en la maqueta.
  - `ChartPage.onModifyPosition`: arrastre de SL/TP y quitar SL/TP desde el menú contextual.
- `BulkEditPanel` y `EditOrderPanel`: una caja informativa "se aplica a N entradas: brokers", los botones **Remove SL** y **Remove TP**, **Take out of group** (`DELETE /entry-groups/members`) y el botón de guardar con el texto "Save · N entries".
- `NewTradePanel` (modo mirror) y `QuickOrderConfirm`: con 2 o más comandos añaden `groupId: newCommandId()` a todos.
- `lib/commandBatch.ts` (nuevo): `trackBatch(label, ids→broker)`. `AppLayout` no muestra los avisos individuales de los `command_result` de un lote. Cuando han llegado todos (o pasados 35 s) muestra un único aviso: "SL updated in 3 of 3", o "… 2 of 3 · FTMO — Invalid stops" como advertencia.

Sin dependencias nuevas.

## Archivos a tocar
- db: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<nueva>/migration.sql`
- backend: `src/routes/commands.ts`, `src/store/entry-groups.ts` (+ test), `src/routes/entry-groups.ts`, `src/app.ts`, `src/index.ts`, `src/ws/*`
- frontend: `lib/useEntryGroups.ts`, `lib/entryGroups.ts`, `lib/commandBatch.ts`, `shared/ui/GroupStar*` (+ catálogo `/dev/ui`), `features/journal/{OpenPositions,PendingOrders,PositionCard,OrderCard,BulkEditPanel,EditOrderPanel,JournalPage,NewTradePanel}.tsx`, `features/chart/{ChartPage,QuickOrderConfirm}.tsx`, `app/layout/AppLayout.tsx`
- docs: `.claude/CLAUDE.md` (arquitectura del backend: `groupId` en los comandos, WS `entry_groups`, modelos) y `backend/docs/architecture.md`

## Riesgos
- **Los tickets no cuadran con MT4**: si el resultado de un broker vuelve sin ticket, esa entrada se queda fuera del grupo. Se ve porque no tiene estrella.
- **`positions` vacío al reiniciar el EA**: cubierto por la salvaguarda de arriba.
- **Mismo precio en brokers distintos**: un SL válido en un broker puede rechazarse en otro (stop level, spread). Lo cuenta el aviso de fallo parcial, como se acordó.
- **Dos pestañas editando a la vez**: cada una envía sus comandos, como hoy; nada nuevo.

## Maqueta
Aprobada el 2026-11-26: https://claude.ai/artifact/BbNnCUTNyTADnzhg2cM4te
- `Main` — escritorio: Positions y Orders con estrellas, resaltado del grupo al pasar el ratón, paneles de edición de posición y de orden agrupadas, confirmación de cierre del grupo, aviso de fallo parcial, paleta de grupos.
- `Mobile` — tarjetas con estrella, hoja de edición con la información del grupo y botones de 44 px, aviso de fallo parcial.
