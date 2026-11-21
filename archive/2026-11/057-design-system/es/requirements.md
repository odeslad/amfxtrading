# 057 — Sistema de diseño

> Estado: **cerrada**

## Contexto
Settings tiene seis pestañas (Mirror, Display, Notifications, Visibility, Data, Server) y cada bloque dibuja sus propios controles: unas 4 850 líneas en 13 componentes y 11 módulos CSS, con títulos, filas, interruptores, selectores, tablas y botones con estilos repetidos en cada uno. El mismo control se ve distinto de una pestaña a otra. `shared/ui/` solo tiene el calendario, el campo de fecha, el panel acoplado y los iconos. Esta spec crea un único conjunto de componentes compartidos y pasa todas las pestañas actuales a ellos, sin cambiar dónde está nada ni lo que hace. La spec 058 (reorganizar Settings en seis secciones con menú lateral, navegación móvil y guardado automático) viene después y se construye solo con estos componentes.

## Capas afectadas
- frontend

## Historias de usuario
- Como operador, quiero que todo Settings se vea y funcione igual, para reconocer cada control de un vistazo.
- Como desarrollador, quiero un componente por tipo de control, para que un cambio de estilo se haga una sola vez y los ajustes nuevos no necesiten CSS propio.

## Criterios de aceptación
- CA 1. CUANDO se construyen los componentes ENTONCES `shared/ui/` contiene un componente por cada tipo de elemento que Settings usa hoy:
  - **Estructura**: **Tabs** (la barra de pestañas, con sus etiquetas larga y corta), **Section** (bloque con título, descripción y acciones), **Row** (etiqueta a la izquierda, control a la derecha, ayuda opcional), **Card** (elemento enmarcado con título, contenido y acciones; las tarjetas de setup levels, plantillas, reglas, dispositivos y máquina), **Toolbar** (fila de acciones sobre una lista).
  - **Campos**: **Toggle** (interruptor), **Checkbox**, **Segmented** (una opción entre varios botones), **Select**, **TextInput**, **NumberInput** (sin flechas, unidad opcional), **DateInput** (el `DateField` actual con su `Calendar`, con el mismo estilo que los demás campos), **ColorPicker** (muestras de color).
  - **Acciones**: **Button** (las variantes y tamaños del proyecto), **IconButton** (cerrar, editar, borrar, plegar; con `aria-label`), **Chip** (elemento seleccionable o eliminable, como los chips de presets).
  - **Datos**: **Table** (tabla en escritorio, tarjetas en móvil), **Badge** (etiquetas de estado: desactualizado, cuelgues, sin guardar, por defecto), **StatusDot** (online / offline / pendiente), **ProgressBar** (avance de la sincronización), **Gauge** (los medidores de CPU, memoria y disco del servidor).
  - **Estados y capas**: **EmptyState**, **Loading**, **Modal** (fondo + panel, como el de dispositivos), **ConfirmDialog** (confirmar / cancelar), **Sheet** (hoja inferior en móvil), **Popover** y **Menu** (el menú contextual del gráfico, el menú "older" del diario), **Toast** (el `Toaster` actual), **Hint** (texto de ayuda o aviso bajo un control).
  - **Listas y análisis** (diario, stats, libro): **SortableHeader** (columna de tabla que ordena), **Pager**, **FilterPanel** (el panel de filtros del diario, con sus chips y rangos), **StatTile** (un KPI: etiqueta + valor grande), **Legend** (leyenda de gráfica clicable).
  El conjunto cubre todos los tipos de elemento que se usan en la app (settings, diario, stats, libro, gráfico, dashboard, login), para que las pantallas que lo adopten después no necesiten nada nuevo. Cualquier otro tipo que aparezca al migrar se añade a este conjunto, nunca se dibuja dentro de una pantalla.
- CA 2. CUANDO se dibuja cualquier componente ENTONCES usa solo las variables de `styles/variables.css` (ningún color, tamaño o espaciado escrito a mano) y sigue el sistema de diseño de `.claude/CLAUDE.md`.
- CA 3. CUANDO se migran las seis pestañas ENTONCES cada título, fila, interruptor, opción, selector, campo, color, tabla y botón de Settings es uno de esos componentes; los módulos CSS de Settings solo conservan la maquetación que ningún componente cubre (las gráficas del servidor, por ejemplo).
- CA 4. CUANDO el operador usa cualquier pestaña tras la migración ENTONCES muestra los mismos ajustes en el mismo sitio y los guarda exactamente igual que antes (mismos botones Save, mismos endpoints, mismos valores).
- CA 5. CUANDO se abre Settings en un móvil (≤768 px) ENTONCES cada fila apila la etiqueta sobre el control, las tablas pasan a tarjetas y los objetivos táctiles miden al menos 44 px.
- CA 6. CUANDO se usa un control con el teclado ENTONCES es un `button`, `input`, `select` o `label` real, alcanzable con Tab y con el foco visible en `--orange`.

## Fuera de alcance
- Mover ajustes entre pestañas, las seis secciones nuevas, el menú lateral, la navegación móvil y el guardado automático (spec 058).
- Migrar las demás pantallas (diario, stats, libro, gráfico, dashboard, login): una spec posterior por cada una, construida solo con este conjunto.
- Cualquier cambio de backend o de datos.
