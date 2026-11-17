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

## Tarea 4 — [backend] Entrega del estado del sistema

- **Mecanismo:** vitest + `npm run build` + manual
- **Comandos:** `npx vitest run src/routes/status.test.ts` (también sin `DATABASE_URL`, `JWT_SECRET` ni `BROKERS_FILE`, como en CI) · `npm run lint` · `npx tsc --noEmit` · `npx vitest run` · un script de 20 s que imprime `cpuPercent` cada 5 s junto al contador del propio Windows (`Win32_PerfFormattedData_PerfOS_Processor`, `_Total`)
- **Resultado:** ✅ pasa (parte automática y comparación de CPU) · 🕐 el backend local en marcha se comprueba en la tarea 6
- **Evidencia:** 3 tests pasan sobre un servidor HTTP real (401 sin cookie; con cookie el objeto trae `level`, `server`, `brokers`, `at`, el broker visible y no el oculto; la ruta sirve la última muestra tomada); lint y `tsc` limpios; suite completa 188 de 189: el único fallo es el ya conocido test inestable `pipe-reader.test.ts` (pipe real con esperas de 80 ms, falla con carga en paralelo, se salta en CI), que pasa solo tres veces seguidas. CPU: backend 72 % en cuatro muestras seguidas, Windows 71 %; memoria libre 32.304 MB frente a los 32.298 MB de Windows.
- **Desviación:** la tarea pedía ver `/status` en un backend local con los flags apagados. Eso requiere el túnel de la base de datos y todo el stack local, que la tarea 6 arranca de todos modos para comprobar la luz, así que se verifica allí. El test de la ruta monta el router con la comprobación de sesión real en lugar de importar `app.ts`, porque `app.ts` necesita el entorno del servidor que CI no tiene.
- **Est vs Actual:** 1,25 SP vs 1,25 SP

## Tarea 5 — [frontend] `--muted-strong` y `useSystemStatus`

- **Mecanismo:** `npm run build`
- **Comandos:** `npm run build` · `npm run lint`
- **Resultado:** ✅ pasa
- **Evidencia:** build y lint limpios.
- **Notas:** ninguna pantalla usa aún el hook (tarea 6). La pérdida de conexión se decide solo por el silencio: ningún mensaje `system` ni respuesta de `/status` en 20 s — un WebSocket cerrado queda cubierto por la misma regla, así que `lib/ws.ts` no se toca.
- **Est vs Actual:** 0,75 SP vs 0,5 SP

## Tarea 6 — [frontend] Luz y tooltip en el footer

- **Mecanismo:** `npm run build` + manual
- **Comandos:** `npm run build` · `npm run lint` (frontend) · `npx vitest run src/services/system-status.test.ts src/routes/status.test.ts` · `npx tsc --noEmit` · `npm run lint` (backend) · stack local: túnel de base de datos en 5434, backend en 3001 con `FEATURE_PIPE=true` y cinco brokers de prueba, Vite en 5175, cuatro terminales simulados escribiendo en los pipes
- **Resultado:** ✅ build, lint y tests de backend · ✅ `/status` en el backend local en marcha (pendiente de la tarea 4) · ✅ el aspecto de la luz y del tooltip, revisado por el usuario en la app local (estado rojo: punto cuadrado, broker desconectado primero, "Loading history · 38 of 75", retrasos de ticks)
- **Evidencia:** build y lint del frontend limpios; backend 19 tests pasan, `tsc` y lint limpios. Backend local: `GET /status` responde 401 sin cookie y, con sesión, `warn` con `local-darwinex` y `local-axi` conectados, `local-demo` cargando "2 of 75", `local-ftmo` reiniciando (70 s sin pipe) y `local-solidary` conectado con 11 s de retraso de ticks; el mismo objeto se sirve a través del proxy de Vite.
- **Desviaciones del diseño, acordadas aquí:**
  - Backend: cada broker lleva ahora su propio `level` (`ok` / `warn` / `bad`), para que el frontend sepa qué brokers requieren atención sin repetir los umbrales. Commit de backend aparte; diseño y documento de arquitectura actualizados.
  - La cifra de CPU no se tiñe (en la pantalla naranja de la maqueta sí): teñirla exigiría tener los umbrales de CPU en el frontend.
  - Un broker sin pipe muestra "—" como retraso de ticks, y el tiempo que lleva caído va en su etiqueta de estado ("Restarting · 38 s").
  - Un broker conectado con ticks atrasados pone "Connected · ticks delayed", añadido tras la revisión del usuario.
- **Notas:** en la app local la cookie de sesión de producción (`Domain=.amfxtrading.com`) también se envía a `local.amfxtrading.com` y el backend local la rechaza: iniciar sesión desde una ventana privada.
- **Est vs Actual:** 2 SP vs 2,25 SP

## Tarea 7 — [frontend] Móvil: luz en la cabecera y panel inferior

- **Mecanismo:** `npm run build` + manual a 390 px de ancho
- **Comandos:** `npm run build` · `npm run lint`
- **Resultado:** ✅ build y lint · ✅ el aspecto en móvil, aceptado por el usuario en la app local
- **Evidencia:** build y lint limpios.
- **Notas:** el estado se lee una sola vez en `AppLayout` y se pasa a la luz del footer y a la de la cabecera, así que ambas muestran lo mismo y solo se hace una petición. El panel se cierra con ✕, tocando fuera de él y con Escape.
- **Est vs Actual:** 1 SP vs 0,75 SP
