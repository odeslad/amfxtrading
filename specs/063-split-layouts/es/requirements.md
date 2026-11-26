# 063 — Configuraciones de split

> Status: **approved**

## Contexto
La vista split del gráfico (spec 036, gráficos desenlazados desde la spec 060) se monta a mano cada vez: el broker, el par y la temporalidad de cada gráfico. El operador usa dos o tres montajes que se repiten. Esta spec los guarda como configuraciones de split con nombre, que se editan en Settings y se aplican desde un botón del gráfico que abre un panel lateral a la derecha, como los demás paneles del gráfico.

## Capas afectadas
- db · backend · frontend

## Historias de usuario
- Como trader, quiero guardar unas pocas configuraciones de split con nombre (broker, par y temporalidad de cada gráfico), para no montarlas a mano.
- Como trader, quiero aplicar una desde un botón del gráfico, para cambiar entre mis montajes habituales con un clic.

## Criterios de aceptación
- AC 1. CUANDO el usuario abre Settings › Display ENTONCES una sección "Split layouts" lista sus configuraciones y le permite crear, renombrar, editar y borrar una.
- AC 2. CUANDO se crea o edita una configuración ENTONCES guarda un nombre y, para el gráfico izquierdo y el derecho, un broker, un par y una temporalidad.
- AC 3. CUANDO se muestra el gráfico en escritorio ENTONCES hay siempre visible un botón de configuraciones de split en la barra del gráfico; en móvil, donde no existe la vista split, no aparece.
- AC 4. CUANDO el usuario pulsa el botón ENTONCES se abre un panel lateral a la derecha, como los demás paneles del gráfico, con la lista de configuraciones; si no hay ninguna, lo dice y remite a Settings › Display.
- AC 5. CUANDO el usuario elige una configuración ENTONCES los dos gráficos toman sus brokers, pares y temporalidades, el ancho entre los gráficos se mantiene como está, y el split se abre si estaba cerrado.
- AC 6. CUANDO una configuración usa el mismo broker y par en los dos lados ENTONCES los gráficos se aplican enlazados; si no, desenlazados.
- AC 7. CUANDO lo que muestran los gráficos coincide con una configuración ENTONCES el panel la marca como activa.
- AC 8. CUANDO una configuración usa un broker oculto en el frontend o un par apagado para su broker ENTONCES el panel la marca con un aviso y no se puede aplicar.
- AC 9. CUANDO cambian las configuraciones en Settings ENTONCES una página de gráfico abierta muestra el cambio sin recargar, también en otras pestañas y dispositivos del mismo usuario.
- AC 10. CUANDO el usuario entra desde otro dispositivo ENTONCES ve las mismas configuraciones (guardadas por usuario en la base de datos).

## Fuera de alcance
- Guardar la vista actual como configuración desde el panel del gráfico.
- Configuraciones para la vista de un solo gráfico.
- Atajos de teclado.
- El ancho entre los gráficos.
- Dibujos, indicadores o plantillas de medias dentro de una configuración.
