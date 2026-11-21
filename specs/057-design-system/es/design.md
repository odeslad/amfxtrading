# 057 — Sistema de diseño · Diseño

## Enfoque

1. Fijar los tokens (`styles/variables.css`) para que cada valor que necesitan los componentes exista una sola vez.
2. Construir los componentes en `shared/ui/`, una carpeta por componente (`Button/Button.tsx` + `Button.module.css` + `index.ts`), funcionales, con tipos estrictos, named exports y CSS Modules que solo usan tokens. Sin dependencias nuevas.
3. Migrar Settings pestaña a pestaña; el módulo CSS de cada pestaña pierde toda regla que ya cubra un componente.
4. Las demás pantallas (diario, stats, libro, gráfico, dashboard, login, marco de la app) se migran en specs posteriores, una por pantalla, solo con este conjunto.

La variante unificada de cada componente es la marcada con ★ en la maqueta aprobada; todas las decisiones de abajo salen de ella.

## Tokens (`styles/variables.css`)

| Cambio | Hoy | Después |
|---|---|---|
| Texto secundario | `--muted` #666 (3,4:1 sobre --surface) | `--muted` **#8a8a8a**; nuevo `--disabled` #666 |
| Placeholder | #333 / #444 / #666 | `--placeholder` #444 |
| Tintes | 13 valores de alfa | `--tint-orange` rgba(245,166,35,.15) · `--tint-green` rgba(76,175,132,.15) · `--tint-red` rgba(224,92,92,.15) · `--tint-blue` rgba(58,123,213,.18) · `--tint-hover` rgba(255,255,255,.03) · `--tint-selected` rgba(245,166,35,.08) · `--tint-warning` rgba(200,168,64,.08) · `--tint-error` rgba(224,92,92,.08) |
| Fondo de capa | .5 / .6 | `--backdrop` rgba(0,0,0,.5) |
| Alturas | 20…48 (10 valores) | `--h-sm` 27px · `--h-md` 34px · `--h-lg` 48px · `--h-touch` 44px |
| Desactivado | opacidad .3/.35/.4/.5 | `--disabled-opacity` .4 + `cursor: not-allowed` |
| Foco | ninguno en botones/toggle | `--focus-ring` 1px solid var(--orange), separación 2px, en `:focus-visible` de todo control |
| Ancho de panel | 320/340/380/420 | `--panel-w` 320px · `--panel-w-wide` 420px |
| Sombra | solo el menú contextual | `--shadow-menu` 0 8px 24px rgba(0,0,0,.5) para Menu y Popover |
| `--text-3xl` | 24px (CLAUDE.md dice 28) | se queda en 24px; se corrige CLAUDE.md |

Los valores fuera de escala (7px, 15px, 22px, peso 600, #555, #121212, rgba .2/.5/.6) desaparecen al migrar cada pantalla.

## Componentes (`shared/ui/`)

Los valores son los de la variante ★ de la maqueta.

| Componente | Especificación unificada | Props (principales) |
|---|---|---|
| **Tabs** | padding 12px 24px; 10px 0.2em mayúsculas; `--muted`, hover `--text`; activa `--blue` + subrayado 2px. Móvil: flex 1, 12px 4px, 13px 0.06em, activa con fondo `--tint-blue`. Etiqueta larga/corta. Hueco a la derecha para acciones de página. | `tabs: {id, label, shortLabel?}[]`, `active`, `onChange`, `actions?` |
| **Section** | panel con borde: `--surface`, 1px `--border`; cabecera 12px 16px + borde inferior; título 9px 0.12em mayúsculas `--muted`; descripción opcional 11px, acciones a la derecha | `title`, `description?`, `actions?`, `children` |
| **Row** | flex space-between, gap 16px, padding 12px 0, borde inferior; etiqueta 11px 0.06em; ayuda 9px `--muted` mt 4px. Móvil: apilada, gap 6px (`inline` la mantiene en fila) | `label`, `hint?`, `inline?`, `children` |
| **Card** | 10px 12px, 1px `--border`, `--surface`; título + acciones; `accent` (izquierda 3px verde/rojo/oro) y `expandable` (tarjeta de lista móvil: resumen 10px 5px, borde superior .18, 2px azul a la izquierda al abrirse, campos mono 16px) | `title?`, `actions?`, `accent?`, `expandable?` |
| **Toolbar** | flex space-between, gap 8px; botones `sm`; en móvil a todo el ancho | `start`, `end` |
| **FieldLabel** | 9px 0.12em mayúsculas `--muted`; campo en columna con gap 6px | `htmlFor`, `children` |
| **Select** | alto 27 (`sm`) o 34 (`md`); `--bg`, 1px `--border-bright`, mono 11px; flecha propia a 10px; foco con borde `--orange`. Móvil 44px, 16px | props nativas de `select` + `size` |
| **TextInput** | misma caja que Select, padding 0 10px, placeholder `--placeholder`; `invalid` → borde rojo | props nativas + `size`, `invalid?` |
| **NumberInput** | TextInput sin flechas, alineado a la derecha, unidad opcional (mono 11px `--muted`, ml 6px) | + `unit?` |
| **DateInput** | el `DateField` + `Calendar` actuales con estos tokens (icono 36px, seleccionado naranja, hoy azul, hoja en móvil) | sin cambios |
| **Toggle** | pista 36×20 r10, apagado `--border-bright`, encendido `--orange`; botón 14px blanco; anillo de foco | `checked`, `onChange`, `disabled?`, `label` |
| **Checkbox** | nativo, `accent-color: --orange`, 16px (móvil 22px), etiqueta 11px gap 8px | props nativas + `label` |
| **Segmented** | unido, 1px `--border-bright`; botones min-w 52px, 0 10px, mono 10px `--muted`; activo `--orange` + #000; `tone` para compra/venta (relleno verde/rojo) | `options`, `value`, `onChange`, `size`, `tone?` |
| **ColorPicker** | muestra 28px r2 (móvil 44) + popover `--surface2` rejilla 4×20px; celda activa con borde blanco | `value`, `onChange`, `palette?` |
| **Button** | tamaños sm 27/0 10px/9px · md 34/0 14px/11px · lg 48/ancho completo/13px; 0.12em mayúsculas, radio 0. Variantes primary · buy · sell · outlined (hover texto+borde `--text`) · buy-outline · edit (borde naranja) · danger-outline · ghost · dashed; hover de las de borde = tinte .15 | `variant`, `size`, props nativas |
| **IconButton** | 27px (móvil 44), transparente, 1px `--border-bright`, `--muted` → `--text`; variante `bare` (× de cerrar panel, sin borde); `aria-label` obligatorio | `icon`, `label`, `variant?`, `tone?` |
| **Chip** | alto 27, 0 10px, r2, mono 11px `--muted`, 1px `--border-bright`; activo: texto/borde `--orange` + `--tint-selected`; `removable` (×), `locked` (borde oro) | `selected?`, `onRemove?`, `locked?` |
| **Table** | th 9px 0.3em mayúsculas `--muted`, padding 0 12px 8px; td 8px 12px; primera columna sin sangría; hover de fila `--tint-hover`; columnas numéricas a la derecha; acciones de fila al pasar el ratón (fondo `--bg`, 0.18s). ≤768: cada fila se pinta como Card desplegable | `columns` (key, label, align, sortable, render), `rows`, `rowActions?`, `card?` |
| **SortableHeader** | dentro de Table; flecha 9px (antes 7px) | vía `columns.sortable` |
| **Pager** | 10px 16px, borde superior; botones outlined sm (`--muted`); info mono 11px; móvil 44px | `page`, `pages`, `onChange`, `info` |
| **Badge** | 2px 8px, 9px 0.12em mayúsculas, borde 1px; tonos verde/gris/oro/rojo/azul | `tone`, `children` |
| **StatusDot** | 8px; ok/off/ocupado (pulso 0.7s)/gris; `attention` 5px naranja | `state` |
| **ProgressBar** | 3px, pista `--border`, relleno `--orange` (tono para medidores), ancho 0.2s | `value`, `tone?` |
| **Gauge** | `--surface`, padding 16px, etiqueta 9px 0.2em → 0.12em, valor mono 20px + unidad 12px, barra 4px por umbral | `label`, `value`, `unit`, `tone` |
| **StatTile / StatStrip** | tira `--surface` borde 1px 12px 0; cifra 0 20px, divisor a la izquierda; etiqueta 9px; valor mono 16px (`big` 20px). Bloque en rejilla en móvil; neto 24px (antes 22) | `label`, `value`, `tone?`, `big?` |
| **Legend** | mono 11px `--muted` 0.06em; elementos clicables `--orange`; muestra 10×2 | `items` |
| **EmptyState** | 40px 0, centrado, 11px `--muted` 0.06em | `children` |
| **Loading** | caja de EmptyState sobre `--surface`, mono 11px "Loading…" (sin spinner, como hoy) | `label?` |
| **SidePanel** | el armazón de panel copiado en 8 archivos: fijo a la derecha, `--panel-w`, `--surface`, borde izquierdo .18, deslizamiento 0.2s; cabecera 16px 20px, título 10px 0.3em; cuerpo gap 16px padding 20px; pie; fondo `--backdrop`. Móvil: ancho completo desde la barra superior (40px); modo `docked` = el DockedPanel actual (hoja de 50dvh) | `open`, `title`, `onClose`, `width?`, `docked?`, `footer?` |
| **ConfirmDialog** | SidePanel + descripción mono 14px + botones lg (confirmar rojo / cancelar outlined). Sustituye al modal del diario | `title`, `description`, `confirmLabel`, `tone`, `onConfirm`, `onCancel` |
| **Menu / Popover** | `--surface2`, 1px `--border-bright`, padding 4px 0, `--shadow-menu`; elemento 7px 12px, sans 11px, hover .06; título mono 10px; secciones con borde superior; tonos buy/sell/danger; en móvil elemento de 44px | `items`, `anchor` |
| **FilterPanel** | SidePanel + FieldLabel/campos md + botón de reset; variante en línea para Stats | composición |
| **Toast** | el `Toaster` actual pasa a `shared/ui`, sin cambios | — |
| **Hint** | 11px `--muted`; tonos aviso (oro) y error (rojo); `boxed` (borde 1px + tinte, 12px) | `tone?`, `boxed?` |

Las piezas del marco de la app (barra superior, menú lateral, navegación inferior, pie) siguen en `app/layout`; solo pasan a los tokens nuevos cuando se migre su pantalla.

## Migración de Settings (esta spec)

| Pestaña | Archivos | Componentes a los que pasa |
|---|---|---|
| Página | SettingsPage.tsx | Tabs (+ hueco de acciones para Save), EmptyState |
| Mirror | MirrorTab, QuickOrdersSection | Chip (presets), Table, Select, NumberInput, Toggle, Segmented, Section, Button |
| Display | DisplayTab, MaTemplatesSection | Section, Row, Select, NumberInput, ColorPicker, Toggle, Segmented, Card, Button, Hint |
| Notifications | NotificationsTab, NotificationPanel, DevicesPanel | Table (+tarjetas), Badge, SidePanel, Segmented, Chip, DateInput, Button, Hint |
| Visibility | VisibilityTab, SymbolsPanel | Table, Toggle, Chip (activo / bloqueado), SidePanel, Badge, Button |
| Data | DataSyncTab | Section (acento por estado), Table, Checkbox, NumberInput, ProgressBar, StatusDot, Button |
| Server | ServerTab, ServerCharts | Gauge, Section, Table, Badge, StatusDot, Segmented (24h/7d), Legend, Loading, IconButton |

Se queda como CSS local: el lienzo y el redimensionador de las gráficas del servidor y las rejillas propias de una pestaña. Los botones Save, los endpoints y los valores no cambian.

## Archivos

- `frontend/src/styles/variables.css` — los tokens de arriba.
- `frontend/src/shared/ui/<Componente>/` — componentes nuevos; `shared/ui/index.ts` los reexporta.
- `frontend/src/shared/ui/DateField`, `Calendar`, `DockedPanel` — reestilados / integrados en SidePanel.
- `frontend/src/components/Toaster.*` → `shared/ui/Toast/`.
- `frontend/src/features/settings/*` — migrados; los módulos CSS se reducen a la maquetación local.
- `.claude/CLAUDE.md` — sección del sistema de diseño actualizada (tokens, componentes, `--text-3xl` 24px).

## Riesgos

- `--muted` pasa de #666 a #8a8a8a en toda la app a la vez, también en pantallas aún sin migrar: el texto secundario se aclara en todas partes. Es lo buscado (legibilidad), pero se ve fuera de Settings.
- Los componentes compartidos que usan pantallas aún sin migrar (`DateField`, `DockedPanel`, `Toaster`) conservan su API para que esas pantallas sigan funcionando.
- Regresiones visuales dentro de Settings: se revisan pestaña a pestaña contra la maqueta y en producción antes de cerrar.

## Maqueta

Aprobada: https://claude.ai/artifact/8CZHLrWp7VP8SpaQWXXLJx (★ = variante unificada)

1. Tokens, pestañas, botones
2. Campos, opciones, chips
3. Datos
4. Estructura, paneles, menús, avisos
5. Móvil
