# 062 — Mirror entry groups · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | build + schema diff | ✅ | 0.75 SP | 0.5 SP |

## Task 1 — [db] entry_groups tables
- `npx prisma generate` and `npm run build` (tsc): pass.
- The local tunnel was down, and applying the migration through it would have touched production. Instead, `prisma migrate diff --from-schema-datamodel <schema at HEAD> --to-schema-datamodel prisma/schema.prisma --script` produces the same SQL as `20261126100000_entry_groups/migration.sql` (tables, indexes, FK). The migration is applied by the deploy (`prisma migrate deploy`).
- Deviation: `entry_groups.color` defaults to `""`, because a group with a single member has no colour yet (the design assigns it on the 2nd member).
