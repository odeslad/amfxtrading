# 046 — Comparación de rendimiento de los VPS

> Status: **draft**
> Relacionada: [043 · Migración de VPS](../../043-vps-migration/es/requirements.md)

## Contexto

El VPS viejo (4 vCPU, 4 GB de RAM, 120 GB de disco) sufría desbordamientos de memoria y reinicios arbitrarios, lo que obligó a cambiar a uno nuevo (4 vCPU, 8 GB de RAM, 240 GB de disco). Tras la migración, el servidor nuevo rinde peor que el viejo: la CPU va saturada y los ticks llegan con retraso, a pesar de tener el mismo número de procesadores, el doble de memoria y el doble de disco. En el momento de la migración los dos servidores no llevaban el mismo software (el nuevo llevaba además las specs 044 y 045), así que hoy no se puede saber si la causa es la máquina o el software. Esta spec pone el mismo software y la misma carga en los dos servidores (los 13 brokers a la vez, como en la operativa normal) y los mide en paralelo, para llegar a un veredicto: el servidor (reclamación a IONOS) o el software (repaso de los cambios).

Primeras mediciones tomadas el 2026-11-17, antes de igualar el software (una muestra de 10 segundos, 13 terminales en cada servidor):

| | VPS nuevo | VPS viejo |
|---|---|---|
| Procesador | 4 núcleos lógicos, 2000 MHz declarados | 4 núcleos lógicos, 2596 MHz declarados |
| CPU total en uso | 66 % | 29 % |
| 13 terminales MT4 (100 = un núcleo entero) | 196 | 60 |
| Backend | 28 | 17 |
| Antivirus de Windows | 7,5 | no aparece |
| Prueba de velocidad de un hilo (menos es mejor) | 1441 ms (servidor con carga) | 1034 ms |

Ya hecho el 2026-11-17: el código del servidor viejo (`4e8022c`: EA 3.15, backend y frontend sin las specs 044 y 045) se restauró en `master` (commits `56f7180`, `8ec9d22`, `89adb64`) y se desplegó en el servidor nuevo.

## Capas afectadas

- infra (scripts de medición, el informe final)
- ea · backend · frontend: solo la vuelta atrás ya hecha; sin código nuevo

## Historias de usuario

- Como operador, quiero que los dos servidores ejecuten exactamente el mismo EA, backend y frontend, para que cualquier diferencia de rendimiento solo pueda venir de la máquina.
- Como operador, quiero que la prueba se haga con todos los brokers en marcha a la vez en los dos servidores, para que refleje la carga real y no haya que parar ninguna cuenta.
- Como operador, quiero que se tomen las mismas mediciones de la misma manera y en el mismo momento en los dos servidores, para que la comparación sea justa y repetible.
- Como operador, quiero un veredicto por escrito con las cifras, para reclamar a IONOS con pruebas o saber que hay que repasar el software.

## Criterios de aceptación

- AC 1. CUANDO empieza la prueba ENTONCES los dos servidores ejecutan la misma versión del EA, el mismo código de backend y el mismo código de frontend, y esto se comprueba en los propios servidores (versión del EA cargada por cada terminal, commit del backend), no se da por supuesto.
- AC 2. CUANDO empieza la prueba ENTONCES los dos servidores tienen los mismos 13 brokers en marcha y conectados, con las mismas cuentas, y esto se comprueba con la salud de cada broker.
- AC 3. CUANDO se toma una medición ENTONCES se registran las mismas cifras en los dos servidores durante la misma ventana de tiempo: CPU total, CPU por proceso (cada terminal con su broker, backend, base de datos, antivirus), memoria libre, retraso de ticks por broker y la prueba de velocidad de la máquina.
- AC 4. CUANDO se toma una medición ENTONCES se repite al menos tres veces en momentos distintos con el mercado abierto, y el informe muestra todas las lecturas, no solo la media.
- AC 5. CUANDO se comparan los servidores ENTONCES se anotan también las diferencias que no son hardware (antivirus, plan de energía de Windows, compilación de MT4, gráficos abiertos y barras guardadas por terminal, otros programas abiertos), para no confundirlas con una máquina más lenta.
- AC 6. CUANDO las mediciones están hechas ENTONCES un informe en `reports/` contiene todas las cifras, los dos servidores lado a lado, y un veredicto: con el mismo software y la misma carga, el servidor nuevo es más lento (prueba para IONOS), igual o más rápido (la causa es el software).
- AC 7. CUANDO el veredicto es "software" ENTONCES el informe enumera los cambios hechos desde `4e8022c` que pueden afectar al rendimiento, como punto de partida de una spec posterior.
- AC 8. MIENTRAS dura la prueba ENTONCES no se para ninguna cuenta en ningún servidor y la app sigue funcionando con normalidad en el nuevo; no se sube nada a `ea/`, `backend/` ni `frontend/`, para que los dos servidores sigan siendo iguales.

## Fuera de alcance

- Pruebas con menos brokers (uno solo, o añadiéndolos de uno en uno): solo si el resultado con todos no es concluyente, como decisión posterior.
- Arreglar cualquier problema de rendimiento que se encuentre en el software (spec posterior).
- Volver a poner las specs 044 y 045 en `master` (se decide tras el veredicto).
- La reclamación a IONOS en sí; esta spec solo produce las pruebas.
- Cambios en el plan de hardware o cambio de proveedor.
- Dar de baja el servidor viejo (spec 043).
