# 054 — UX del gráfico: menú contextual, órdenes rápidas y paneles laterales

> Estado: **cerrado**

## Contexto
Meter una orden desde el gráfico obliga a abrir New Trade con el botón "+ New Trade" y escribir todos los precios a mano. Los paneles de la derecha (New Trade, edición de posición, alertas, indicadores, filtros) son capas fijas con un velo oscuro que tapan la parte derecha del gráfico, incluidas las últimas velas y la escala de precios. Encima del gráfico, arriba a la derecha, hay tres botones flotantes ("+ New Trade", "Delete" para el dibujo seleccionado, "Clear all" para los dibujos). No hay menú contextual, clic derecho ni pulsación larga en ningún sitio del gráfico.

## Capas afectadas
- frontend · backend · db (la configuración de órdenes rápidas se guarda por usuario, como el resto de Settings, para que sea la misma en todos los dispositivos)

## Historias de usuario
- Como operador, quiero hacer clic derecho (pulsación larga en el móvil) en el gráfico y tener las acciones de ese punto, para no buscar botones.
- Como operador, quiero poner una orden de compra o venta en el precio que he pulsado, para no escribir el precio de entrada.
- Como operador, quiero órdenes rápidas de compra/venta en el menú, enviadas con el tamaño y los stops configurados una vez en Settings, para entrar en un par de clics.
- Como operador, quiero que el gráfico se vea entero mientras hay un panel lateral abierto, para ver el precio y los niveles que estoy poniendo.

## Criterios de aceptación
- AC 1. CUANDO hago clic derecho en el área del gráfico (escritorio) o mantengo pulsado ~0,5 s sin moverme (móvil) ENTONCES se abre un menú contextual en ese punto que muestra el precio bajo el puntero; no aparece el menú del navegador.
- AC 2. El menú se cierra con Esc, con un clic o toque fuera, al elegir una opción y cuando el gráfico se desplaza o hace zoom; siempre cabe dentro de la pantalla.
- AC 3. CUANDO elijo "Buy at <precio>" o "Sell at <precio>" ENTONCES se abre New Trade con el broker, símbolo y temporalidad del gráfico, el sentido y ese precio como entrada; el tipo de orden sigue al mercado: una compra por debajo del ask es buy limit y por encima buy stop; una venta por encima del bid es sell limit y por debajo sell stop.
- AC 4. CUANDO elijo "New trade" ENTONCES se abre New Trade como hoy con el botón "+ New Trade" (orden a mercado, sin precio).
- AC 5. CUANDO elijo "Price alert at <precio>" ENTONCES se crea una alerta de precio en ese precio para el broker y símbolo del gráfico, por encima o por debajo del bid actual según corresponda, y se dibuja en el gráfico.
- AC 6. CUANDO abro el menú sobre una línea de una posición u orden pendiente (entrada, SL o TP) ENTONCES el menú añade sus acciones: Editar (abre el panel de edición), Cerrar / Cancelar orden, Quitar SL, Quitar TP (solo las que existan). Se ocultan con el gráfico bloqueado.
- AC 7. CUANDO abro el menú sobre un dibujo ENTONCES ofrece "Borrar dibujo"; el menú ofrece "Borrar todos los dibujos" (con confirmación) siempre que el gráfico tenga dibujos.
- AC 8. Se quitan del gráfico los botones flotantes "+ New Trade", "Delete" y "Clear all"; la tecla Supr/Retroceso sigue borrando el dibujo seleccionado.
- AC 9. Settings tiene una sección "Quick orders" con una configuración: tamaño (lotes fijos o % de riesgo, obligatorio), SL en pips (opcional), TP en pips o como múltiplo R del SL (opcional, R solo con SL) y un mirror preset opcional. El % de riesgo exige SL.
- AC 10. CUANDO las órdenes rápidas están configuradas ENTONCES el menú ofrece "Quick buy" / "Quick sell" a mercado y "Quick buy at <precio>" / "Quick sell at <precio>" en el precio pulsado (limit o stop como en AC 3).
- AC 11. CUANDO elijo una orden rápida ENTONCES una confirmación corta muestra broker(s), tipo, tamaño, entrada, SL y TP; al Confirmar se envía como la enviaría New Trade (al broker del gráfico o a los brokers del mirror preset) y el resultado llega como hoy; al Cancelar no se envía nada.
- AC 12. CUANDO las órdenes rápidas no están configuradas, o el gráfico está bloqueado, ENTONCES no se muestran sus opciones.
- AC 13. CUANDO New Trade o el panel de edición de posición están abiertos en escritorio ENTONCES el gráfico se estrecha a la izquierda del panel, sin velo, y sigue siendo usable (desplazar, zoom, dibujar, arrastrar SL/TP); al cerrarlo vuelve a todo el ancho. Con la vista partida, los dos gráficos se reparten el ancho que queda.
- AC 14. CUANDO esos paneles se abren en el móvil ENTONCES salen como hoja inferior de media pantalla aproximadamente y el gráfico sigue visible encima.
- AC 15. La pulsación larga no rompe los gestos actuales: desplazar, pellizcar para hacer zoom, dibujar, arrastrar niveles y el doble toque sobre dibujos y etiquetas de posiciones.
- AC 16. Los paneles de alertas, indicadores y filtros siguen como hoy.

## Fuera de alcance
- Líneas provisionales de entrada/SL/TP para arrastrar antes de enviar una orden.
- Arrastrar el precio de una orden pendiente.
- Atajos de teclado.
- Herramientas de dibujo y opciones de vista en el menú.
- Cambios en los paneles de alertas, indicadores y filtros.
- Cambios en el EA; en el backend, solo guardar la configuración de órdenes rápidas.
