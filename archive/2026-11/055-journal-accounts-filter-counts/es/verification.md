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

## Tarea 4 · [frontend] Trades / Orders por cuenta

- **Mecanismo:** `npm run build` + eslint; prueba local contra el API de producción.
- **Pasos:** `Accounts` cuenta, con `useLivePositions()`, las posiciones de mercado y las órdenes pendientes de cada broker, sin los símbolos ocultos (`isVisible`); columna "Trades / Orders" en escritorio tras Number, ordenable por posiciones, con la cabecera acortada a "Tr. / Or." a petición del operador; `AccountCard` la muestra en lugar de Number, y Number abre los detalles desplegados.
- **Resultado:** ✅ build y lint limpios; el operador comprobó los contadores contra Positions y Orders.
- **Est vs Real:** 1 SP · 0.35 SP.

## Tarea 5 · [frontend] Filtros de cuentas

- **Mecanismo:** `npm run build` + eslint; prueba local contra el API de producción.
- **Pasos:** `FiltersPanel` recibe `fields` (por defecto igual que antes) y un campo de texto `name`; `JournalPage` muestra el botón Filters en todas las pestañas, guarda `journal.accountFilters` (`broker`, `name`, `color`) en `localStorage` y abre el mismo panel para Accounts con Broker, Name y Color; `Accounts` filtra (broker exacto, nombre que contiene el texto sin distinguir mayúsculas, color exacto), informa de las opciones de broker y color y dice "No accounts match the filters". Acordado con el operador: Name añadido al panel, como campo de texto que filtra mientras se escribe.
- **Resultado:** ✅ build y lint limpios; el operador comprobó los filtros.
- **Est vs Real:** 1 SP · 0.5 SP.

## Tarea 6 · [docs] Documentación de arquitectura

- **Mecanismo:** revisión manual del diff.
- **Pasos:** `backend/docs/architecture.md` (`/balances` con `PATCH /color`, tabla `account_colors`); `.claude/CLAUDE.md` (modelo `AccountColor`).
- **Resultado:** ✅ los dos documentos coinciden.
- **Est vs Real:** 0.25 SP · 0.1 SP.

## Cambios acordados durante la prueba en producción (tarea 7)

- Tarjetas del móvil: mismas columnas en todas, los nombres largos de broker pasan de línea dentro de su columna, la tarjeta nunca es más ancha que la pantalla, menos margen a la izquierda (`f597e51`).
- Filtro Name: campo de texto sin la flecha de desplegable (`38aa1cc`).
- AC 10: filtro de varios colores en Accounts, Positions y Orders (`ColorFilterField`, `utils/colorFilter.ts`; el filtro conserva su forma de texto como "orange,blue", así los filtros guardados siguen valiendo).

## Tarea 7 · [infra] Despliegue y validación en producción

- **Pushes (20-nov-2026):** backend + db `cb306dd` + `ae57ab7` (tareas 1–2); frontend `139b009`…`aeadb4b` (tareas 3–5); después, a petición del operador, la documentación `7a207c3` con los arreglos `f597e51` y `38aa1cc` en un solo push (los dos pipelines), y `777bde4` (filtro de varios colores) solo.
- **Validación del operador en `amfxtrading.com`, escritorio y móvil:** colores de cuenta, filtros Broker / Name / varios colores, Tr. / Or. contra Positions y Orders, tarjetas del móvil alineadas, distintivos y filtros de posiciones y órdenes.
- **Resultado:** ✅ AC 1–10.
- **Est vs Real:** 0.5 SP · 0.75 SP (los arreglos de las tarjetas del móvil y el filtro de varios colores se añadieron durante la prueba).

## Tarea 8 · [specs] Cierre

- **Est vs Real:** 0.25 SP · 0.25 SP.

## Est vs Real

| Tarea | Est | Real |
|---|---|---|
| 1 | 0.25 | 0.15 |
| 2 | 0.75 | 0.25 |
| 3 | 1 | 0.5 |
| 4 | 1 | 0.35 |
| 5 | 1 | 0.5 |
| 6 | 0.25 | 0.1 |
| 7 | 0.5 | 0.75 |
| 8 | 0.25 | 0.25 |
| **Total** | **5** | **2.85** |

Calibración: las tareas pequeñas de frontend sobre componentes existentes costaron cerca de la mitad de lo estimado; la validación llevó más de lo previsto porque la maquetación se ajustó en el móvil con el operador.
