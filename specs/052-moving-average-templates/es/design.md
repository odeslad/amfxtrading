# 052 — Plantillas de medias móviles por broker · Diseño

## Enfoque

Las plantillas sustituyen a la lista única de EMAs. Una plantilla es una lista con nombre de medias móviles (tipo, periodo, color, estilo, grosor); una plantilla es la de por defecto; cada broker puede tener una asignada. El gráfico resuelve la plantilla de su propio broker (cada lado de la vista partida por separado) y dibuja cada media con su tipo. Las plantillas se crean y editan en una sección «Moving average templates» de Settings › Display (sin pestaña nueva: una spec posterior reorganiza Settings); el botón de indicadores del gráfico elige la plantilla de su broker (la asignación) y muestra u oculta medias en el dispositivo (decidido con el operador sobre la maqueta).

La SMA se dibuja igual que la EMA hoy: calculada sobre las velas cargadas y actualizada en cada tick para la vela en curso.

## Cambios por capa

### db

- `ma_templates`: `id`, `userId` (FK users), `name`, `isDefault` (bool), `averages` (array JSON de `{ id, type: 'ema'|'sma', period, color, style, width }`), `createdAt`, `updatedAt`. Una por defecto por usuario, mantenida por las rutas en una transacción (un índice único parcial impediría que `prisma migrate diff` saliera vacío, porque Prisma 5 no puede expresarlo).
- `ma_template_brokers`: `userId`, `broker`, `templateId` (FK `ma_templates` **on delete cascade**), PK `(userId, broker)`. Un broker sin fila usa la plantilla por defecto; borrar una plantilla borra sus filas, así que sus brokers pasan a la de por defecto (AC 5).
- **Migración de datos en el mismo fichero SQL (AC 6):** por cada fila de `chart_indicators`, se inserta una plantilla por defecto «Default» cuyas medias son sus `emas` con `type: 'ema'` añadido a cada una. Un usuario sin fila recibe una plantilla por defecto vacía en la primera lectura.
- `chart_indicators` se conserva, sin usar, hasta validar la spec (vuelta atrás); la última tarea de código la borra junto con su ruta.

### backend

`src/routes/ma-templates.ts`, detrás de `requireAuth`, todas las consultas limitadas a `req.userId`:

| Ruta | Hace |
|---|---|
| `GET /ma-templates` | `{ templates: [...], assignments: { [broker]: templateId } }`; crea la plantilla por defecto vacía si el usuario no tiene ninguna |
| `POST /ma-templates` | crea `{ name, averages }` |
| `PUT /ma-templates/:id` | renombra y/o sustituye las medias |
| `PUT /ma-templates/:id/default` | la marca como la de por defecto (una transacción) |
| `DELETE /ma-templates/:id` | `409` para la de por defecto; si no, la borra (las asignaciones van en cascada) |
| `PUT /ma-templates/assignments` | `{ broker, templateId \| null }`; `null` borra la fila (por defecto) |

Validación (`400`): nombre de 1 a 40 caracteres; cada media con `type` `ema`/`sma`, `period` entero ≥ 1 (AC 10, igual que las EMAs de hoy, sin límite superior ni de número), `color` `#rrggbb`, `style` `solid`/`dashed`/`dotted`, `width` 1–3, `id` cadena no vacía y única en la plantilla.

Tras cada escritura el backend envía `{ type: 'ma_templates' }` por el WebSocket a los clientes del usuario; los gráficos abiertos y la pestaña de Settings recargan (AC 7).

### frontend

- `src/lib/useMaTemplates.ts`: carga `/ma-templates`, recarga con el mensaje WS `ma_templates`, expone `templateFor(broker)` (la asignada, si no la de por defecto) y las llamadas de escritura.
- Tipo `Ema` → `MovingAverage` con `type: 'ema' | 'sma'`.
- `LightweightChart.tsx`: junto a `calcEma` aparece `calcSma` (suma móvil sobre `period` cierres); la actualización en vivo de la vela en curso usa el tipo de cada media (EMA: un paso desde el valor anterior; SMA: la suma móvil con el cierre actual en lugar del último).
- `ChartPage` / `ChartSlot`: cada lado dibuja `templateFor(slot.broker)` menos las medias ocultas en este dispositivo (AC 2, 3, 8). Desaparecen la carga y el guardado de `/chart-indicators`.
- `IndicatorsPanel.tsx` (el botón de indicadores del gráfico): un selector «Template for <broker>» con todas las plantillas y «Default» — al cambiarlo llama a `PUT /ma-templates/assignments` para ese broker; debajo, las medias de la plantilla (tipo, periodo, muestra de color) con un interruptor de mostrar/ocultar cada una, y un enlace «Edit in Settings › Display» (AC 9). Los ids ocultos se guardan por dispositivo en `localStorage` (`chart.maHidden`).
- `src/features/settings/MaTemplatesSection.tsx` + `.module.css` (AC 4, 5, 11), al final de `DisplayTab`, como en la maqueta: lista de plantillas (nombre, estrella de por defecto, número de medias, brokers que la usan), las medias de la plantilla elegida (selector de tipo, periodo, color, estilo, grosor, borrar, añadir) con *Save template*, *New template*, *Rename*, *Make default*, *Delete* (panel de confirmación que nombra los brokers que pasan a la de por defecto). Sin tabla de brokers: las asignaciones se hacen desde el gráfico. Tablas en escritorio, tarjetas en móvil.
- `DisplayTab.tsx`: muestra la sección. La sección guarda con su propio botón *Save template*; el *Save* de la barra de pestañas sigue guardando los demás ajustes de Display.

## Asignación por broker y temporalidad (AC 3, 12; añadida tras la primera prueba local)

- `ma_template_brokers` gana `timeframe` (texto, `''` = todas las temporalidades) y su clave pasa a ser `(userId, broker, timeframe)`; las filas existentes reciben `''`.
- `GET /ma-templates` devuelve `assignments` como lista `[{ broker, timeframe: string | null, templateId }]`; `PUT /ma-templates/assignments` recibe `{ broker, timeframe?: string | null, templateId: number | null }` (`timeframe` M1…MN, ausente o `null` = todas; `templateId: null` borra esa fila).
- `useMaTemplates.templateFor(broker, timeframe)`: broker + temporalidad → broker → por defecto, y `sourceOf` dice cuál se aplica.
- El botón de indicadores: cada lado del gráfico lo abre con su propia temporalidad (en la vista partida los dos lados difieren). Bajo el selector de plantilla, «Only on <temporalidad>» (marcado cuando la plantilla actual viene de una asignación por temporalidad) y una línea «From FTMO · H1» / «From FTMO» / «Default». Elegir una plantilla escribe la fila de la temporalidad si está marcado y si no la del broker; desmarcar devuelve la elección a la fila del broker y borra la de la temporalidad.

## Flujo de datos

```
Settings › Display, botón de indicadores del gráfico ──PUT/POST/DELETE /ma-templates──▶ db (ma_templates, ma_template_brokers)
                                                       └─▶ WS { type: 'ma_templates' } ──▶ useMaTemplates (gráfico, settings) recarga
Lado del gráfico (broker) ──templateFor(broker)──▶ medias − ocultas (localStorage) ──▶ LightweightChart (series EMA / SMA)
```

Sin cambios en el contrato EA ↔ backend.

## Maqueta

Aprobada por el operador el 19-nov-2026: https://claude.ai/artifact/Vfn9euqE2PWW6Jjti2KKSV — artboards: Settings › Display escritorio, Settings › Display móvil, borrar una plantilla en uso, gráfico › botón de indicadores con la plantilla del broker.

## Ficheros a tocar

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_ma_templates/migration.sql`; después `<ts>_drop_chart_indicators`.
- `backend/src/routes/ma-templates.ts` (+ test), `backend/src/app.ts`, `backend/src/ws/ws.ts` (envío); después quitar `routes/chart-indicators.ts`.
- `frontend/src/lib/useMaTemplates.ts`, `frontend/src/features/chart/chart.types.ts`, `LightweightChart.tsx`, `ChartPage.tsx`, `ChartSlot.tsx`, `IndicatorsPanel.tsx` (+ css), `frontend/src/features/settings/MaTemplatesSection.tsx` (+ css), `DisplayTab.tsx`.
- `backend/docs/architecture.md`, `.claude/CLAUDE.md`.

## Dependencias

Ninguna nueva.

## Riesgos

- **Orden de despliegue:** el backend sale primero con las rutas nuevas y la migración de datos; la ruta antigua sigue respondiendo, así que el frontend desplegado funciona hasta que salga el nuevo. No hay plantillas que perder antes de que salga el frontend.
- **SMA en la vela en curso:** debe usar la misma ventana que el cálculo completo, o el último punto salta al cerrar la vela; se comprueba contra el cálculo completo en la prueba local.
- **Muchas medias con periodos largos** cuestan más en cada tick: la actualización incremental lo deja en un paso por media, como hoy.
