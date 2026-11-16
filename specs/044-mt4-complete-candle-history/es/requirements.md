# 044 — MT4 como fuente completa y única de velas

> Status: **implementing**

## Contexto

Las velas llegan a la base de datos solo desde MT4: el EA escribe `candles_<SYM>_<TF>.json` y el backend guarda las velas cerradas. Durante la migración de VPS ([spec 043](../../043-vps-migration/es/requirements.md)) el sistema nuevo arrancó con la tabla `candles` vacía y mostró lo que ese camino entrega de verdad: huecos de semanas (EURUSD M15 en octubre de 2026 tiene entre 1.088 y 2.093 velas por broker cuando un mes completo son unas 2.112) y 216 velas guardadas con el cierre fuera de su rango máximo–mínimo, que se pintan como mechas largas falsas. El broker tiene los datos y MT4 los muestra en sus propios gráficos; se pierden por el camino. Tres causas, leídas en el código:

1. El EA exporta todo el histórico solo en `OnInit`, con lo que MT4 tenga en disco en ese instante; a partir de ahí escribe solo las últimas 100 velas cada 60 s. El histórico que MT4 descarga después no se exporta nunca.
2. `services/candle-close.ts` guarda la vela anterior, cerrada con el último bid, cada vez que cambia la hora de la vela de una temporalidad. Un terminal que arranca con el histórico atrasado da una vela antigua como la vela en curso, así que se guarda una vela antigua con el precio de hoy.
3. `services/candles.ts` inserta las filas que faltan y sobrescribe solo las dos últimas velas cerradas, así que una vela guardada mal nunca la corrige el fichero del EA.

El VPS antiguo corre el mismo código; su tabla parece completa solo porque se llenó de 100 en 100 velas durante meses. La regla del usuario para esta spec: **las velas vienen de MT4, nunca de inserciones a mano ni de otra base de datos**.

## Capas afectadas

- ea
- backend

## Historias de usuario

- Como operador, quiero que todos los gráficos de la app muestren las mismas velas que muestra MT4 para ese broker, para poder fiarme de la app sin mirar el terminal.
- Como operador, quiero que un terminal que arranca, se reinicia o reconecta no deje ninguna vela falsa, para que los indicadores y las EMAs no se distorsionen.
- Como desarrollador, quiero una base de datos que se pueda vaciar y reconstruir solo desde MT4, para que una migración o una tabla dañada nunca obliguen a rescatar filas a mano.

## Criterios de aceptación

- AC 1. CUANDO el EA arranca en un terminal ENTONCES pide a MT4 el histórico de cada símbolo y temporalidad configurados y, cuando MT4 lo tiene, lo exporta completo — sin que nadie abra un gráfico en el terminal.
- AC 2. CUANDO MT4 obtiene más histórico de un símbolo y temporalidad después de arrancar el EA (una descarga tardía, una reconexión) ENTONCES el EA lo exporta sin reiniciarse.
- AC 3. CUANDO se ha guardado la exportación completa de un símbolo y temporalidad ENTONCES la base de datos no tiene huecos dentro del rango que conserva MT4: para un mes pasado que esté entero dentro de ese rango, las cuentas que comparten feed de broker tienen el mismo número de velas.
- AC 4. CUANDO un terminal arranca o reconecta con el histórico atrasado ENTONCES el backend no guarda ninguna vela construida a partir de una vela que no era de verdad la vela en curso, y ninguna vela guardada tiene la apertura o el cierre fuera de su rango máximo–mínimo.
- AC 5. CUANDO la exportación completa del EA contiene una vela que ya está guardada con otros valores ENTONCES la vela guardada toma los valores del EA.
- AC 6. CUANDO el sistema funciona en su ciclo normal (últimas velas cada 60 s) ENTONCES el trabajo de velas por ciclo sigue siendo del mismo orden que hoy: el histórico completo no se reescribe cada minuto.
- AC 7. CUANDO esta spec se despliega en el sistema nuevo ENTONCES los huecos y las velas falsas que ya hay guardados allí desaparecen por las propias exportaciones del EA, sin SQL manual sobre la tabla `candles`.
- AC 8. CUANDO se guardan las velas de una barra cerrada ENTONCES el comportamiento en vivo no cambia: el mensaje `candle` del WebSocket en el cambio de vela (spec 025), la vela activa que construye el frontend con los ticks y las alertas de EMA evaluadas al cierre de vela.
- AC 9. CUANDO el EA ha exportado un símbolo y temporalidad ENTONCES el sistema puede decir, sin que nadie mire un gráfico, si ese histórico está completo: el EA informa por símbolo y temporalidad de cuántas velas tiene MT4, su primera y última hora, si MT4 sigue descargando y cuántos días de mercado dentro de ese rango no tienen velas; el backend compara esas cifras con lo que tiene guardado y expone el resultado por broker.
- AC 10. CUANDO un símbolo y temporalidad se da por completo ENTONCES se cumplen tres cosas: MT4 no está descargando nada para él, no tiene ningún día de mercado sin velas dentro de su rango, y la base de datos tiene exactamente las velas cerradas que MT4 dice tener en ese rango.

## Fuera de alcance

- Recuperar velas de la base de datos antigua o de cualquier fuente que no sea MT4.
- Velas más antiguas que lo que el broker sirve por MT4. Hasta dónde llega el histórico de un broker no se puede verificar desde MT4; "completo" significa continuo e idéntico a MT4, no "lo más antiguo posible".
- Cualquier cambio en el frontend.
- El refactor pendiente del EA (dejar de escribir `positions.json`).
- Las cuentas que no conectan (`demo`, `solidary isa`).
