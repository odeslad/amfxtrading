# 059 — Memoria del zoom del gráfico

> Estado: **cerrada**

## Contexto

Cada vez que el gráfico carga un broker, un par o una temporalidad, reinicia el zoom: 6 px por vela, la última vela al 30 % del borde derecho y la escala de precios en automático (`LightweightChart.tsx`, carga del histórico). Al abrir una posición u orden desde el diario, al cambiar de temporalidad o al volver al gráfico se pierde el zoom que tenía el operador. La temporalidad ya se recuerda (`chart.selection` en el navegador) y, desde el `fix(frontend)` del 21-11-2026, el diario ya no fuerza H1.

## Capas afectadas

- frontend

## Historias de usuario

- Como operador, quiero que cada temporalidad conserve el zoom horizontal que usé la última vez, para que M5 y D1 se abran como me gusta leerlas.
- Como operador, quiero que un par y temporalidad cuya escala de precios estiré a mano se abra con ese mismo alto, centrado en el precio actual, para no volver a hacer zoom cada vez.

## Criterios de aceptación

- AC 1. CUANDO el operador cambia el zoom horizontal (rueda, pellizco o arrastrando el eje de tiempo) en una temporalidad ENTONCES ese zoom se recuerda para esa temporalidad, en este navegador.
- AC 2. CUANDO el gráfico carga cualquier broker y par en una temporalidad con zoom horizontal recordado ENTONCES se abre con ese zoom, con la última vela a la vista a la distancia habitual del borde derecho.
- AC 3. CUANDO el operador estira o encoge a mano la escala de precios en un par y temporalidad ENTONCES se recuerda el alto de precios visible para ese par y temporalidad (como alto, no como precios fijos).
- AC 4. CUANDO el gráfico carga un par y temporalidad con alto recordado ENTONCES la escala se abre con ese alto centrado en el precio actual; CUANDO el operador devuelve la escala a automático (doble clic en el eje de precios) ENTONCES se olvida el alto recordado y vuelve a abrirse en automático.
- AC 5. CUANDO no hay nada recordado ENTONCES el gráfico se abre como hoy (6 px por vela, escala automática).
- AC 6. CUANDO el gráfico está partido en dos ENTONCES los dos lados leen y escriben la misma memoria: el zoom va con la temporalidad (y el par), no con el lado.
- AC 7. CUANDO el operador abre una posición u orden desde el diario (doble clic o doble toque) ENTONCES el gráfico se abre en la última temporalidad usada, con su zoom recordado.
- AC 8. CUANDO se cargan velas antiguas al desplazarse hacia atrás ENTONCES el zoom no cambia (como hoy).

## Fuera de alcance

- Sincronizar el zoom entre dispositivos (sigue siendo por navegador: un móvil y un escritorio tienen anchos muy distintos).
- Recordar la posición en el tiempo (el gráfico siempre se abre en la última vela).
- Memoria de zoom por broker (el mismo par se ve igual en todos los brokers).
