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

## Tarea 3 · [frontend] Distintivo de color de la cuenta

- **Mecanismo:** `npm run build` + eslint; prueba local contra el API de producción (tras el despliegue del backend).
- **Pasos:** `ColorBadge.tsx` exporta `ColorSwatchButton` (el círculo, `nextColor`, cambio optimista, vuelta atrás y aviso; un doble clic sobre él ya no llega a la fila) y mantiene `ColorBadge` para posiciones/órdenes encima de él; `Accounts` conserva `color` de `/balances` (también con los mensajes `account` en vivo), guarda con `PATCH /balances/color` y muestra el círculo en la segunda columna, junto al nombre de la cuenta, como Positions junto al símbolo y junto al resumen en la tarjeta del móvil. Espaciado ajustado con el operador.
- **Resultado:** ✅ build y lint limpios; el operador comprobó el cambio de color, la recarga y la maquetación.
- **Est vs Real:** 1 SP · 0.5 SP.
