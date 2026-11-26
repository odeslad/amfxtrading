# 062 — Grupos de entradas mirror · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | build + diff del esquema | ✅ | 0.75 SP | 0.5 SP |
| 2 | vitest + lint/typecheck/test/build | ✅ | 3 SP | 1.5 SP |

## Tarea 1 — [db] tablas entry_groups
- `npx prisma generate` y `npm run build` (tsc): correctos.
- El túnel local estaba caído, y aplicar la migración a través de él habría tocado producción. En su lugar, `prisma migrate diff --from-schema-datamodel <esquema en HEAD> --to-schema-datamodel prisma/schema.prisma --script` genera el mismo SQL que `20261126100000_entry_groups/migration.sql` (tablas, índices, FK). La migración la aplica el deploy (`prisma migrate deploy`).
- Desviación: `entry_groups.color` tiene por defecto `""`, porque un grupo con un solo miembro todavía no tiene color (el diseño lo asigna al llegar el 2.º miembro).

## Tarea 2 — [backend] store de grupos
- `src/store/entry-groups.ts`: un mapa en memoria persistido a través de un repo (Prisma en producción, en memoria en los tests); las escrituras en BD van en serie.
- `entry-groups.test.ts`: 8 tests ✅ que cubren la paleta (primer color libre, luego el menos usado), el color solo a partir del 2.º miembro, un grupo de uno en formación que se conserva, un grupo con color que se queda con un miembro y se borra, el cierre de uno de tres, la espera de la lista vacía, sacar del grupo, los avisos y la carga tras reinicio.
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ · `npm test`: 234/235. El único fallo es `pipe-reader.test.ts` (un named pipe real, una comprobación de tiempos con la carga de toda la suite); ejecutado solo pasa 2/2 y esta spec no lo toca.
- Ajuste del diseño: "un grupo con menos de 2 miembros se borra" se aplica solo a un grupo que ya tiene color (ha tenido 2 miembros); si no, un grupo se borraría antes de que llegue el resultado de su 2.º broker.
