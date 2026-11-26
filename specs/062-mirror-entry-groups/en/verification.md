# 062 — Mirror entry groups · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | build + schema diff | ✅ | 0.75 SP | 0.5 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 3 SP | 1.5 SP |

## Task 1 — [db] entry_groups tables
- `npx prisma generate` and `npm run build` (tsc): pass.
- The local tunnel was down, and applying the migration through it would have touched production. Instead, `prisma migrate diff --from-schema-datamodel <schema at HEAD> --to-schema-datamodel prisma/schema.prisma --script` produces the same SQL as `20261126100000_entry_groups/migration.sql` (tables, indexes, FK). The migration is applied by the deploy (`prisma migrate deploy`).
- Deviation: `entry_groups.color` defaults to `""`, because a group with a single member has no colour yet (the design assigns it on the 2nd member).

## Task 2 — [backend] entry group store
- `src/store/entry-groups.ts`: an in-memory map persisted through a repo (Prisma in production, in-memory in the tests); the DB writes are serialised.
- `entry-groups.test.ts`: 8 tests ✅ covering the palette (first free colour, then the least used), a colour only from the 2nd member, a forming group of one kept, a coloured group left with one member deleted, one of three closing, the empty-list grace, take out of group, listeners, and load after restart.
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ · `npm test`: 234/235. The one failure is `pipe-reader.test.ts` (a real named pipe, a timing assertion under the load of the whole suite); run alone it passes 2/2 and it is not touched by this spec.
- Refinement of the design: "a group with < 2 members is deleted" applies only to a group that already has a colour (has had 2 members); otherwise a group would be deleted before the result of its 2nd broker arrives.
