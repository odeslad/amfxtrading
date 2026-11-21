# 058 — Reorganización de Settings · Diseño

## Enfoque

Solo frontend. Settings conserva sus hooks de datos y sus endpoints; lo que cambia es (1) cómo se divide y se navega la pantalla y (2) cuándo se guarda.

1. **Secciones en lugar de pestañas.** `SettingsPage` pasa a ser un armazón: un menú lateral (escritorio) o una lista de secciones (móvil) más la sección elegida. Cada sección es un componente pequeño que compone los bloques de sus subsecciones, que salen de los componentes de pestaña actuales sin cambiar su lógica.
2. **Guardado automático.** Un hook `useAutosave` guarda un valor poco después de su último cambio, valida antes, reintenta a demanda e informa de su estado. Toda zona que guarda lo usa; un indicador de página muestra el estado combinado.
3. **Dos componentes compartidos nuevos** (regla de la spec 057: los tipos nuevos van a `shared/ui`): `NavList` y `SaveStatus`.

## Secciones y de dónde sale cada bloque

| Sección (`?section=`) | Subsecciones (cada una una `Section`) | Sale de |
|---|---|---|
| Trading (`trading`) | Mirror presets · Quick orders · New trade (setup levels) | MirrorTab, QuickOrdersSection, DisplayTab (setup levels) |
| Chart (`chart`) | P&L · Drawings · Price | DisplayTab (General, Drawings, Price) |
| Indicators (`indicators`) | Plantillas de medias · Cross trades (+ etiquetas SL / TP) | MaTemplatesSection, DisplayTab (EMA cross trades) |
| Alerts & notifications (`alerts`) | Rules · Devices | NotificationsTab + NotificationPanel, DevicesPanel (su contenido en línea como subsección) |
| Brokers & data (`brokers`) | Brokers y pares · Candle history | VisibilityTab + SymbolsPanel, DataSyncTab |
| System (`system`) | Server | ServerTab + ServerCharts |

`DisplayTab` se divide en `ChartSettings`, `CrossTradesSettings` y `SetupLevelsSettings`; `DevicesPanel` pasa a `DevicesSection` (mismo hook, en línea, con la caja "Enable this device" y la lista de dispositivos sin cambios). El botón "+ New notification" pasa a la cabecera de la sección Rules.

**Enlaces antiguos:** `?tab=` se traduce a una sección — `mirror → trading`, `display → chart`, `notifications → alerts`, `visibility → brokers`, `data → brokers`, `server → system`. El botón de indicadores del gráfico pasa a `?section=indicators`.

## Navegación

- **Escritorio (> 768 px):** `NavList` vertical, 220 px, `--surface`, elementos 10px 16px, 11px 0.12em mayúsculas `--muted`; el actual `--text`, borde izquierdo 2px `--orange`, fondo `--surface2`, `aria-current="page"`. Contenido: título de la sección (13px 0.2em) + `SaveStatus` a la derecha, y debajo las subsecciones, gap 16px.
- **Móvil (≤ 768 px):** sin `?section` la página muestra `NavList` en modo lista (cada fila: título + resumen de una línea de sus subsecciones, flecha, altura mínima 64px). Con una sección, la página muestra una cabecera con un `IconButton` de volver (a `/settings`), el título y `SaveStatus`, y debajo las subsecciones. El botón atrás del navegador funciona porque la sección va en la URL.

## Guardado automático

```ts
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error';
useAutosave<T>(value: T, opts: { save: (v: T) => Promise<void>; validate?: (v: T) => string | null; delayMs?: number; enabled?: boolean })
  → { state: SaveState; error: string | null; retry: () => void }
```

- Espera 800 ms tras el último cambio; no guarda nada en el primer render (solo cambios reales).
- Un guardado a la vez: un cambio hecho mientras se guarda se guarda justo después, con el último valor (sin escrituras perdidas ni desordenadas).
- Si `validate` devuelve un mensaje → estado `invalid`, sin petición; el campo muestra su propio error como hoy.
- Si falla → estado `error` con el mensaje y `retry()`; el valor sigue en pantalla.
- `saved` vuelve a `idle` a los 3 s.

Usos:

| Zona | Valor | Guardado | Validación |
|---|---|---|---|
| Formulario de settings (presets, órdenes rápidas, display, setup levels, cross trades, visibilidad) | el cuerpo actual de `PUT /settings` | `PUT /settings` (sin cambios); los ids de preset devueltos se mezclan en el formulario sin volver a montar los campos | `quickOrdersError`; nombre de preset vacío |
| Objetivos de velas | `candleSync.edits` | `candleSync.saveTargets` | 100 – 50 000 |
| Plantilla de medias en edición | el borrador | `PUT /ma-templates/:id` | nombre no vacío, periodos ≥ 1 |

Las acciones explícitas siguen siendo botones porque no editan un valor: Save to EA (pares), Sync selected (velas), crear / borrar / poner por defecto (plantillas, presets), crear / editar / pausar / borrar (reglas de notificación, que se guardan desde su panel), activar / quitar (dispositivos). El `SaveStatus` de página muestra el peor estado de los tres guardados automáticos (error > invalid > saving > pending > saved).

**Se quitan:** el Save de Settings, "Unsaved changes", Save targets, "Unsaved targets" y Save template.

## Componentes compartidos nuevos

- `NavList` — `items: { id, label, summary? }[]`, `current`, `onSelect`, `mode: 'menu' | 'list'`; los enlaces son `<a href="?section=…">` para que también se abran en otra pestaña.
- `SaveStatus` — `state`, `error`, `onRetry`; mono 10px: pendiente "Unsaved…" `--muted`, guardando "Saving…" `--muted`, guardado "● Saved" `--green`, no válido "Not saved · fix the highlighted field" `--gold`, error con su mensaje `--red` + Retry (`Button` edit sm). `role="status"`, `aria-live="polite"`.

## Archivos

- `frontend/src/shared/ui/NavList/*`, `SaveStatus/*`, `index.ts` — componentes nuevos.
- `frontend/src/lib/useAutosave.ts` — el hook (+ test unitario si el frontend tiene runner de tests; si no, se comprueba en el catálogo).
- `frontend/src/features/settings/SettingsPage.tsx` — armazón: sección desde la URL, navegación, cabecera, cambio de sección; guardado automático del formulario de settings.
- `frontend/src/features/settings/sections/` — `TradingSection.tsx`, `ChartSection.tsx`, `IndicatorsSection.tsx`, `AlertsSection.tsx`, `BrokersDataSection.tsx`, `SystemSection.tsx`.
- `DisplayTab.tsx` → `ChartSettings.tsx`, `CrossTradesSettings.tsx`, `SetupLevelsSettings.tsx`; `DevicesPanel.tsx` → `DevicesSection.tsx`; `MirrorTab.tsx`, `VisibilityTab.tsx`, `DataSyncTab.tsx` y `MaTemplatesSection.tsx` pierden sus controles de guardado.
- `frontend/src/lib/useCandleSync.ts`, `MaTemplatesSection.tsx` — conectados a `useAutosave`.
- El enlace del botón de indicadores del gráfico (`?tab=display` → `?section=indicators`).
- `frontend/src/dev/UiCatalogPage.tsx` — estados de NavList y SaveStatus.

## Riesgos

- **Frecuencia de escritura:** el guardado automático envía `PUT /settings` más a menudo (uno por pausa al escribir). El cuerpo es pequeño y el endpoint idempotente; la espera de 800 ms lo deja en unos pocos por edición.
- **Ids de preset:** un preset nuevo recibe su id en el primer guardado; el hook mezcla los ids por posición sin sustituir el formulario, así que escribir el nombre nunca pierde el foco.
- **Órdenes rápidas no válidas bloquean todo el guardado de settings** (comparten `PUT /settings`): el indicador dice "Not saved" hasta corregirlas. Se acepta para mantener un único camino de guardado; la alternativa (guardar el resto con las últimas órdenes rápidas válidas) añade estado para poco beneficio.
- **Salir con un cambio pendiente:** un guardado pendiente se envía al desmontar / cambiar de sección, y `beforeunload` avisa solo mientras haya un guardado pendiente o fallido.

## Maqueta

Aprobada: https://claude.ai/artifact/Fa5DxGrdRfDiW8TfzCGJ9Y

1. Escritorio · Trading
2. Escritorio · Brokers & data
3. Estados del guardado automático
4. Móvil · Secciones
5. Móvil · Chart
