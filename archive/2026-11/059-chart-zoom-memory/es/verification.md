# 059 — Memoria del zoom del gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est vs Real |
|---|---|---|---|---|---|
| 1. Memoria + zoom horizontal | build + app local | `npm run build`; `eslint src/features/chart`; vite 5174 → `/chart` | ✅ | Build OK; lint limpio; el usuario lo comprobó en la app local ("funciona"). `zoomMemory.ts` guarda `chart.zoom` en localStorage (espaciado por temporalidad, alto de precios por par + temporalidad, ignorando valores fuera de rango y errores de almacenamiento); la carga del histórico aplica el espaciado guardado (6 px por defecto) y el manejador del rango guarda el nuevo espaciado 400 ms después del gesto | 1,5 / 0,5 SP |
| 2. Zoom vertical | build + app local | `npm run build`; `eslint src/features/chart`; vite 5174 → `/chart` | ✅ | Build OK; lint limpio; el usuario lo confirmó en la app local. Al terminar cada gesto (pointerup, touchend, doble clic, 400 ms tras la rueda; diferido para que actúen antes los manejadores de desplazamiento) una escala en manual guarda su alto visible para par + temporalidad y una en automático lo olvida; el botón de ajustar precio también lo olvida (no estaba en el diseño, coherente con él); al cargar un histórico con alto guardado la escala se abre en manual alrededor del último cierre | 1,5 / 0,5 SP |
| 3. Validación en producción | manual (usuario) | push de `master` (`ecb39b7..1cbb649`), despliegue del frontend (build 327) | ✅ | El usuario lo validó en producción | 0,5 / 0,25 SP |
| 4. Cierre | build | `npm run build` | ✅ | Build OK; spec cerrada y archivada en `archive/2026-11/` | 0,25 / 0,25 SP |

## Est vs Real

**Total**: 3,75 SP estimados · 1,5 SP reales. El gráfico ya tenía un único camino de carga del histórico y un manejador del rango, así que los dos zooms fueron añadidos pequeños; la estimación suponía más fontanería.

**Desviación**: el botón de ajustar precio también olvida el alto guardado (coherente con AC 4). **Fuera de la spec**: `7748cdb` el diario abre el gráfico en la última temporalidad (AC 7).
