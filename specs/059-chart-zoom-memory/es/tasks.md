# 059 — Memoria del zoom del gráfico · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: solo frontend.

- [x] 1. [frontend] `zoomMemory.ts` (leer / guardar el espaciado por temporalidad y el alto de precios por par + temporalidad, ignorando valores fuera de rango y errores de almacenamiento) y el zoom horizontal en `LightweightChart`: aplicarlo al cargar el histórico y guardarlo al cambiar el rango tras una pausa de 400 ms · **Verifica:** `npm run build` + app local: zoom distinto en M5 y H1, cambiar de temporalidad y de par, recargar, abrir desde el diario → cada temporalidad se abre con su zoom; sin nada guardado → 6 px como hoy; cargar velas antiguas conserva el zoom · **Est:** 1,5 SP
- [ ] 2. [frontend] Zoom vertical: guardar el alto de precios visible al terminar cada interacción mientras la escala esté en manual, olvidarlo al volver a automático y aplicarlo centrado en el último cierre tras cargar el histórico · **Verifica:** `npm run build` + app local: estirar la escala en EURUSD H1, recargar → mismo alto alrededor del precio; USDJPY H1 sigue en automático; doble clic en el eje de precios → automático y al recargar sigue en automático; el gráfico partido lo comparte · **Est:** 1,5 SP
- [ ] 3. [infra] Push de `master`, desplegar el frontend cuando lo pida el usuario y **validar en producción**: zoom horizontal por temporalidad, alto vertical por par y temporalidad, vuelta a automático con doble clic, los dos lados del gráfico partido, abrir desde el diario · **Verifica:** manual (validación del usuario) · **Est:** 0,5 SP
- [ ] 4. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` (o el mes de cierre) · **Verifica:** manual · **Est:** 0,25 SP

**Estimación total**: 3,75 SP
