# 062 — Grupos de entradas mirror

> Status: **closed**

## Contexto
Una entrada lanzada con un mirror preset (New Trade, o las órdenes rápidas del menú del gráfico con un mirror preset seleccionado) envía un comando por cada broker del preset. Hoy las posiciones y órdenes resultantes son independientes: cambiar SL, TP o precio de la orden, o cerrarlas, se hace broker a broker. Esta spec las asocia al crearse en un grupo, marca el grupo con una estrella de color y hace que un cambio se aplique a todo el grupo.

## Capas afectadas
- backend · db · frontend

## Historias de usuario
- Como trader, quiero que las entradas de una misma orden mirror queden asociadas, para ver de un vistazo qué posiciones y órdenes van juntas.
- Como trader, quiero cambiar SL, TP o el precio de una orden pendiente de una entrada y que el mismo cambio se aplique a todas las de su grupo, para gestionar la operación mirror una sola vez.
- Como trader, quiero sacar una entrada de su grupo, para gestionarla sola.

## Criterios de aceptación
- AC 1. CUANDO se envía una entrada con un mirror preset (New Trade u orden rápida) a dos o más brokers ENTONCES las posiciones/órdenes resultantes forman un grupo.
- AC 2. CUANDO se crea un grupo ENTONCES recibe automáticamente un color de estrella de una paleta fija, distinto del de los demás grupos abiertos mientras la paleta lo permita.
- AC 3. CUANDO una posición u orden pertenece a un grupo ENTONCES aparece una estrella del color del grupo en su columna de broker en Positions y Orders (tabla en escritorio y tarjeta en móvil).
- AC 4. CUANDO el usuario cambia el SL, el TP o el precio pendiente de una entrada agrupada ENTONCES se envía el mismo precio absoluto a todas las demás entradas abiertas del grupo.
- AC 5. CUANDO el usuario quita el SL o el TP de una entrada agrupada ENTONCES se quita en todas las demás del grupo.
- AC 6. CUANDO el usuario cierra una posición agrupada o cancela una orden agrupada ENTONCES se cierran/cancelan todas las demás del grupo.
- AC 7. CUANDO un cambio falla en uno o más brokers ENTONCES se avisa al usuario de qué broker ha fallado y las entradas en las que funcionó conservan el cambio (sin deshacer).
- AC 8. CUANDO unas órdenes pendientes de un grupo se ejecutan y otras no ENTONCES el grupo se parte en dos: las órdenes que siguen pendientes conservan su grupo y su estrella, y las posiciones ejecutadas forman un grupo propio con otro color, al que se suman las siguientes ejecuciones del mismo grupo. Un grupo nunca mezcla posiciones y órdenes pendientes, así que editar, cerrar o cancelar nunca pasa de unas a otras. *(Cambiado el 2026-11-26 durante la validación: decía "la posición resultante conserva el grupo y la estrella".)*
- AC 9. CUANDO una entrada del grupo se cierra por su cuenta (salta SL/TP, cierre manual fuera de la app) ENTONCES las demás siguen agrupadas.
- AC 10. CUANDO el usuario saca una entrada de su grupo ENTONCES desaparece su estrella y los cambios posteriores dejan de propagarse entre ella y el grupo.
- AC 11. CUANDO solo queda una entrada abierta de un grupo ENTONCES no muestra estrella (un grupo de uno no es grupo).
- AC 12. CUANDO el backend se reinicia ENTONCES los grupos existentes se conservan.

## Fuera de alcance
- Agrupar entradas a mano después de crearlas, o unir grupos.
- Propagar por distancia en pips en lugar del mismo precio.
- Cambiar lotes / cierres parciales en todo el grupo.
- Entradas lanzadas directamente en MT4.
