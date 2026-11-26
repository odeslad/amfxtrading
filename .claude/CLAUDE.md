# CLAUDE.md — AMFX Trading · Directrices del proyecto

## Estructura del proyecto

Este proyecto es un **monorrepo** dividido en tres capas bien diferenciadas:

```
amfxtrading/
├── ea/          # Expert Advisor (lógica de trading automatizado)
├── backend/     # API, lógica de negocio, conexión a BD (incluye prisma/ = capa db)
├── frontend/    # Interfaz de usuario (React + TypeScript)
├── infra/       # Scripts del VPS (startup, watchdog); pipelines en .github/
├── specs/       # Specs ACTIVAS: specs/NNN-<slug>/{en,es}/
├── archive/     # Specs cerradas, por mes de cierre: archive/YYYY-MM/NNN-<slug>/
├── epics/       # Ideas exploradas con /epic-explore antes de partirlas en specs (trading-engine/ = diseño del engine, no implementado)
└── reports/     # Auditorías de código (/amfx-code-audit)
```

Cada capa es independiente. **No se mezclan responsabilidades entre capas.**

---

## Fases de desarrollo

El proyecto se construye en fases estrictas. **No se avanza a la siguiente fase sin completar la anterior.**

### Fase 1 — EA (Expert Advisor)
- Basado en la arquitectura del EA de `amfxtrading` (v1)
- Lógica de trading: señales de entrada/salida, gestión de riesgo, ejecución de órdenes
- El EA es la fuente de verdad de las operaciones

### Fase 2 — Comunicación EA ↔ Backend + BD
- Definir el contrato de comunicación entre el EA y el backend
- El backend expone endpoints que el EA consume
- La BD persiste el estado necesario (trades, posiciones, configuración)
- El esquema de BD se diseña en función de lo que el EA necesita reportar

### Fase 3 — Frontend + UX/UI
- Consume el backend para mostrar el estado del EA al usuario
- Buena UX/UI: claridad, rendimiento, feedback en tiempo real donde sea necesario
- No se diseña el frontend hasta que el contrato backend/EA esté estabilizado

---

## Reglas de trabajo

### Toma de decisiones
- **El usuario decide la arquitectura**, no Claude
- Claude propone opciones con pros/contras cuando hay ambigüedad
- Claude espera confirmación antes de implementar cualquier cosa no trivial

### Cambios entre capas
- Cualquier cambio que afecte a más de una capa se comunica antes de implementar
- Si un cambio en el backend rompe el contrato con el EA, se avisa explícitamente

### No hacer sin permiso
- No añadir dependencias sin proponerlo primero
- No ampliar el stack más allá del necesario
- No crear abstracciones prematuras
- No mezclar código de distintas fases en el mismo commit

---

## Workflow spec-driven (skills en `.claude/skills/`)

Todo cambio no trivial pasa por una spec. Sin sprints ni dailies: el ciclo es spec → implementación → despliegue → validación en producción → cierre.

1. `/epic-explore <idea>` (global) — explorar una idea hasta un `epics/<slug>/concept.md` con specs candidatas.
2. `/amfx-spec-new` — crear `specs/NNN-<slug>/` (requirements → design → tasks, con aprobación por documento). Cada tarea nombra su capa `[backend]`/`[frontend]`/`[ea]`/`[db]`/`[infra]`, su mecanismo de verificación y su estimación (1 SP = 1 h senior).
3. `/amfx-implement` — implementar tarea a tarea en `master`: verificar → registrar en `verification.md` → commit atómico con scope de capa (`feat(backend):`) y `Spec: NNN-<slug> (task n)` en el cuerpo → checkpoint con el usuario. Nunca push sin preguntar. La última tarea cierra la spec: Est vs Actual, `Status: closed`, `git mv` a `archive/YYYY-MM/`.
4. `/amfx-status` — tabla de specs activas (fase, tareas, verificación, capas).
5. `/amfx-branch-review <rama | rango | NNN>` — revisión de solo lectura contra `master` y contra la spec.
6. `/amfx-code-audit <backend | frontend | ea>` — auditoría de solo lectura → dos informes en `reports/`.

**Espejo de idiomas**: `en/` (fuente de trabajo) y `es/` contienen siempre los mismos documentos; cualquier cambio en uno actualiza el otro en el mismo commit.

**Gate de cierre = producción**: la penúltima tarea es siempre la validación del usuario en la app desplegada (backend primero; frontend solo cuando el usuario lo pida; EA a mano).

---

## Stack base (provisional hasta confirmar por fase)

- **Frontend:** React + TypeScript + Vite + CSS Modules
- **Backend:** Node.js + servidor dedicado (VPS Windows)
- **BD:** PostgreSQL en el propio VPS Windows
- **EA:** basado en arquitectura v1 de `amfxtrading`, ejecutándose en el VPS
- **Auth:** JWT + HttpOnly cookies

## Despliegue e infraestructura

Todo el proyecto corre en un **servidor VPS Windows** propio, detrás de **Cloudflare** (proxy + DNS).  
A diferencia del MVP v1 (Vercel Functions + Neon), aquí **no hay servicios externos de hosting**:

| Capa     | Dónde corre         | Notas |
|----------|---------------------|-------|
| EA       | VPS Windows         | proceso Node.js o servicio Windows |
| Backend  | VPS Windows         | servidor Node.js (Express u otro, por confirmar) |
| Frontend | VPS Windows         | build estático servido desde el propio servidor |
| BD       | VPS Windows         | PostgreSQL instalado localmente |
| Proxy    | Cloudflare          | SSL, caché, protección DDoS |

**Control de versiones y despliegue:**
- Repositorio en **GitHub**
- Pipeline: push a `main` → GitHub Actions hace SSH al VPS → `git pull` + build + restart servicios
- Sin intervención manual en el servidor para desplegar

**Implicaciones de arquitectura:**
- El backend es un servidor HTTP persistente (no funciones serverless)
- El EA puede comunicarse con el backend via `localhost` (misma máquina), sin latencia de red
- Las migraciones de BD se ejecutan directamente en el VPS
- El frontend se sirve como ficheros estáticos (Nginx, IIS, o similar — por confirmar)

---

## Sistema de diseño — Bloomberg style dark

**Una única fuente de verdad visual para todo el proyecto.**  
Todos los valores de diseño se definen aquí. No se repiten valores mágicos en los componentes; siempre se usan las variables CSS definidas en esta sección.

### Paleta de colores

```css
/* Fondos */
--bg:        #0d0d0d   /* fondo base de la app */
--surface:   #161616   /* superficie primaria (cards, panels) */
--surface2:  #1e1e1e   /* superficie elevada (inputs, modales) */

/* Bordes */
--border:        rgba(255, 255, 255, 0.08)   /* divisores sutiles */
--border-bright: rgba(255, 255, 255, 0.18)   /* bordes activos/visibles */

/* Texto */
--text:        #e8e8e8   /* texto primario */
--muted:       #8a8a8a   /* texto secundario (5,3:1 sobre --surface) */
--disabled:    #666666   /* deshabilitado */
--placeholder: #444444   /* placeholder de campos */

/* Acentos */
--orange: #f5a623   /* acento principal / brand */
--blue:   #3a7bd5   /* acento secundario / info */

/* Semánticos */
--green:  #4caf84   /* éxito / buy / profit */
--red:    #e05c5c   /* error / sell / loss */
--gold:   #c8a840   /* pendiente / warning */

/* Tintes (fondos de hover, selección y avisos) */
--tint-orange:   rgba(245,166,35,.15)   /* hover de botones con borde naranja */
--tint-green:    rgba(76,175,132,.15)
--tint-red:      rgba(224,92,92,.15)
--tint-blue:     rgba(58,123,213,.18)   /* pestaña activa en móvil */
--tint-hover:    rgba(255,255,255,.03)  /* hover de fila */
--tint-active:   rgba(255,255,255,.06)  /* hover de menú */
--tint-selected: rgba(245,166,35,.08)   /* chip / fila seleccionada */
--tint-warning:  rgba(200,168,64,.08)   /* caja de aviso */
--tint-error:    rgba(224,92,92,.08)    /* caja de error */
--backdrop:      rgba(0,0,0,.5)         /* fondo tras paneles */
--shadow-menu:   0 8px 24px rgba(0,0,0,.5)

/* Medidas y estados */
--h-sm: 27px · --h-md: 34px · --h-lg: 48px · --h-touch: 44px (móvil)
--panel-w: 320px · --panel-w-wide: 420px
--disabled-opacity: .4 (+ cursor: not-allowed)
--focus-ring: 1px solid var(--orange), offset 2px, en :focus-visible de todo control
```

Ningún componente escribe colores, tamaños ni espaciados a mano: todo sale de `frontend/src/styles/variables.css`.

### Tipografía

```css
/* Familias */
--font-mono: 'DM Mono', monospace          /* datos, precios, números */
--font-sans: 'IBM Plex Sans', sans-serif   /* texto UI general */

/* Escala de tamaños */
--text-2xs:  9px    /* labels de formulario, badges */
--text-xs:   10px   /* títulos de sección */
--text-sm:   11px   /* texto UI principal, botones */
--text-base: 12px   /* cuerpo, timestamps */
--text-md:   13px   /* cabeceras de página */
--text-lg:   14px   /* valores de formulario, precios */
--text-xl:   16px   /* precios destacados */
--text-2xl:  20px   /* P&L principal */
--text-3xl:  24px   /* brand / login, P&L grande */

/* Letter-spacing */
--tracking-tight:   0.02em
--tracking-normal:  0.06em
--tracking-wide:    0.12em
--tracking-wider:   0.2em
--tracking-widest:  0.3em
```

### Espaciado

Escala base de 4px. Usar siempre múltiplos:

```
4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px
```

Valores puntuales permitidos para refinado visual: `6px`, `10px`, `14px`.

### Bordes y radios

```
border-width:   1px (estándar) · 2px (activo) · 3px (acento superior en panels)
border-radius:  0px (default) · 2px (elementos pequeños) · 3px (botones, scrollbar) · 50% (dots)
```

El lenguaje visual es **cuadrado**: la mayoría de elementos usan `border-radius: 0` o `2px`.

### Profundidad (z-index)

```
1     base / charts underlay
5     chart legend
10    tooltips, overlays, panels
50    modales
99    navegación móvil
9999  fullscreen / alertas críticas
```

### Botones

| Variante     | Fondo      | Texto     | Borde             | Hover                       |
|--------------|------------|-----------|-------------------|-----------------------------|
| primary      | `--orange` | `#000`    | —                 | `opacity: 0.85`             |
| buy          | `--green`  | `#000`    | —                 | `opacity: 0.85`             |
| sell         | `--red`    | `#fff`    | —                 | `opacity: 0.85`             |
| outlined     | transparent| `--muted` | `--border-bright` | texto → `--text`            |
| buy-outline  | transparent| `--green` | `--green`         | `rgba(76,175,132,0.15)` bg  |
| sell-outline | transparent| `--red`   | `--red`           | `rgba(224,92,92,0.15)` bg   |
| ghost        | transparent| `--muted` | —                 | texto → `--text`            |

**Tamaños:**

| Talla | Height | Font         | Padding  |
|-------|--------|--------------|----------|
| sm    | 27px   | `--text-2xs` | `0 10px` |
| md    | 34px   | `--text-sm`  | `0 14px` |
| lg    | 48px   | `--text-md`  | `0 20px` |

### Inputs

```
background:     var(--bg) o var(--surface2)
border:         1px solid var(--border-bright)
border (focus): 1px solid var(--orange)
color:          var(--text)
font:           var(--text-sm) var(--font-mono)
padding sm:     6px 8px
padding md:     7px 10px
padding lg:     0 16px, height 48px
outline:        none
transition:     border-color 0.12s
placeholder:    #333
```

### Transiciones

```
0.12s ease   → interacciones estándar (color, border, background, opacity)
0.2s ease    → movimientos de panel, slides
0.3s ease    → animaciones lentas, labels de chart
```

### Scrollbar

```css
width: 6px; border-radius: 3px;
thumb:        rgba(255, 255, 255, 0.12)
thumb:hover:  rgba(255, 255, 255, 0.22)
track:        transparent
```

### Breakpoints

```
mobile:  max-width: 768px
tablet:  max-width: 1024px
desktop: min-width: 769px
```

### Indicadores de estado

```
online  → dot 8px --green
offline → dot 8px --red
pending → dot 8px --gold, animación pulse 0.7s infinite
```

### Componentes compartidos (spec 057)

Toda pantalla se construye con `frontend/src/shared/ui` (importar desde `shared/ui`); una pantalla no dibuja controles propios. Si hace falta un tipo de pieza que no existe, se añade aquí como componente nuevo. Catálogo vivo en `/dev/ui` (solo en desarrollo); maqueta de referencia: https://claude.ai/artifact/8CZHLrWp7VP8SpaQWXXLJx

| Grupo | Componentes |
|---|---|
| Estructura | `Tabs` (etiqueta larga/corta, hueco de acciones) · `Section` (título, descripción, acciones, acento superior) · `Row` (etiqueta + control, se apila en móvil) · `Card` / `CardField` / `ExpandableCard` · `Toolbar` · `SelectList` (lista maestra) |
| Campos | `Field` / `FieldLabel` · `TextInput` · `NumberInput` (sin flechas, unidad) · `Select` · `DateInput` / `IsoDateInput` · `Checkbox` · `Toggle` · `Segmented` (tonos compra/venta) · `ColorPicker` · `Chip` (seleccionado, eliminable, bloqueado) |
| Acciones | `Button` (primary, buy, sell, outlined, buyOutline, edit, danger, ghost, dashed · sm/md/lg) · `IconButton` (con borde o sin él · sm/md) · `LinkButton` |
| Datos | `Table` (orden, acciones de fila, tonos, tarjetas en móvil) · `Pager` · `Badge` · `StatusDot` · `ProgressBar` · `Gauge` · `StatTile` / `StatStrip` · `Legend` |
| Capas y avisos | `SidePanel` (normal, ancho, acoplado) · `ConfirmDialog` · `FilterPanel` · `Menu` / `Popover` · `Toaster` · `Hint` (aviso, error, con caja) · `EmptyState` · `Loading` |

Settings ya está migrado; el resto de pantallas (diario, stats, libro, gráfico, dashboard, login) se migran en specs propias.

---

## Arquitectura del backend (Fase 2 — implementada)

Resumen; el detalle vive en `backend/docs/architecture.md` y los dos documentos no deben contradecirse.

### Comunicación EA → Backend

Un `PipeReader` + un `FileWatcher` **por broker**, configurados en `brokers.json` (excluido de git, nunca commitear).

| Canal | Uso | Formato |
|-------|-----|---------|
| Named Pipe `\.\pipe\mt4tick_<broker>` | Ticks (100 ms), posiciones abiertas (1 s), cuenta (1 s) | Una línea JSON por mensaje: array `[...]` = batch de ticks · `{"type":"positions",...}` · `{"type":"account",...}` |
| Archivos `bridge/*.json` (el EA los escribe cada 60 s) | Persistencia; el watcher los lee cada 5 s y salta los que no cambian de `mtime`/tamaño (`history.json` y `account.json` también por contenido, spec 030) | `candles_<SYM>_<TF>.json` → `candles` (solo velas cerradas) · `history.json` → `trades` + `balance_operations` · `account.json` → `balances` (un upsert por broker y día UTC) |
| Archivo `bridge/command.json` | Órdenes backend → EA | `action`, `symbol`, `lots`, `sl`, `tp`, `price`, `magic`, `id` |
| Archivos `bridge/config.json` · `symbols-available.json` | Pares de cada EA (spec 056): el backend reescribe `symbols` desde Settings › Visibility y los EAs (State 3.16+, Commands 2.24+) lo recargan en ~5 s; el EA de estado lista todos los símbolos del broker | `{ brokerName, symbols: "EURUSD,…" }` · `{ symbols: [...] }` |
| Archivos `bridge/sync-command.json` · `sync-status.json` · `sync/<SYM>_<TF>.json` | Sincronización manual de velas (spec 049): backend → EA de órdenes (2.23+), progreso y velas de vuelta | `{ id, timeframes: [{ tf, target }], symbols? }` · `{ id, state, timeframe, symbol, done, total, message }` · `{ brokerOffset, candles }` |

**El backend es SERVER del pipe**; el EA es CLIENT y se conecta al iniciar. Si el `listen` falla se reintenta con backoff (1 s → 30 s). `positions.json` lo escribe el EA pero nadie lo lee: las posiciones solo viven en memoria (`store/positions`) y se emiten por WS, no se persisten.

### Comandos

`POST /commands` escribe `command.json` (como `.tmp` + rename) y responde `202 { status: "pending", id }`. Acciones: `buy` · `sell` · `buylimit` · `selllimit` · `buystop` · `sellstop` · `close` · `modify`. El EA responde con `result.json` → `{ "status", "ticket", "id", "message" }`; mientras `pending.json` lleve el mismo `id` la espera se alarga de 10 s a 30 s. Si expira y `command.json` sigue ahí, el backend lo retira y emite `cancelled`; si no, emite `timeout` y un resultado que llegue en los 60 s siguientes se emite con `late: true`. El resultado siempre llega por WS como `command_result`. Con `lotsMode: "risk_pct"` el backend calcula los lotes desde la distancia al SL (`services/sizing.ts`, solo pares forex) y rechaza con 400/503 cuando no puede. Un `groupId` opcional (solo en aperturas) marca los comandos de un mismo envío mirror: cada resultado `ok` con ticket añade la entrada a ese grupo (spec 062). `modify` lleva `ticket`, `sl`, `tp` y un `price` opcional que el EA (2.22+) aplica solo a órdenes pendientes (las mueve a ese precio); una posición de mercado conserva su precio de apertura.

### WebSocket `/ws`

Upgrade solo con `Origin` permitido y cookie JWT válida; ping cada 30 s; backpressure por `bufferedAmount`. Los `ticks` solo llegan a quien se suscribe (spec 041): el cliente envía `{ type: "subscribe", ticks: [{ broker, symbol }, …] }` (máx. 16 pares; cada frame sustituye el conjunto; lista vacía = sin ticks; frame inválido = se ignora) y recibe solo los ticks de esos pares; el resto de mensajes llegan a todos. Mensajes `{ type, broker, ... }` con el `broker` en la **raíz**, no por item (el front lo inyecta antes de ordenar): `ticks` · `positions` (con bid/ask actual y color) · `account` · `candle` (vela cerrada detectada en el tick por el cambio de `<tf>_time`, guardada al momento sin pisar la del EA, spec 025) · `trades_updated` (el watcher guardó un `history.json` con cambios; Historial y Stats recargan, spec 030) · `candle_sync` (progreso y resultado de una sincronización de velas, spec 049) · `command_result` · `split_layouts` (las configuraciones de split del usuario cambiaron, spec 063; solo a su dueño) · `entry_groups` (todos los grupos de entradas mirror en cada cambio, spec 062) · `alert` · `ema_alert` (los dos últimos solo a su dueño).

### Velas activas y alertas

Las velas activas **no se persisten**: cada tick trae OHLC de todos los TF (`m5_open/high/low`, `h1_time`, …) y el frontend construye la vela en curso; a `candles` solo van las cerradas (`slice(0, -1)`). Al cambiar `<tf>_time` en el tick, el backend guarda la vela que acaba de cerrar desde el último tick (cierre = bid) y la emite como `candle`; el fichero del EA conserva la autoridad porque el watcher hace upsert de sus dos últimas velas cerradas. Las alertas de precio se evalúan en cada tick (cruce del bid con el nivel); las de cruce, al cierre de vela (cambio de `<tf>_time`) cuando la media rápida y la lenta convergen dentro del umbral; cada lado es EMA o SMA (spec 053). Al dispararse: BD + WS + Web Push.

### Sincronización del histórico de velas (spec 049)

La tabla `candles` antigua tenía páginas dañadas: se apartó, `candles` empezó vacía y, sincronizados todos los brokers con EA, la antigua se borró (un broker sin sincronizar empieza vacío). Settings › Data lista cada broker × M5/M15/H1/H4/D1 con velas, objetivo (100 … 50 000, por defecto 10 000), última sincronización y estado en vivo. `POST /candle-sync` deja el encargo al EA de órdenes (2.23+, necesita *Allow DLL imports* por la tecla Inicio que fuerza a MT4 a bajar histórico); el EA trabaja un símbolo × temporalidad por segundo sin retrasar órdenes, y al completar una temporalidad el backend sustituye esa pareja en una transacción (si falla, no se borra nada).

### Pares de cada broker (spec 056)

Settings › Visibility › Pairs elige, por broker, qué cruces de AUD, EUR, NZD, USD, CAD, GBP y JPY envía su EA: activo (se envía y se ve) o apagado (ni se envía ni aparece). Guardar reescribe el `config.json` del EA, que lo recarga solo; un par con posiciones abiertas no se puede apagar. Activar un par sincroniza su histórico solo (Settings › Data muestra la espera, el avance o el error). Sustituye a los símbolos ocultos de la spec 024, que se apagaron una vez en cada `config.json` al desplegar.

### Monitor del servidor (spec 051)

Settings › Server muestra la máquina en la que corre el backend: CPU, memoria, fichero de paginación, disco, servicios (PostgreSQL, nginx, túnel, SSH), backend, terminales por broker, cuelgues de los últimos 30 días (evento 41) y gráficas de CPU/memoria de 24 h o 7 días. `services/server-monitor.ts` lee `os` cada 15 s y ejecuta `backend/scripts/server-probe.ps1` cada minuto (eventos y reinicios de pm2 cada 10 min); una fila por minuto en `server_samples`, 7 días. Detrás de `FEATURE_SERVER_MONITOR`: apagarlo en un backend local, que si no informa del PC y escribe sus muestras en la BD a la que apunta.

### Plantillas de medias móviles (spec 052)

El gráfico dibuja las medias (EMA o SMA) de una plantilla. Cada usuario tiene plantillas con nombre (`ma_templates`) y exactamente una por defecto, que no se puede borrar. Una plantilla se asigna a un broker en todas sus temporalidades o en una (`ma_template_brokers`); un gráfico usa broker + temporalidad, luego broker, luego la de por defecto. Se editan en Settings › Display; el botón de indicadores del gráfico elige la plantilla del broker (opcionalmente solo para su temporalidad) y oculta medias por dispositivo. Cada cambio avisa por WS (`ma_templates`). Las alertas de cruce, las notificaciones, el overlay de operaciones por cruce y los setup levels eligen EMA o SMA en cada lado (`fastType`/`slowType`, por defecto `ema`, spec 053); las tablas y rutas conservan el nombre `ema_*`.

### Menú contextual del gráfico (spec 054)

Clic derecho (pulsación larga de 500 ms en táctil) en el gráfico abre un menú en ese precio: órdenes rápidas (Settings › Mirror › Quick market / orders, una configuración guardada en `settings_display.quickOrders`; siempre con confirmación, mismos comandos que New Trade, uno por broker del mirror preset), Buy/Sell at (New Trade con el tipo limit/stop según el mercado y el precio), New trade, alerta de precio, acciones de la posición u orden bajo el puntero (editar, quitar SL/TP, cerrar/cancelar) y de dibujos (borrar, borrar todos). Sustituye a los botones flotantes del gráfico. New Trade y la edición de posición se acoplan al lado del gráfico (en móvil, hoja inferior de media pantalla).

### Grupos de entradas mirror (spec 062)

Las entradas de un mismo envío mirror (New Trade en modo mirror u orden rápida con mirror preset) forman un grupo con una estrella de color en la columna de broker de Positions y Orders. `store/entry-groups.ts` los guarda en memoria y en `entry_groups` / `entry_group_members`; el color se asigna al 2.º miembro (primero libre de la paleta, si no el menos usado). Un miembro sale al dejar de estar abierto (un `positions` vacío solo cuenta si dura 5 s) y un grupo sin miembros se borra; la estrella solo se ve con 2 o más abiertos. Un grupo nunca mezcla posiciones y órdenes: si unas órdenes de un grupo se ejecutan y otras no, las posiciones pasan al grupo hermano `<id>_f` (otro color, al que se suman las siguientes ejecuciones) y las pendientes conservan el suyo. El frontend propaga: editar SL/TP/precio, quitar SL/TP y cerrar/cancelar una entrada agrupada envía el mismo precio a todas las abiertas; `DELETE /entry-groups/members` saca una del grupo.

### Configuraciones de split (spec 063)

Settings › Display › Split layouts guarda configuraciones con nombre por usuario (`split_layouts`): broker, par y temporalidad del gráfico izquierdo y del derecho, con el patrón de Mirror presets y guardado automático (`PUT /split-layouts` sustituye la lista entera). El botón de la barra del gráfico izquierdo (solo escritorio) abre un panel a la derecha que las aplica y abre el split; los gráficos quedan enlazados si los dos lados comparten broker y par. El ancho entre gráficos no se guarda.

### HTTP y auth

Express con 22 routers (`/auth`, `/commands`, `/trades`, `/positions`, `/entry-groups`, `/split-layouts`, `/balances`, `/settings`, `/symbols`, `/broker-symbols`, `/candles`, `/candle-sync`, `/server`, `/ma-templates`, `/drawings`, `/alerts`, `/ema-alerts`, `/ema-notifications`, `/setup-levels`, `/push`, `/stats`, `/book`) más `GET /health` (sin auth, vitalidad por broker). JWT en cookie HttpOnly `token`; `requireAuth` en todo salvo `/auth` y `/health`. Parámetros validados (400), errores no controlados al handler final (500) sin tumbar el proceso.

### Modelos BD

`Candle` · `CandleSync` (estado de la sincronización manual por broker y temporalidad, spec 049) · `ServerSample` (CPU y memoria del servidor por minuto, 7 días, spec 051) · `MaTemplate` · `MaTemplateBroker` (plantillas de medias y su asignación por broker y temporalidad, spec 052) · `SplitLayout` (configuraciones de split por usuario, spec 063) · `Trade` · `Balance` (snapshot diario por broker y día UTC) · `BalanceOperation` · `MirrorPreset` (presets de mirror con nombre, configuración por broker en JSON, spec 033) · `SettingsDisplay` (display global + `hiddenBrokers`: visibilidad solo visual del frontend, spec 024; `hiddenSymbols` sin uso desde la spec 056; `quickOrders`: órdenes rápidas del menú del gráfico, spec 054) · `PositionColor` · `EntryGroup` · `EntryGroupMember` (grupos de entradas mirror y sus `(broker, ticket)`, spec 062) · `AccountColor` (color por cuenta en Diario › Accounts, independiente del de las posiciones, spec 055) · `User` · `PriceAlert` · `EmaCrossAlert` · `EmaNotification` · `EmaNotificationEvent` (reglas permanentes de cruce de medias configuradas en Settings, spec 023, y sus disparos) · `PushSubscription` · `Drawing` · `BookScheme` · `BookTrade` (libro de esquemas, spec 020: backtest manual del operador, sin vínculo con la operativa). Migraciones SQL escritas a mano en `backend/prisma/migrations/`; `prisma migrate diff` contra producción debe salir vacío.

### Feature flags y entorno

`FEATURE_PIPE` / `FEATURE_WATCHER` / `FEATURE_ALERTS` / `FEATURE_WS_BROADCAST` / `FEATURE_SERVER_MONITOR` se apagan solo con el valor literal `false` (así corre un backend local contra la BD de producción sin tocar los bridges). Variables completas y comentadas en `backend/.env.example`.

### Deploy backend

Pipeline: push `master` en `backend/**` → GitHub Actions (checks) → SCP `deploy.ps1` → SSH VPS → PowerShell: `git pull` → `pm2 delete` → liberar el puerto 3000 (mata huérfanos propios; si el puerto lo ocupa un proceso ajeno, falla explícitamente) → `npm install` → `prisma generate` → `prisma migrate deploy` → build en `dist.next` → swap → `pm2 start` → `/health`. Si algo falla tras el build se restaura el `dist` anterior.

---

## Referencia

El MVP de referencia está en `c:/work/odeslad/amfxtrading`.  
Se consulta para entender la lógica existente, no para copiar su estructura.
