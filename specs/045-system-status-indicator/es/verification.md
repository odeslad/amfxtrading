# 045 — Indicador de estado del sistema · Verificación

## Tarea 1 — [backend] Liveness guarda la hora de pérdida del pipe y el estado del EA

- **Mecanismo:** vitest + `npm run build`
- **Comandos:** `npx vitest run src/store/liveness.test.ts src/bridge/pipe-reader.test.ts` · `npm run build` · `npx vitest run`
- **Resultado:** ✅ pasa
- **Evidencia:** 13 tests pasan en los dos ficheros (estado del EA guardado y validado, mensaje del pipe de tipo desconocido ignorado sin aviso, hora de pérdida del pipe puesta en la primera pérdida, mantenida entre `listening` → `error` y borrada al reconectar, estado del EA olvidado junto con el pipe); `tsc` limpio; suite completa 165 tests en 18 ficheros.
- **Notas:** un broker con el pipe activado cuenta como perdido desde el arranque del backend hasta que su EA conecta. `GET /health` devuelve los mismos campos que antes.
- **Est vs Actual:** 1 SP vs 0,75 SP
