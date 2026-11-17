# 046 — Comparación de rendimiento de los VPS · Diseño

## Enfoque

Los dos servidores ejecutan el código de `4e8022c` (EA 3.15, backend y frontend sin las specs 044 y 045) con sus 13 brokers, como en la operativa normal. No se para nada ni se reconfigura nada: la prueba solo lee. La misma medición se lanza en los dos servidores en el mismo momento, varias veces, y se comparan las cifras.

No cambia código de la aplicación. Los únicos ficheros nuevos son los scripts de medición en `infra/scripts/perf/`, copiados a mano a los dos servidores (el viejo ya no recibe despliegues).

### Alternativas consideradas

| Opción | A favor | En contra |
|---|---|---|
| **Los 13 brokers a la vez** (elegida) | Carga real; no se para ninguna cuenta; no se toca nada en los servidores; hecho en alrededor de una hora | La prueba de velocidad de la máquina se pasa con los servidores cargados, no en reposo |
| Solo Demo, y un broker más en cada paso | Velocidad de la máquina medida casi en reposo; enseña cómo se degrada cada servidor según crece la carga | Cuentas reales fuera de la app en los dos servidores durante la prueba; se edita la lista de brokers y se reinicia el backend en cada paso; varias horas |

La segunda opción queda disponible como decisión posterior si el resultado con todos los brokers no es concluyente.

## Qué se mide

Un solo script, `measure.ps1`, ejecutado en los dos servidores en el mismo momento, con una ventana de 60 segundos:

| Cifra | Cómo | Por qué |
|---|---|---|
| CPU total | Tiempo de CPU consumido por todos los procesos durante la ventana, sobre los 4 núcleos lógicos | El síntoma que ve el operador |
| CPU por proceso | Lo mismo, por terminal (con el nombre de su broker), backend, base de datos, antivirus y resto | Mismo broker, misma cuenta, mismos ticks en los dos servidores: el tiempo de CPU que necesita cada terminal para el mismo trabajo es la comparación más justa |
| Memoria libre | Lectura al principio y al final de la ventana | El punto débil del servidor viejo |
| Retraso de ticks | Se lee el `/health` local dos veces por segundo durante la ventana; por broker: porcentaje de lecturas en que el último tick tiene 1 segundo o más, y la peor lectura | Los ticks se envían cada 100 ms, así que con un servidor sano la antigüedad es siempre 0 |
| Velocidad de la máquina | `bench.js`: un cálculo fijo en un hilo (5 pasadas) y el mismo en 4 hilos a la vez | Un hilo = velocidad de un núcleo; cuatro a la vez = si los 4 núcleos están disponibles de verdad |

Dos límites, que el informe dirá:

- `/health` da la antigüedad del tick en segundos enteros, así que los retrasos de menos de un segundo no se ven. Basta para distinguir "los ticks llegan a tiempo" de "los ticks llegan tarde", que es el problema descrito.
- La prueba de velocidad se pasa mientras los 13 terminales trabajan. Con el mismo software y los mismos brokers la carga es la misma en los dos, así que la comparación sigue siendo justa, pero la cifra es "velocidad que queda para una tarea nueva", no "velocidad de una máquina vacía". La mejor de las 5 pasadas es la más cercana a la velocidad real de un núcleo.

### Diferencias que no son la máquina

Se anotan una vez en los dos servidores, porque pueden cambiar el resultado sin ser hardware: antivirus de Windows (en marcha en el servidor nuevo, ausente en la primera muestra del viejo), plan de energía de Windows, compilación de MT4, gráficos abiertos y barras guardadas por terminal, y otros programas abiertos en la sesión de escritorio. Una diferencia encontrada aquí se comunica; si se iguala y se vuelve a medir se decide con el operador.

El servidor viejo tiene las alertas apagadas (`FEATURE_ALERTS=false`) y nadie usa su app; el nuevo evalúa alertas y atiende a los usuarios. Esta diferencia es conocida y pequeña, y el informe la nombra.

## Secuencia

1. **Comprobación** (AC 1, AC 2): versión del EA cargada por cada terminal (su log), commit del backend, los 13 brokers conectados en los dos servidores.
2. **Diferencias** (AC 5): anotar la lista de arriba en los dos servidores.
3. **Mediciones** (AC 3, AC 4): al menos 3 rondas, separadas al menos 10 minutos, con el mercado abierto; cada ronda es `measure.ps1` en los dos servidores en el mismo momento y después `bench.js` en los dos.
4. Las cifras van a `verification.md` tras cada ronda.
5. **Informe** (AC 6, AC 7) en `reports/`.

## Cómo se llega al veredicto

- **Velocidad de la máquina**: si el servidor nuevo es claramente más lento en la prueba de velocidad en todas las rondas, la máquina es más lenta.
- **Mismo trabajo, CPU necesaria**: para cada broker, CPU de su terminal en el servidor nuevo dividida entre la misma en el viejo. Si esa proporción coincide con la de velocidad de la máquina, la máquina explica toda la diferencia. Si es claramente mayor, hay algo más en el servidor nuevo que cuesta CPU y se busca entre las diferencias anotadas.
- **Frente a la primera muestra**: con versiones distintas del EA, los 13 terminales necesitaban 3,3 veces más CPU en el servidor nuevo. La parte de eso que desaparezca con el mismo EA en los dos la causaba el software (EA 3.16, spec 044), y va a la lista de cambios a repasar.

El veredicto puede ser mixto (una máquina más lenta y un software más pesado); el informe dirá entonces cuánto viene de cada cosa.

## Ficheros

- `infra/scripts/perf/measure.ps1` — la medición de 60 segundos, con salida de una línea de JSON por ejecución.
- `infra/scripts/perf/bench.js` — la prueba de velocidad.
- `reports/2026-11-vps-performance.md` — el informe final.

Sin cambios en la base de datos. Sin dependencias nuevas. Sin cambios en el contrato EA ↔ backend.

## Riesgos

- **`master` se queda en el código antiguo** durante la prueba: no se puede subir nada a `ea/`, `backend/` ni `frontend/` hasta el veredicto, o los dos servidores dejan de ser iguales. Los usuarios de la app no tienen mientras tanto el indicador de estado del sistema (spec 045).
- **La prueba de velocidad añade carga** durante unos segundos (hasta 4 hilos) en servidores que están trabajando, el nuevo ya cerca de su límite: los ticks pueden llegar tarde esos segundos. En el servidor viejo, con su historial de caídas con picos de memoria, la prueba casi no usa memoria.
- **Una muestra no es una medición**: la actividad del mercado cambia minuto a minuto. Por eso los dos servidores se miden en el mismo momento y al menos tres veces.
