# 055 — Cuentas del diario · Verificación

## Tarea 1 · [db] Tabla de colores de cuenta

- **Mecanismo:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` desde producción.
- **Pasos:** migración `20261120200000_account_colors` (`account_colors`: `broker` clave primaria, `color`); modelo `AccountColor`.
- **Resultado:** ✅ esquema válido, cliente generado, build en verde; el diff desde producción es exactamente esta tabla.
- **Est vs Real:** 0.25 SP · 0.15 SP.

## Tarea 2 · [backend] Color de la cuenta en `/balances`

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `GET /balances` añade `color` (`''` si no tiene) con un solo `accountColor.findMany`; `PATCH /balances/color` (`parseAccountColor`: broker no vacío, color texto de 20 caracteres como mucho; vacío borra la fila, si no upsert); `balances.test.ts`.
- **Resultado:** ✅ 214 tests en verde, typecheck, build y lint limpios.
- **Est vs Real:** 0.75 SP · 0.25 SP.
