# 062 — Mirror entry groups · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | build + schema diff | ✅ | 0.75 SP | 0.5 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 3 SP | 1.5 SP |
| 3 | vitest + typecheck/lint/build (curl → task 10) | ✅ | 2.5 SP | 1 SP |
| 4 | manual read | ✅ | 0.5 SP | 0.25 SP |
| 5 | build + eslint; /dev/ui 🕐 | ✅ / 🕐 | 1.5 SP | 0.75 SP |
| 6 | build + eslint; visual → task 10 🕐 | ✅ / 🕐 | 1.5 SP | 0.75 SP |

## Task 1 — [db] entry_groups tables
- `npx prisma generate` and `npm run build` (tsc): pass.
- The local tunnel was down, and applying the migration through it would have touched production. Instead, `prisma migrate diff --from-schema-datamodel <schema at HEAD> --to-schema-datamodel prisma/schema.prisma --script` produces the same SQL as `20261126100000_entry_groups/migration.sql` (tables, indexes, FK). The migration is applied by the deploy (`prisma migrate deploy`).
- Deviation: `entry_groups.color` defaults to `""`, because a group with a single member has no colour yet (the design assigns it on the 2nd member).

## Task 2 — [backend] entry group store
- `src/store/entry-groups.ts`: an in-memory map persisted through a repo (Prisma in production, in-memory in the tests); the DB writes are serialised.
- `entry-groups.test.ts`: 8 tests ✅ covering the palette (first free colour, then the least used), a colour only from the 2nd member, a forming group of one kept, a coloured group left with one member deleted, one of three closing, the empty-list grace, take out of group, listeners, and load after restart.
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ · `npm test`: 234/235. The one failure is `pipe-reader.test.ts` (a real named pipe, a timing assertion under the load of the whole suite); run alone it passes 2/2 and it is not touched by this spec.
- Refinement of the design: "a group with < 2 members is deleted" applies only to a group that already has a colour (has had 2 members); otherwise a group would be deleted before the result of its 2nd broker arrives.

## Task 3 — [backend] groupId in commands, /entry-groups, WS entry_groups
- `POST /commands` accepts an optional `groupId` (same pattern as `id`, 400 on close/modify). An `ok` result with a ticket, a late one too, calls `entryGroups.addMember`.
- `index.ts`: `entryGroups.load()` at startup, `syncOpenTickets` in the `positions` handler, `onChange` → WS `entry_groups` (behind `FEATURE_WS_BROADCAST`).
- `GET /entry-groups` and `DELETE /entry-groups/members` (404 when the entry is not in a group), behind `requireAuth`.
- `routes/entry-groups.test.ts`: 5 tests ✅ (`parseMember`, `groupId` optional, malformed, refused on close/modify). Typecheck ✅ · lint ✅ · build ✅ · `npm test` 239/240: the same `pipe-reader` timing flake as in task 2, skipped in CI (`skipIf(platform !== win32)`).
- Deviation: the curl check against a local backend is not possible before the deploy. The local backend uses the production DB through the tunnel, where the tables do not exist until `prisma migrate deploy` runs, and `load()` would fail at startup. The GET, the DELETE and a 400 move to the production validation (task 10).

## Task 4 — [docs] architecture
- `backend/docs/architecture.md`: data flow, `/entry-groups` route, `groupId` in `POST /commands`, WS `entry_groups`, an "Entry groups (spec 062)" section, the tables and `store/entry-groups.ts` in the project tree.
- `.claude/CLAUDE.md`: `groupId` in Commands, `entry_groups` in the WebSocket list, a "Grupos de entradas mirror (spec 062)" section, 21 routers with `/entry-groups`, the `EntryGroup` / `EntryGroupMember` models.
- Both read side by side: same palette, the same cleanup rules and the same 5 s grace ✅.

## Task 5 — [frontend] groups store, helpers, GroupStar
- `lib/entryGroups.ts`: `groupOf`, `openMembers`, `activeGroupOf` (a group counts while it has a colour and ≥ 2 open members), `expandToGroup`, `expandAllToGroups` (no duplicates).
- `lib/useEntryGroups.ts`: one app-wide copy (`useSyncExternalStore`), `loadEntryGroups`, `setEntryGroups`, `takeOutOfGroup`. `AppLayout` loads it and applies the WS `entry_groups`.
- `shared/ui/GroupStar` exported from `shared/ui`, and the six palette colours in `/dev/ui` (Badge · StatusDot · GroupStar · ProgressBar).
- `npm run build` ✅ · eslint on the touched files ✅.
- The frontend has no test runner and adding one is a dependency the spec does not list; the helpers are checked in the task 9 review.
- 🕐 Visual check in `/dev/ui` (`npm run dev`, then http://localhost:5174/dev/ui): pending for the user.

## Task 6 — [frontend] star in Positions and Orders
- `useGroupMarks(open)`: a `(broker, ticket) → { id, color }` lookup over the live positions, counting only groups with a colour and ≥ 2 open members (AC 3, AC 11).
- `OpenPositions` / `PendingOrders`: a star before the broker; hovering a row highlights every row of its group (`.groupRow`, `--tint-selected`). `PositionCard` / `OrderCard`: a star in the card header, before the colour badge, and in the Broker field.
- `npm run build` ✅ · eslint on the touched files ✅.
- Deviation: the local visual check against the mockup needs real groups, and they exist only once the backend is deployed (task 3: no local backend against the production DB before the migration). It moves to the production validation (task 10) 🕐.
