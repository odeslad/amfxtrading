# 062 — Grupos de entradas mirror · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | build + diff del esquema | ✅ | 0.75 SP | 0.5 SP |

## Tarea 1 — [db] tablas entry_groups
- `npx prisma generate` y `npm run build` (tsc): correctos.
- El túnel local estaba caído, y aplicar la migración a través de él habría tocado producción. En su lugar, `prisma migrate diff --from-schema-datamodel <esquema en HEAD> --to-schema-datamodel prisma/schema.prisma --script` genera el mismo SQL que `20261126100000_entry_groups/migration.sql` (tablas, índices, FK). La migración la aplica el deploy (`prisma migrate deploy`).
- Desviación: `entry_groups.color` tiene por defecto `""`, porque un grupo con un solo miembro todavía no tiene color (el diseño lo asigna al llegar el 2.º miembro).
