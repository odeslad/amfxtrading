# 064 — Day P&L en vivo sin consultas periódicas

> Status: **closed**

## Contexto
Diario › Accounts muestra un Day P&L por broker: el resultado neto de las operaciones cerradas hoy (día del broker) más el resultado flotante de las posiciones abiertas. Hoy cada pestaña de Accounts abierta pide `GET /balances/daily-pnl` cada 5 s, y cada petición suma en la base de datos las operaciones cerradas hoy de cada broker. Con 13 brokers son unas 17 000 peticiones y más de 200 000 sumas en la base de datos al día para una sola pestaña abierta, para una parte cerrada que solo cambia cuando se cierra una operación. La columna Profit de al lado ya va en vivo: llega con el mensaje `account` del WebSocket cada segundo. Esta spec hace que el Day P&L vaya tan en vivo como el Profit y elimina las consultas periódicas.

## Capas afectadas
- backend · frontend

## Historias de usuario
- Como trader, quiero que el Day P&L se mueva con el Profit, para que las dos cifras cuadren en todo momento.
- Como responsable del servidor, quiero que el Day P&L no cueste casi nada, para que una pestaña de Accounts abierta todo el día no cargue el backend ni la base de datos.

## Criterios de aceptación
- AC 1. CUANDO la pestaña Accounts está abierta ENTONCES no hace ninguna petición periódica del Day P&L.
- AC 2. CUANDO llega un mensaje `account` de un broker ENTONCES su Day P&L se muestra como su resultado cerrado de hoy más equity menos balance, actualizado en el mismo momento que el Profit (tabla en escritorio y tarjetas en móvil).
- AC 3. CUANDO el backend guarda un historial con cambios de un broker ENTONCES el resultado cerrado de hoy de ese broker se recalcula una vez, y los siguientes mensajes `account` llevan el valor nuevo.
- AC 4. CUANDO cambia el día de un broker (medianoche en hora del broker) ENTONCES su resultado cerrado de hoy empieza de nuevo con las operaciones del nuevo día sin esperar a una operación nueva.
- AC 5. CUANDO el backend se reinicia ENTONCES el resultado cerrado de hoy de cada broker se recalcula antes de enviarse.
- AC 6. CUANDO el pipe de un broker no está vivo ENTONCES su fila sigue inactiva y no muestra Day P&L, como hoy.
- AC 7. CUANDO se despliega el cambio ENTONCES la carga antes y después (peticiones y sumas en la base de datos del Day P&L por hora con una pestaña de Accounts abierta) queda anotada en `verification.md`.

## Fuera de alcance
- El salto del Day P&L justo después de cerrar una posición (el EA escribe su historial cada 60 s, así que la operación llega a la parte cerrada hasta un minuto después de salir de la parte abierta).
- Cambiar lo que cuenta el Day P&L (beneficio + swap + comisión) o el límite del día del broker.
- Cualquier cambio en el EA.
