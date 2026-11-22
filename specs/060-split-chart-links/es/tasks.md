# 060 — Enlaces del gráfico partido · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: solo frontend.

- [ ] 1. [frontend] Broker y par del lado derecho con un enlace: campos en `SplitState`, valores derivados del lado derecho, manejadores de selector por lado, `useChartSymbols` por lado, botón de enlace en `ChartToolbar` (`IconLink` / `IconUnlink`), estado "el broker no ofrece el par" en `ChartSlot` · **Verifica:** `npm run build` + app local (escritorio, partido): enlazado como hoy; desenlazar → cada lado elige su broker y par; volver a enlazar → el derecho toma el broker y par del izquierdo; un par enlazado que no tiene el broker derecho muestra el aviso; recargar conserva el enlace y las selecciones; sin partir → sin cambios; doble clic en el diario mueve el lado izquierdo y lo enlazado del derecho · **Est:** 2,5 SP
- [ ] 2. [frontend] Paneles por lado: indicadores, alertas, nueva operación y alertas del gráfico se abren y filtran para el lado que los pidió (`panelSide`) · **Verifica:** `npm run build` + app local: con dos pares distintos, abrir cada panel desde cada lado → muestra el broker y par de ese lado; una alerta creada desde el lado derecho es de su par · **Est:** 1,5 SP
- [ ] 3. [infra] Push de `master`, desplegar el frontend cuando lo pida el usuario y **validar en producción**: enlazado y desenlazado como en la maqueta, volver a enlazar, el aviso de "no ofrecido", paneles desde cada lado, doble clic en el diario, recargar · **Verifica:** manual (validación del usuario) · **Est:** 0,5 SP
- [ ] 4. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` (o el mes de cierre) · **Verifica:** manual · **Est:** 0,25 SP

**Estimación total**: 4,75 SP
