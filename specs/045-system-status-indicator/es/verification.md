# 045 — Indicador de estado del sistema · Verificación

## Tarea 1 — [backend] Liveness guarda la hora de pérdida del pipe y el estado del EA

- **Mecanismo:** vitest + `npm run build`
- **Comandos:** `npx vitest run src/store/liveness.test.ts src/bridge/pipe-reader.test.ts` · `npm run build` · `npx vitest run`
- **Resultado:** ✅ pasa
- **Evidencia:** 13 tests pasan en los dos ficheros (estado del EA guardado y validado, mensaje del pipe de tipo desconocido ignorado sin aviso, hora de pérdida del pipe puesta en la primera pérdida, mantenida entre `listening` → `error` y borrada al reconectar, estado del EA olvidado junto con el pipe); `tsc` limpio; suite completa 165 tests en 18 ficheros.
- **Notas:** un broker con el pipe activado cuenta como perdido desde el arranque del backend hasta que su EA conecta. `GET /health` devuelve los mismos campos que antes.
- **Est vs Actual:** 1 SP vs 0,75 SP

## Tarea 2 — [backend] Lecturas de carga del servidor

- **Mecanismo:** vitest + `npm run build`
- **Comandos:** `npx vitest run src/services/server-load.test.ts` · `npm run build`
- **Resultado:** ✅ pasa
- **Evidencia:** 5 tests pasan (porcentaje con dos lecturas fabricadas, límites 0–100 con contadores incoherentes, sin cifra cuando no ha pasado tiempo, lecturas reales de esta máquina coherentes); `tsc` limpio.
- **Notas:** la comparación con el Administrador de tareas forma parte de la tarea 4, cuando la cifra se expone por primera vez.
- **Est vs Actual:** 0,75 SP vs 0,5 SP

## Tarea 3 — [backend] Reducción a un nivel

- **Mecanismo:** vitest + `npm run build`
- **Comandos:** `npx vitest run src/services/system-status.test.ts` · `npm run build`
- **Resultado:** ✅ pasa
- **Evidencia:** 16 tests pasan: los cuatro estados de broker, un caso por fila de la tabla de niveles (estado del broker, retraso de ticks 5 s / 60 s, CPU 85 % en 15 s / 95 % en 60 s, memoria libre 10 % / 5 %), gana la peor regla, un pico suelto no cambia el nivel en ningún sentido, el nivel cambia tras dos muestras, un broker oculto queda fuera del nivel y de la lista; `tsc` limpio.
- **Notas:** todos los umbrales están en la constante `THRESHOLDS`. La regla de las dos muestras se aplica al nivel; la lista de brokers muestra siempre el estado actual. Una media de CPU solo cuenta cuando se ha muestreado su ventana entera.
- **Est vs Actual:** 1,5 SP vs 1 SP
