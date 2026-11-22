# 059 — Memoria del zoom del gráfico · Diseño

> Estado: **aprobada**

## Enfoque

Un módulo pequeño guarda el zoom en el navegador (`localStorage`, clave `chart.zoom`) y `LightweightChart` lo lee al cargar un histórico y lo escribe cuando el operador hace zoom. Los dos lados de un gráfico partido usan el mismo componente, así que comparten la memoria sin nada más (AC 6).

```ts
// features/chart/zoomMemory.ts
interface ChartZoom {
  barSpacing: Partial<Record<string, number>>;   // por temporalidad: px por vela
  priceHeight: Partial<Record<string, number>>;  // por `${symbol}|${timeframe}`: alto de precios visible
}
readBarSpacing(timeframe): number | null
saveBarSpacing(timeframe, px): void
readPriceHeight(symbol, timeframe): number | null
savePriceHeight(symbol, timeframe, height | null): void   // null = vuelve a automático
```

Funciones simples, no un hook: el gráfico las lee de forma imperativa al cargar y las escribe desde los callbacks de la librería. Lecturas y escrituras van dentro de `try` (almacenamiento lleno o no disponible → el gráfico funciona como hoy). Se ignoran valores fuera de rango razonable (espaciado de 0,5 a 100 px, altos no positivos).

## Zoom horizontal (AC 1, 2, 5, 8)

- **Aplicar**: la carga del histórico, que hoy pone `barSpacing: 6` y desplaza al 30 % del borde derecho, usa `readBarSpacing(tf) ?? 6`. La carga de velas antiguas no cambia, así que conserva el zoom (AC 8).
- **Guardar**: el manejador actual de `subscribeVisibleLogicalRangeChange` compara `timeScale().options().barSpacing` con el último valor visto; si cambió, lo guarda para la temporalidad actual tras una pausa de 400 ms (una escritura por gesto, no por fotograma).

## Zoom vertical (AC 3, 4, 5)

La librería no tiene evento de cambio de la escala de precios, así que el gráfico mira la escala **al terminar cada interacción** sobre su contenedor (`pointerup`, `touchend` y una pausa de 400 ms tras `wheel`):

- escala en manual (`autoScale: false`) → guarda `to − from` de `priceScale().getVisibleRange()` para par + temporalidad;
- escala de vuelta en automático (el doble clic de la librería en el eje de precios) → `savePriceHeight(…, null)`.

**Aplicar**: tras cargar un histórico, si hay alto recordado, `autoScale: false` y `setVisibleRange({ from: cierre − h/2, to: cierre + h/2 })` alrededor del cierre de la última vela. Sin alto, automático como hoy.

El alto es un rango de precio (p. ej. 0,0040 en EURUSD), así que solo vale para su par: por eso va por par y temporalidad y no se comparte entre pares.

Un desplazamiento vertical también deja la escala en manual (es como la librería permite desplazar, ver `beginPanePan`); su alto también se guarda. Es lo buscado: tras desplazar, el operador eligió escala manual, y la siguiente carga se abre con ese alto centrado en el precio.

## Diario (AC 7)

Hecho fuera de la spec, en `7748cdb fix(frontend): open the chart from the journal on the last timeframe`: posiciones y órdenes ya no fuerzan H1, así que el gráfico se abre en la última temporalidad y, con esta spec, con su zoom.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/features/chart/zoomMemory.ts` | nuevo: funciones de lectura y guardado |
| `frontend/src/features/chart/LightweightChart.tsx` | aplicar al cargar el histórico; guardar el horizontal al cambiar el rango; guardar el vertical al terminar cada interacción |

Sin cambios en backend, BD ni EA. Sin dependencias nuevas.

## Maqueta

No aplica: no cambia ninguna pantalla, panel ni control; el gráfico solo se vuelve a abrir con el zoom que tenía.

## Riesgos

- **Recuperar un alto en un par cuyo precio se movió mucho** (p. ej. tras un hueco grande): el alto sigue siendo razonable porque se centra en el cierre actual.
- **Un ancho de ventana muy distinto** (escritorio y móvil en el mismo perfil de navegador es raro): el espaciado va en px por vela, así que una ventana estrecha simplemente muestra menos velas.
- **Comportamiento de la librería**: `priceScale().setVisibleRange` y `getVisibleRange` existen en lightweight-charts 5.2 (`typings.d.ts`); se comprueba en la app local dentro de la tarea.
