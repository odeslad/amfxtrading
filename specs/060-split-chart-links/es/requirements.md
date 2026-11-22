# 060 — Enlaces del gráfico partido

> Estado: **aprobada**

## Contexto

En el gráfico partido (spec 036, solo escritorio) los dos lados muestran siempre el mismo broker y par; solo cambia la temporalidad (el derecho abre una temporalidad por encima). El operador quiere que cada lado pueda mostrar un broker y un par distintos, y elegir si un cambio en un lado se aplica también al otro.

## Capas afectadas

- frontend

## Historias de usuario

- Como operador, quiero enlazar los dos lados, para que al elegir un broker o un par en un lado cambie también el otro.
- Como operador, quiero desenlazarlos, para que cada lado muestre su propio broker y par (p. ej. el mismo par en dos brokers, o dos pares en el mismo broker).

## Criterios de aceptación

- AC 1. CUANDO el gráfico está partido ENTONCES cada lado tiene sus propios selectores de broker y par, y un enlace entre los lados, activado o no, que abarca broker y par.
- AC 2. CUANDO el enlace está activado y el operador elige un broker en cualquier lado ENTONCES el otro lado cambia a ese broker. CUANDO está desactivado ENTONCES solo cambia ese lado.
- AC 3. CUANDO el enlace está activado y el operador elige un par en cualquier lado ENTONCES el otro lado cambia a ese par (si el broker del otro lado no lo ofrece, ese lado muestra que el broker no ofrece el par en lugar del gráfico). CUANDO está desactivado ENTONCES solo cambia ese lado.
- AC 4. CUANDO se activa el enlace con los lados distintos ENTONCES el lado derecho toma el broker y el par del izquierdo.
- AC 5. La temporalidad nunca se enlaza: cada lado conserva la suya, como hoy.
- AC 6. CUANDO el operador abre una posición u orden desde el diario (doble clic o doble toque) ENTONCES el lado izquierdo muestra su broker y par, y el derecho lo sigue solo mientras el enlace esté activado.
- AC 7. El enlace y el broker y par de cada lado se recuerdan en este navegador, junto con el resto del estado del gráfico partido; cerrar y volver a abrir el partido los recupera. CUANDO no hay nada recordado ENTONCES el enlace está activado (comportamiento de hoy).
- AC 8. CUANDO el gráfico no está partido ENTONCES no cambia nada: un gráfico con sus selectores, como hoy.
- AC 9. Todo lo que va ligado a un lado (posiciones, órdenes, dibujos, alertas, la plantilla de medias de su broker, ticks en vivo) sigue el broker y par de ese lado.

## Fuera de alcance

- Enlazar la temporalidad.
- Más de dos gráficos.
- El gráfico partido en móvil (sigue siendo solo escritorio).
- Enlazar el desplazamiento o la cruz del cursor entre los lados.
