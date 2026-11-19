# 052 — Plantillas de medias móviles por broker

> Status: **approved**

## Contexto

El gráfico solo dibuja medias móviles exponenciales (EMA). Cada usuario tiene una sola lista (`chart_indicators.emas`: periodo, color, estilo y grosor), que se edita en el panel de indicadores del gráfico y se aplica igual a todos los brokers, símbolos y temporalidades. El operador quiere también medias móviles simples (SMA) y conjuntos de medias distintos para distintos brokers — por ejemplo uno para las cuentas de fondeo y otro para las cuentas Solidary — sin editar la lista cada vez que el gráfico cambia de broker.

## Capas afectadas

- db (plantillas y su asignación por broker)
- backend (rutas de plantillas y asignaciones)
- frontend (una sección de Settings › Display para gestionar las plantillas; el gráfico dibuja la plantilla de su broker, con soporte de SMA)

## Historias de usuario

- Como operador, quiero añadir medias móviles simples junto a las exponenciales, para usar los indicadores en los que se basan mis estrategias.
- Como operador, quiero guardar plantillas de medias móviles con nombre, para tener varios conjuntos preparados.
- Como operador, quiero asignar una plantilla a cada broker, para que todos los gráficos de ese broker muestren su conjunto sin tocar nada.
- Como operador, quiero una plantilla por defecto para los brokers sin plantilla, para que un broker nuevo muestre medias razonables desde el principio.

## Criterios de aceptación

- AC 1. CUANDO el operador añada una media móvil a una plantilla ENTONCES elige su tipo (EMA o SMA), periodo, color, estilo de línea y grosor.
- AC 2. CUANDO el gráfico muestre un símbolo ENTONCES dibuja las medias de la plantilla asignada al broker de ese gráfico, cada una calculada con su tipo sobre las velas del gráfico, incluida la vela en curso.
- AC 3. CUANDO un gráfico muestre un broker y una temporalidad ENTONCES usa la plantilla asignada a ese broker en esa temporalidad; si no hay, la asignada al broker para todas las temporalidades; si tampoco, la plantilla por defecto.
- AC 4. CUANDO el operador abra Settings › Display ENTONCES, en una sección «Moving average templates», puede crear, renombrar, editar y borrar plantillas y marcar una como la de por defecto; la lista muestra qué brokers usan cada plantilla.
- AC 5. CUANDO se borre una plantilla asignada a brokers ENTONCES esos brokers pasan a la plantilla por defecto, tras confirmarlo el operador; la plantilla por defecto no se puede borrar.
- AC 6. CUANDO se despliegue el cambio ENTONCES la lista de EMAs actual del operador pasa a ser la plantilla por defecto, así que los gráficos se ven igual que antes hasta que se cambie algo.
- AC 7. CUANDO se guarde una plantilla o una asignación ENTONCES los gráficos ya abiertos la recogen sin recargar la página.
- AC 8. CUANDO la vista partida muestre dos gráficos de brokers distintos ENTONCES cada uno dibuja la plantilla de su broker.
- AC 9. CUANDO se abra el botón de indicadores del gráfico ENTONCES permite elegir la plantilla del broker del gráfico (cualquier plantilla o la de por defecto), para todas las temporalidades de ese broker o, con «Only on <temporalidad>» marcado, solo para la temporalidad del gráfico, y muestra de dónde viene la plantilla actual (broker y temporalidad, broker, o por defecto); lista las medias de esa plantilla, permite mostrar u ocultar cada una en este dispositivo y enlaza a Settings › Display para editarlas.
- AC 10. CUANDO se guarden plantillas ENTONCES cada periodo es un entero de 1 o más, la misma regla que las EMAs de hoy; no hay límite de periodo ni de número de medias por plantilla.
- AC 12. CUANDO se asigne una plantilla a un broker en una temporalidad ENTONCES las demás temporalidades de ese broker conservan la suya, y al quitarla esa temporalidad vuelve a la plantilla del broker (o a la de por defecto). Las asignaciones existentes son para todas las temporalidades. (Añadido con el operador el 19-nov-2026, tras la primera prueba local.)
- AC 11. CUANDO la página se vea en un móvil ENTONCES la sección de plantillas de Settings › Display se puede usar (tarjetas en móvil, tablas en escritorio).
## Fuera de alcance

- SMA en las alertas de medias, las reglas de notificación, el overlay de operaciones por cruce y los setup levels, con cada lado del cruce eligiendo su tipo y lo existente conservado como EMA contra EMA: spec 053, que se abre al cerrar esta (decidido con el operador el 19-nov-2026).
- Las alertas de precio (no usan medias).
- Plantillas por temporalidad o por símbolo.
- Otros tipos de indicador (bandas de Bollinger, RSI, …).
- Compartir plantillas entre usuarios.
- Una nueva organización de Settings: las plantillas viven en Display por ahora; una spec posterior reorganiza Settings (decidido con el operador el 19-nov-2026).
