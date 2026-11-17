# 045 — Indicador de estado del sistema

> Status: **draft**

## Contexto

La app no tiene ningún sitio que diga si el sistema que hay detrás está sano. El 2026-11-17, tras un deploy del EA, los terminales pasaron unos doce minutos recargando su histórico de velas y los ticks de los brokers que exportan 15 símbolos llegaron con entre 4 y 21 segundos de retraso; nada en la app lo mostraba. El backend ya conoce parte del cuadro (`GET /health`: por broker, estado del pipe y antigüedad del último tick y de la última sincronización de ficheros), pero no se muestra en ningún sitio, no incluye la carga del servidor y no sabe que un terminal está cargando histórico. El footer de la app hoy solo muestra el nombre del producto y los números de build.

## Capas afectadas

- backend
- frontend
- ea

## Historias de usuario

- Como operador, quiero una lucecita en el footer que esté verde, naranja o roja, para saber de un vistazo si puedo fiarme de lo que la app muestra ahora mismo.
- Como operador, quiero ver por qué no está verde al pasar el ratón por encima (o al tocarla en el móvil), para saber si tengo que esperar y a qué.
- Como operador, quiero que los brokers que tengo ocultos en Settings queden fuera de esa luz, para que una cuenta que mantengo apagada no la deje naranja para siempre.

## Criterios de aceptación

- AC 1. CUANDO la app está abierta ENTONCES el footer muestra una luz de estado, y en móvil, donde el footer no se ve, la misma luz es accesible desde el layout que sí se ve.
- AC 2. CUANDO todo es normal ENTONCES la luz está **verde**: el backend responde, todos los brokers visibles están conectados, sus ticks están al día, ningún terminal está cargando histórico y el servidor no está bajo presión.
- AC 3. CUANDO el sistema funciona pero algo está degradado ENTONCES la luz está **naranja**: un terminal se está reiniciando o cargando su histórico, los ticks de un broker visible llegan con retraso, o la CPU o la memoria del servidor se mantienen por encima de su nivel de aviso.
- AC 4. CUANDO lo que la app muestra no es fiable ENTONCES la luz está **roja**: la app ha perdido la conexión con el backend, un broker visible lleva desconectado más de un periodo de gracia, los ticks de un broker visible van muy atrasados, o el servidor está por encima de su nivel crítico.
- AC 5. CUANDO el usuario pasa el ratón por la luz (escritorio) o la toca (móvil) ENTONCES un tooltip muestra, en palabras llanas: una línea con la situación general y su causa, la CPU y la memoria libre del servidor, y por cada broker visible su estado (conectado, cargando histórico con su progreso, reiniciando, desconectado) y el retraso de sus ticks.
- AC 6. CUANDO un terminal está cargando su histórico de velas ENTONCES el tooltip muestra por dónde va ("42 de 75") y la luz sigue naranja hasta que termina.
- AC 7. CUANDO un broker está oculto en Settings (`hiddenBrokers`) ENTONCES no cuenta para el color ni aparece en el tooltip.
- AC 8. CUANDO el mercado está cerrado ENTONCES la luz sigue verde mientras los terminales estén conectados: que los precios no se muevan no es un fallo.
- AC 9. CUANDO la situación cambia ENTONCES la luz y el tooltip la siguen en menos de diez segundos, sin recargar la página, y un pico breve (una sola muestra) no cambia el color.
- AC 10. CUANDO el estado se recoge y se envía ENTONCES el coste es despreciable: sin efecto visible en la entrega de ticks, en el pintado del gráfico ni en la carga del servidor.
- AC 11. CUANDO haya que ajustar los umbrales ENTONCES viven en un solo sitio del backend, documentados, no repartidos por el código.

## Fuera de alcance

- Eliminar el retraso de ticks mientras un terminal carga su histórico (que el EA escriba los históricos completos en trozos pequeños). La luz lo hace visible; arreglarlo es otra spec.
- Notificaciones o alertas cuando cambia el estado.
- Un historial o gráfica de estados pasados.
- Mostrar el estado del VPS antiguo.
- Cualquier acción desde el tooltip (reiniciar un terminal, etc.).
