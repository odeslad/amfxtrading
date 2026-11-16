# 044 — MT4 como fuente completa y única de velas · Verificación

## Tarea 1 — Vela de cambio de barra solo desde una barra en curso

- **Mecanismo:** vitest + `npm run build` (más `npm run lint` y la batería completa).
- **Resultado:** ✅ pasa (2026-11-16)
- **Evidencia:**
  - `services/candle-close.ts`: el snapshot guarda `serverNow = tick.time + tick.broker_offset × 1000`; solo se emite una vela cuando `time <= serverNow < time + 2 × periodo` y `low <= bid <= high`.
  - `npx vitest run src/services/candle-close.test.ts`: pasan 8 tests. Los 4 que había no cambian (cambio de barra normal, varias temporalidades a la vez, brokers y símbolos separados, hora de barra ausente). Nuevos: una barra atrasada del 20 de octubre que llega con la hora de servidor del 16 de noviembre no emite nada; un bid fuera del rango de la barra no emite nada; una barra cuyo símbolo siguió sin cotizar al entrar en el periodo siguiente se sigue cerrando; la última barra H1 del viernes se cierra en la apertura del lunes con el reloj del servidor parado durante el fin de semana.
  - `npm run build` y `npm run lint` limpios; `npm test`: 17 ficheros, 150 tests pasan.
- **Desviación respecto al primer borrador del diseño:** la ventana es de dos periodos, no de uno. Con un periodo, un símbolo sin cotización en el primer segundo de una barra nueva perdería su vela de cambio de barra en casi todas las barras (el reloj del servidor es común a todos los símbolos). El diseño se ha actualizado.
- **Aún sin probar:** el comportamiento en terminales reales — tarea 7.
- **Est vs Actual:** 1,5 SP vs 1 SP.
