# 055 — Cuentas del diario: color, filtro y número de trades/órdenes

> Estado: **aprobado**

## Contexto
Diario › Accounts lista todas las cuentas de broker (tabla en escritorio, tarjetas en el móvil) con broker, nombre de cuenta, número, balance, equity, P&L y el resto. Con muchas cuentas no hay forma de acotar la lista ni de agrupar cuentas a la vista, y la lista no dice cuántas posiciones y órdenes pendientes tiene abiertas cada cuenta; eso solo se ve en las pestañas Positions y Orders. Las posiciones y órdenes ya tienen un distintivo de color (`position_colors`) por el que filtran las otras pestañas del diario.

## Capas afectadas
- db · backend · frontend

## Historias de usuario
- Como operador, quiero dar un color a cada cuenta, para agrupar cuentas de un vistazo.
- Como operador, quiero filtrar las cuentas por broker y por color, para ver solo las que me interesan.
- Como operador, quiero ver cuántas posiciones y órdenes pendientes tiene abiertas cada cuenta, para no abrir las otras pestañas para saberlo.

## Criterios de aceptación
- AC 1. Cada cuenta tiene un distintivo de color, como el de las posiciones: un clic (toque) pasa al siguiente color de la misma paleta y, desde el último, vuelve a sin color. El color se guarda por broker y es el mismo en todos los dispositivos.
- AC 2. La pestaña Accounts tiene el botón Filters y el mismo panel lateral de filtros que Positions (mismo diseño, cabecera, campos y botón Clear filters), con dos campos: Broker (selector, "All Brokers" y los brokers visibles) y Color (selector, "All Colors" y solo los colores que tenga alguna cuenta).
- AC 3. CUANDO elijo un broker ENTONCES solo se ve esa cuenta.
- AC 4. CUANDO elijo un color ENTONCES solo se ven las cuentas con ese color.
- AC 5. El botón Filters indica que hay un filtro activo, como en Positions. Un resultado vacío dice "No accounts match the filters".
- AC 6. En escritorio la tabla tiene una columna "Trades / Orders" con el número de posiciones abiertas y de órdenes pendientes de la cuenta (p. ej. "3 / 1"), ordenable por el número de posiciones.
- AC 7. En el móvil la tarjeta de la cuenta muestra "Trades / Orders" en lugar de "Number"; el número pasa a los detalles desplegados.
- AC 8. Los contadores siguen a las posiciones y órdenes en vivo (cambian cuando se abre o cierra una posición, o se pone o cancela una orden) y respetan la visibilidad (los símbolos ocultos no cuentan).
- AC 9. Los brokers ocultos (Settings › Visibility) siguen ocultos, como hoy.

## Fuera de alcance
- Contadores de operaciones cerradas (History).
- Usar el color de la cuenta en otros sitios (gráficos, estadísticas, otras pestañas).
- Filtros por otros campos (balance, P&L…).
