# 063 — Configuraciones de split · Diseño

> Status: **approved**

## Enfoque

Una configuración de split es una fila por usuario con un nombre y el broker, el par y la temporalidad de cada gráfico. Settings edita la lista entera y se guarda solo, como el resto de Settings (spec 058). El gráfico lee la lista, la mantiene al día por el WebSocket y aplica una configuración a través del estado del split que ya existe (specs 036 y 060). El EA no interviene y su contrato no cambia.

### Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **A. Tabla y ruta propias, `PUT` de la lista entera (elegida)** | Por usuario como las plantillas de medias; el guardado automático envía un solo cuerpo, como los mirror presets; son pocas, así que sustituir la lista es barato | Un router más |
| B. Una columna JSON en `settings_display` | Sin tabla nueva | `settings_display` es una sola fila global, no por usuario (AC 10) |
| C. Rutas por configuración (`POST`/`PUT /:id`/`DELETE`) | Más granular | El guardado automático tendría que calcular diferencias y encadenar llamadas; más código para 2–3 filas |

## Flujo de datos

```
Settings › Display (guardado automático 800 ms) → PUT /split-layouts [ …lista entera ] → transacción: sustituye las filas del usuario
  → WS { type: "split_layouts" } a los clientes del usuario → recargan GET /split-layouts
Gráfico (escritorio) → GET /split-layouts + WS → el panel lista las configuraciones
  elegir → izquierdo: setBroker / setSymbol / setTimeframe; split: { on, rightTimeframe, linked, rightBroker, rightSymbol }
```

## Cambios por capa

### [db]
Migración a mano `split_layouts`:

```prisma
model SplitLayout {
  id             Int      @id @default(autoincrement())
  userId         Int
  user           User     @relation(fields: [userId], references: [id])
  name           String
  position       Int      @default(0)
  leftBroker     String
  leftSymbol     String
  leftTimeframe  String
  rightBroker    String
  rightSymbol    String
  rightTimeframe String
  updatedAt      DateTime @default(now()) @updatedAt

  @@unique([userId, name])
  @@index([userId])
  @@map("split_layouts")
}
```

Columnas con tipo en lugar de JSON: seis campos fijos, validados en un solo sitio.

### [backend]
- `routes/split-layouts.ts` (nuevo, `requireAuth`):
  - `GET /split-layouts` devuelve las configuraciones del usuario por `position`: `[{ id, name, left: { broker, symbol, timeframe }, right: { … } }]`.
  - `PUT /split-layouts` recibe la lista entera y la sustituye en una transacción, conservando los ids que recibe. Después difunde `split_layouts` al usuario y responde con la lista guardada, para que las filas nuevas reciban su id.
- `parseLayouts` (exportado, con tests): array de 20 como máximo; nombre recortado, de 1 a 40 caracteres y único en la lista; broker de `config.brokers`; símbolo no vacío; temporalidad entre M1 · M5 · M15 · M30 · H1 · H4 · D1. Cualquier otra cosa es un 400.
- `ws.ts`: `broadcastSplitLayouts(userId)` → `sendToUser(userId, 'split_layouts', {})`, como `ma_templates`.
- `app.ts` / `index.ts`: montar el router y conectar la difusión.

### [frontend]
- `lib/useSplitLayouts.ts`: carga `GET /split-layouts` y recarga con el mensaje WS `split_layouts`, como `useMaTemplates`.
- `features/settings/SplitLayoutsSection.tsx` en Settings › Display, construido como Mirror presets con `shared/ui`:
  - `Section` con título y descripción;
  - una barra con el `Select` Layout, el `TextInput` Name y los botones **+ New** / **Delete**;
  - una `Table` con las filas Left y Right y columnas `Select` de Broker, Pair y Timeframe, que en móvil se muestran como tarjetas.
  - El guardado usa su propio `useAutosave`, unido al estado de la página con `combineSaves`. Los pares de cada broker salen de los símbolos por broker que ya carga Settings › Visibility.
- `features/chart/SplitLayoutsPanel.tsx`: un panel a la derecha como los demás paneles del gráfico.
  - Cada configuración muestra I/D `broker · par · temporalidad` y "linked" o "unlinked".
  - La que coincide con lo que muestran los gráficos se marca **Active** (AC 7). Una con un broker oculto o un par apagado (`isVisible` de `lib/visibility`) se marca **Unavailable**, con el motivo, y queda desactivada (AC 8).
  - Sin configuraciones muestra el estado vacío y un enlace a `/settings` (AC 4).
- `ChartToolbar`: un `IconButton` de configuraciones de split en la barra del gráfico izquierdo, solo en escritorio (AC 3).
- `ChartPage`: `applySplitLayout(layout)` fija el broker, el par y la temporalidad del izquierdo, y luego `setSplit(prev => ({ ...prev, on: true, rightTimeframe, linked, rightBroker, rightSymbol, leftTimeframe: undefined, leftBroker: undefined, leftSymbol: undefined }))`. `linked` es true cuando los dos lados comparten broker y par (AC 6). El ancho (`ratio`) no se toca (AC 5).

Sin dependencias nuevas.

## Archivos a tocar
- db: `backend/prisma/schema.prisma` (+ `User.splitLayouts`), `backend/prisma/migrations/<nueva>/migration.sql`
- backend: `src/routes/split-layouts.ts` (+ test), `src/app.ts`, `src/index.ts`, `src/ws/ws.ts`
- frontend: `lib/useSplitLayouts.ts`, `features/settings/SplitLayoutsSection.tsx` (+ módulo CSS), `features/settings/SettingsPage.tsx`, `features/chart/SplitLayoutsPanel.tsx` (+ módulo CSS), `features/chart/ChartToolbar.tsx`, `features/chart/ChartSlot.tsx`, `features/chart/ChartPage.tsx`
- docs: `.claude/CLAUDE.md` y `backend/docs/architecture.md` (ruta, mensaje WS, modelo)

## Riesgos
- **Aplicar una configuración mientras carga la lista de pares de un broker nuevo:** el efecto que recarga los pares de un broker conserva el par actual si el broker lo ofrece; es el mismo camino que el arreglo del cierre del split (`649e210`).
- **Dos pestañas editando Settings a la vez:** gana el último guardado, como con los mirror presets.
- **Un broker eliminado de `brokers.json`:** sus configuraciones no pasan la validación en el siguiente guardado hasta que se editan; el gráfico las marca Unavailable.

## Maqueta
Aprobada el 2026-11-26: https://claude.ai/artifact/Wsp2E2eh8eZB8Rkw8Kcs2b
- `Main` — gráfico (escritorio): el botón de configuraciones en la barra izquierda y el panel derecho con una configuración activa, una normal y una no disponible.
- `PanelEmpty` — el panel sin configuraciones.
- `Settings` — Settings › Display › Split layouts, con el patrón de Mirror presets (Layout, Name, + New, Delete, tabla Left/Right × Broker/Pair/Timeframe, guardado automático).
- `SettingsMobile` — lo mismo en móvil, una tarjeta por gráfico.
