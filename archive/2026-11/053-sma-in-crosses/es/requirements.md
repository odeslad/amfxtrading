# 053 — SMA en cruces, notificaciones, overlay y setup levels

> Estado: **cerrado**
> Padre: [052 — Plantillas de medias móviles](../../052-moving-average-templates/es/requirements.md)

## Contexto
La spec 052 añadió las medias simples (SMA) al gráfico, pero todo lo que evalúa un cruce sigue funcionando solo con EMAs: las alertas de cruce (`ema_cross_alerts`), las reglas de notificación (`ema_notifications`), el overlay de operaciones por cruce (`settings_display.emaTrades*`) y los setup levels (`/setup-levels`). El operador quiere las mismas prestaciones con SMAs.

## Capas afectadas
- db · backend · frontend

## Historias de usuario
- Como operador, quiero que cada lado de un cruce (rápida y lenta) sea EMA o SMA, para alertar, recibir avisos y estudiar cruces de las medias que de verdad dibujo.

## Criterios de aceptación
- AC 1. CUANDO creo o edito una alerta de cruce ENTONCES elijo el tipo (EMA/SMA) de la media rápida y de la lenta, por separado.
- AC 2. CUANDO creo o edito una regla de notificación (Settings › Notifications) ENTONCES elijo los dos tipos de la misma forma.
- AC 3. CUANDO una alerta o regla usa una SMA ENTONCES se evalúa al cierre de vela con el valor de la SMA, con la misma lógica de cruce/aproximación/umbral/dirección que con EMAs.
- AC 4. CUANDO una alerta o regla se dispara ENTONCES el push y el texto de la app nombran los tipos (p. ej. "SMA 20 / EMA 50").
- AC 5. CUANDO configuro el overlay de operaciones por cruce en Settings › Display ENTONCES elijo el tipo de cada media, y el overlay calcula los cruces con ellas.
- AC 6. CUANDO se piden los setup levels ENTONCES cada media puede ser EMA o SMA, y el resultado coincide con el gráfico.
- AC 7. CUANDO se despliega la spec ENTONCES todas las alertas, reglas, ajustes del overlay y setup levels existentes siguen funcionando igual, como EMA contra EMA.
- AC 8. Los periodos siguen la misma regla que hoy (entero ≥ 1).

## Fuera de alcance
- Otros tipos de media (WMA, etc.).
- Vincular alertas u overlay a las plantillas de medias del gráfico.
- La reorganización de Settings (spec futura).
