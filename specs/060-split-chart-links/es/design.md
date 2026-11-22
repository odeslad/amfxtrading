# 060 — Enlaces del gráfico partido · Diseño

> Estado: **aprobada**

## Enfoque

Hoy `ChartPage` guarda un broker y un par (persistidos como `chart.selection`) y los pasa a los dos `ChartSlot`; solo la temporalidad va por lado (`split.rightTimeframe`). El lado derecho pasa a tener su propio broker y par, y un enlace decide si muestra los suyos o los del izquierdo:

```ts
interface SplitState {
  on: boolean; rightTimeframe: string; ratio: number; leftTimeframe?: string;   // hoy
  linked?: boolean;   // sin valor = activado (comportamiento de hoy, AC 7)
  rightBroker?: string;
  rightSymbol?: string;
}

const linked = split.linked ?? true;
const rightBroker = linked ? broker : split.rightBroker ?? broker;
const rightSymbol = linked ? symbol : split.rightSymbol ?? symbol;
```

El lado izquierdo sigue siendo la selección principal de la página (`broker` / `symbol`, `chart.selection`, el enlace del diario). El derecho se **deriva**: mientras está enlazado muestra los valores del izquierdo, así que activar el enlace le hace tomar el valor del izquierdo sin copiar nada (AC 4), y un enlace desde el diario mueve el lado izquierdo y, mientras esté enlazado, el derecho (AC 6).

**Cambiar un selector** (AC 2, 3):

| Dónde | Enlace activado | Enlace desactivado |
|---|---|---|
| Izquierdo | `setBroker` / `setSymbol` (el derecho lo sigue por derivación) | igual; el derecho conserva el suyo |
| Derecho | `setBroker` / `setSymbol` (cambia el izquierdo y el derecho lo sigue) | `split.rightBroker` / `rightSymbol` |

**Desactivar el enlace** guarda el broker y el par actuales del lado derecho como propios, para que no salte.

## Pares de cada lado

La lista de pares depende del broker. La carga que hoy hace la página pasa a un hook pequeño, `useChartSymbols(broker)`, usado una vez por lado; el derecho solo carga cuando su broker es distinto del izquierdo. Los brokers y pares ocultos (spec 024 / 056) se aplican a cada lado como hoy.

**Un par enlazado que el broker derecho no ofrece** (AC 3): el `ChartSlot` derecho muestra un `EmptyState` "SOLIDARY does not offer GBPUSD" en lugar del gráfico; sus selectores siguen disponibles.

## Barra de herramientas (maqueta)

`ChartToolbar` recibe dos props opcionales, `linked` y `onToggleLink`. Con ellas (gráfico partido), un botón de enlace va tras los selectores de broker y par, en los dos lados, con el mismo estado: cadena naranja = enlazado, cadena rota gris = desenlazado (`IconLink` / `IconUnlink` en `shared/ui/icons`, `IconButton` con `tone="active"` cuando está activado). Sin gráfico partido no se dibuja (AC 8).

## Lo que va con cada lado (AC 9)

Cada `ChartSlot` ya carga velas, posiciones, órdenes, dibujos, ticks y la plantilla de medias de su broker a partir de sus props `broker` / `symbol`, así que solo necesita los valores correctos. Lo que vive en `ChartPage` lo comparten los dos lados y hoy supone un único par:

- **Paneles que se abren desde una barra** (indicadores, filtros, alertas, nueva operación): se abren para el lado que los pidió. La página guarda `panelSide: 'left' | 'right'`, que fijan los callbacks de cada lado (`sharedSlotProps` gana envoltorios por lado), y los paneles toman el broker y par de ese lado.
- **Panel de filtros** (los selectores en pantallas estrechas): el gráfico partido es solo de escritorio, así que sigue editando el lado izquierdo.
- **Alertas del gráfico y precio de la alerta**: filtradas por el broker y par de cada lado.

## Persistencia (AC 7)

Todo en el `chart.split` actual (localStorage). Los valores guardados antes no tienen `linked`, así que está activado: exactamente el comportamiento de hoy.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/features/chart/ChartPage.tsx` | broker / par del lado derecho, enlace, valores derivados, selectores y paneles por lado |
| `frontend/src/features/chart/useChartSymbols.ts` | nuevo: pares de un broker (movido desde `ChartPage`) |
| `frontend/src/features/chart/ChartToolbar.tsx` (+ css) | botón de enlace |
| `frontend/src/features/chart/ChartSlot.tsx` | estado "el broker no ofrece el par" |
| `frontend/src/shared/ui/icons.tsx` | `IconLink`, `IconUnlink` |

Sin cambios en backend, BD ni EA; sin dependencias nuevas. La suscripción de ticks por WS cuenta referencias por par (`addTickSubscription`), así que dos pares a la vez ya funcionan (límite 16).

## Maqueta

https://claude.ai/artifact/3KZsuLXA7gTKLX7Ym9KS1M (aprobada, un solo icono de enlace): tableros de escritorio **Linked** (por defecto) y **Unlinked** (cada lado con su broker y par).

## Riesgos

- `ChartPage` es largo (650 líneas) y los paneles suponen un único par: conectar los paneles por lado es lo más delicado; va en su propia tarea.
- Un broker del lado derecho que desaparece (oculto o eliminado): se ve como hoy la selección oculta, marcada "· hidden", hasta que se cambie.
