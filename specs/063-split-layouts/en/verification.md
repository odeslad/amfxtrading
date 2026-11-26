# 063 — Split layouts · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | prisma generate + build + schema diff | ✅ | 0.5 SP | 0.25 SP |

## Task 1 — [db] split_layouts table
- `SplitLayout` model (+ `User.splitLayouts`), unique `(userId, name)`, index on `userId`.
- `migration.sql` is the output of `prisma migrate diff --from-schema-datamodel <schema before> --to-schema-datamodel prisma/schema.prisma --script`, so the two match by construction. It is applied by the deploy (`prisma migrate deploy`).
- `npx prisma generate` ✅ · `npm run build` ✅.
