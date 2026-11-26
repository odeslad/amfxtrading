# 063 — Configuraciones de split · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | prisma generate + build + diff del esquema | ✅ | 0.5 SP | 0.25 SP |

## Tarea 1 — [db] tabla split_layouts
- Modelo `SplitLayout` (+ `User.splitLayouts`), único `(userId, name)`, índice en `userId`.
- `migration.sql` es la salida de `prisma migrate diff --from-schema-datamodel <esquema anterior> --to-schema-datamodel prisma/schema.prisma --script`, así que coinciden por construcción. La aplica el deploy (`prisma migrate deploy`).
- `npx prisma generate` ✅ · `npm run build` ✅.
