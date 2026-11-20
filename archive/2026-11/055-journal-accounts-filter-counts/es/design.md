# 055 — Cuentas del diario · Diseño

## Enfoque
Los colores de cuenta son una tabla nueva pequeña con clave broker, servida junto a los balances. Filtros y contadores son solo frontend: el filtro reutiliza el panel de filtros de Positions y los contadores salen del feed de posiciones en vivo que el diario ya mantiene.

## db
Migración que añade `account_colors (broker TEXT PRIMARY KEY, color TEXT NOT NULL)`; modelo `AccountColor`. Un broker sin fila no tiene color; quitar el color borra la fila. Mismos nombres de paleta que `position_colors` (se guarda la clave del color, p. ej. `orange`).

## backend
`routes/balances.ts`:
- `GET /balances` añade `color` (`''` si no tiene) a cada cuenta, con un solo `accountColor.findMany`.
- `PATCH /balances/color { broker, color }`: `color` vacío borra la fila, si no upsert; `broker` texto no vacío, `color` texto de 20 caracteres como mucho (la paleta vive en el frontend, como en posiciones). `200 { ok: true }`.
Tests del parseo (siguiendo el patrón de los tests de rutas).

## frontend
- **Distintivo de color:** `ColorBadge` recibe su función de guardado en vez de llamar él a `/positions/color` (`onCycle(next) => Promise`), así posiciones y cuentas comparten componente y aspecto. Las cuentas llaman a `PATCH /balances/color`, con cambio optimista, vuelta atrás y aviso, como las posiciones.
- **Contadores:** `Accounts` lee `useLivePositions()` (ya alimentado por `useLivePositionsFeed` en `JournalPage`) y cuenta por broker las posiciones de mercado (`!isPending`) y las órdenes pendientes (`isPending`), sin los símbolos ocultos en Settings › Visibility (`visibleSymbols`). En vivo por construcción.
- **Tabla de escritorio:** una columna de color al principio (el distintivo) y "Trades / Orders" tras Number, ordenable por número de posiciones (columna de `useSort`).
- **Tarjeta del móvil:** el resumen muestra distintivo · Broker · "Trades / Orders" · P&L; Number pasa a los detalles desplegados.
- **Filtros:** `FiltersPanel` recibe una prop opcional `fields` (`['broker', 'color']` para cuentas; por defecto igual que hoy), así el panel, la cabecera, los campos y Clear filters son el mismo componente que Positions. `JournalPage` guarda los filtros de cuentas en `localStorage` (`journal.accountFilters`, `{ broker, color }`), muestra el botón Filters en Accounts con su estado activo y pasa los filtros a `Accounts`. Opciones: brokers = cuentas visibles; colores = los que tiene alguna cuenta, en el orden de la paleta. Resultado vacío: "No accounts match the filters".

## Flujo de datos
Distintivo → `PATCH /balances/color` → `account_colors` → `GET /balances` (al cargar). Contadores: WS `positions` → store de posiciones en vivo → `Accounts`. Sin cambios en el EA.

## Alternativas
- Colores en `settings_display` como mapa JSON: sin tabla nueva, pero el color es de la cuenta y una tabla lo deja consultable y fácil de actualizar. Descartada.
- Contadores desde un endpoint nuevo del backend: duplica lo que el feed en vivo ya da al diario. Descartada.

## Riesgos
- Cambiar `ColorBadge` toca posiciones y órdenes: mismo comportamiento, se comprueba en las pestañas del diario tras el cambio.

## Maqueta
https://claude.ai/artifact/Di4G41MqDMw6Xx8WCsTpL9 — artboards: Desktop · Accounts with colour and Trades / Orders; Desktop · filters panel (same as Positions); Desktop · no account matches; Phone · cards with Trades / Orders.
