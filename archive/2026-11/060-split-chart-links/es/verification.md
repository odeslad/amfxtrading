# 060 — Enlaces del gráfico partido · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est vs Real |
|---|---|---|---|---|---|
| 1. Broker y par del lado derecho, un enlace | build + app local | `npm run build`; `eslint src/features/chart src/shared/ui`; vite 5174 → `/chart` | ✅ | Build OK; lint limpio; el usuario lo comprobó en la app local. `SplitState` gana `linked` / `rightBroker` / `rightSymbol`; el lado derecho se deriva mientras está enlazado; desenlazar conserva lo que muestra; `useChartSymbols` carga los pares del broker derecho; posiciones de todos los brokers para que cada lado muestre las suyas; alertas y acciones de posición por lado; aviso "BROKER does not offer PAIR". **Desviaciones acordadas con el usuario**: los selectores de broker / par se ven siempre en escritorio (antes en escritorio solo se elegían en el panel de filtros), los botones de temporalidad pasan a un desplegable junto a ellos, el botón de enlace va tras el embudo, un gráfico más estrecho que su barra pliega las herramientas de dibujo tras Draw y encoge los selectores (… solo cuando no hay sitio), y el panel de filtros ya edita el lado que lo abrió (previsto para la tarea 2). Maqueta actualizada | 2,5 / 1,5 SP |
| 2. Paneles por lado | build + app local | `npm run build`; `eslint src/features/chart`; vite 5174 → `/chart` | ✅ | Build OK; lint limpio; el usuario pidió seguir. `panelSide` lo fijan los callbacks de indicadores, alertas y New Trade de cada lado; los paneles toman el broker y par de ese lado (indicadores: la plantilla de su broker; alertas: su par, lista y último bid, con los dos pares suscritos a ticks; New Trade: su broker, par y temporalidad) | 1,5 / 0,5 SP |
| 3. Validación en producción | manual (usuario) | push de `master` (`1cbb649..57ac613`), despliegue del frontend (build 329) | ✅ | El usuario lo validó en producción | 0,5 / 0,25 SP |
| 4. Cierre | build | `npm run build` | ✅ | Build OK; spec cerrada y archivada en `archive/2026-11/` | 0,25 / 0,25 SP |

## Est vs Real

**Total**: 4,75 SP estimados · 2,5 SP reales. Cada `ChartSlot` ya cargaba todo desde su propio broker y par, así que el trabajo se quedó en `ChartPage`; la mayor parte del tiempo fue la barra de herramientas, que no estaba en la estimación.

**Desviaciones acordadas con el usuario**: un solo enlace para broker y par (el primer borrador tenía dos); selectores siempre visibles en escritorio; temporalidad en desplegable; la barra se mide y pliega las herramientas de dibujo tras Draw solo cuando no cabe; el panel de filtros edita su lado (pasó de la tarea 2 a la 1).
