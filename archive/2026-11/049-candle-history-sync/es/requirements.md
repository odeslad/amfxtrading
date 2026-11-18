# 049 — Sincronización del histórico de velas desde Settings

> Status: **closed**

## Contexto
Las velas solo llegan a la BD desde MT4: el EA escribe `candles_<SYM>_<TF>.json` cada 60 s y el backend guarda cada vela que cierra en el tick. Lo lejos que llega el histórico depende de lo que cada MT4 tuviera descargado, y desde la app no se puede ver ni controlar. Además, la tabla `candles` tiene páginas dañadas (~8 M filas, 2,1 GB): leerla entera o hacer un `pg_dump` completo falla, lo que impide pasar a otro servidor. Esta spec da al operador una forma manual, por broker y temporalidad, de rehacer el histórico de velas desde el EA, con un número de velas objetivo fijado en Settings.

## Capas afectadas
- frontend · backend · db · ea

## Historias de usuario
- Como operador, quiero ver para cada broker y temporalidad cuántas velas tiene la BD y cuándo se sincronizaron por última vez, para conocer el estado del histórico.
- Como operador, quiero fijar el número de velas que guardar para cada broker y temporalidad, para que cada gráfico tenga la profundidad que necesito.
- Como operador, quiero lanzar a mano una sincronización de las temporalidades que marque en un broker, para rehacer su histórico desde MT4 sin tocar el resto.

## Criterios de aceptación
- AC 1. CUANDO el operador abre Settings › Sincronización de datos ENTONCES ve una fila por broker y temporalidad con el número de velas en la BD y la fecha de la última sincronización (o «nunca»).
- AC 2. CUANDO el operador cambia el número de velas objetivo de un broker y temporalidad y guarda ENTONCES el valor se conserva y lo usa la siguiente sincronización de esa pareja.
- AC 3. CUANDO el operador marca una o varias temporalidades de un broker y lanza la sincronización ENTONCES el backend pide al EA de ese broker que recupere, para cada símbolo configurado en ese EA, el número de velas objetivo de cada temporalidad marcada.
- AC 4. CUANDO MT4 no tiene histórico suficiente de un símbolo y temporalidad ENTONCES el EA abre un gráfico temporal para que MT4 descargue histórico hasta el objetivo, y cierra ese gráfico al terminar.
- AC 5. CUANDO el EA entrega las velas de una temporalidad ENTONCES el backend sustituye las velas de ese broker y temporalidad (todos sus símbolos) por las entregadas; los demás brokers y temporalidades no se tocan.
- AC 6. CUANDO el broker tiene menos velas que el objetivo ENTONCES se guardan todas las disponibles y la fila muestra el número real alcanzado.
- AC 7. MIENTRAS corre una sincronización ENTONCES su fila en Settings › Sincronización de datos muestra el estado en vivo, sin recargar la página (en cola, en curso con la temporalidad y el símbolo que se están recuperando, hecha, o error con el motivo), y al terminar actualiza el número de velas y la fecha de la última sincronización. CUANDO el operador sale de Settings y vuelve, o la abre en otro dispositivo, ENTONCES ve el mismo estado actual.
- AC 8. CUANDO una sincronización falla o el EA no está conectado ENTONCES no se borra ninguna vela: el histórico anterior queda como estaba.
- AC 9. CUANDO hay una sincronización de un broker en curso ENTONCES no se puede lanzar otra del mismo broker.
- AC 10. MIENTRAS corre una sincronización ENTONCES los ticks, las posiciones, las órdenes y el guardado automático de velas nuevas siguen funcionando como hoy.
- AC 11. CUANDO todos los brokers y temporalidades se han sincronizado ENTONCES la tabla `candles` no tiene páginas dañadas: una lectura completa y un `pg_dump` completo de la BD funcionan.

## Fuera de alcance
- Sincronizaciones automáticas o programadas: todas se lanzan a mano.
- Elegir símbolos: la sincronización cubre siempre todos los símbolos configurados en el EA de ese broker.
- Cambiar cómo se guardan día a día las velas nuevas que cierran.
- Velas de cualquier fuente que no sea MT4.
- Pasar a otro servidor (va después de esta spec).
