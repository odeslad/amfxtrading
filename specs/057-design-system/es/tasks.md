# 057 — Sistema de diseño · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: solo frontend (sin cambios de backend, BD ni EA); un único despliegue del frontend cuando lo pida el usuario.

Las tareas de componentes se verifican en una página de catálogo solo de desarrollo (`/dev/ui`, que solo se construye con `import.meta.env.DEV`) que muestra cada componente y estado junto a la maqueta aprobada.

- [x] 1. [frontend] Tokens en `styles/variables.css` (`--muted` #8a8a8a, `--disabled`, `--placeholder`, tintes, `--backdrop`, alturas, `--disabled-opacity`, `--focus-ring`, anchos de panel, `--shadow-menu`) y la ruta de catálogo `/dev/ui` solo de desarrollo · **Verifica:** `npm run build` + `/dev/ui` abre en local y no está en el bundle de producción · **Est:** 1,5 SP
- [x] 2. [frontend] Controles base: Button, IconButton, FieldLabel, TextInput, NumberInput, Select, Checkbox, Toggle (con anillo de foco y estado desactivado) · **Verifica:** build + catálogo frente a los tableros 1–2 (tamaños, variantes, hover/foco/desactivado) · **Est:** 3 SP
- [x] 3. [frontend] Controles de elección: Segmented (con tono compra/venta), Chip (seleccionado / eliminable / bloqueado), ColorPicker, DateInput (DateField + Calendar con los tokens nuevos, misma API) · **Verifica:** build + catálogo frente al tablero 2 + una pantalla con DateField (TradePanel del libro) sigue funcionando · **Est:** 2,5 SP
- [x] 4. [frontend] Estructura: Tabs (etiquetas larga/corta, hueco de acciones, relleno en móvil), Section, Row, Card (acento, desplegable), Toolbar, Hint, EmptyState, Loading · **Verifica:** build + catálogo frente a los tableros 1, 4 y 5 en escritorio y a 390 px · **Est:** 2,5 SP
- [x] 5. [frontend] Datos: Table (columnas, cabecera ordenable, alineación numérica, acciones de fila al pasar el ratón, tarjetas ≤768), Pager, Badge, StatusDot, ProgressBar, Gauge, StatTile/StatStrip, Legend · **Verifica:** build + catálogo frente al tablero 3 y al tablero móvil 5 · **Est:** 4 SP
- [x] 6. [frontend] Capas: SidePanel (+ modo acoplado que sustituye a DockedPanel, que se conserva como envoltorio con la misma API), ConfirmDialog, Menu/Popover, FilterPanel, Toast (el Toaster pasa a `shared/ui`) · **Verifica:** build + catálogo frente al tablero 4 + New Trade acoplado del gráfico y la confirmación de cierre del diario siguen funcionando · **Est:** 3,5 SP
- [x] 7. [frontend] Migrar el armazón de Settings + pestaña Mirror (MirrorTab, QuickOrdersSection) · **Verifica:** build + local: presets, órdenes rápidas y Save funcionan como antes; en su CSS no queda ninguna regla que cubra un componente · **Est:** 2,5 SP
- [x] 8. [frontend] Migrar la pestaña Display (DisplayTab, MaTemplatesSection) · **Verifica:** build + local: cada ajuste de display y la edición de plantillas se guardan como antes · **Est:** 3 SP
- [ ] 9. [frontend] Migrar la pestaña Notifications (NotificationsTab, NotificationPanel, DevicesPanel) · **Verifica:** build + local: crear/editar/pausar/borrar una regla, panel de dispositivos · **Est:** 3 SP
- [ ] 10. [frontend] Migrar la pestaña Visibility (VisibilityTab, SymbolsPanel) · **Verifica:** build + local: visibilidad de brokers, panel de pares activo/apagado/bloqueado, Save to EA (contra el backend local con flags apagados) · **Est:** 1,5 SP
- [ ] 11. [frontend] Migrar la pestaña Data (DataSyncTab) · **Verifica:** build + local: objetivos, selección, estados del avance de la sincronización · **Est:** 2 SP
- [ ] 12. [frontend] Migrar la pestaña Server (ServerTab, ServerCharts) · **Verifica:** build + local: medidores, tablas, 24h/7d, plegar · **Est:** 2,5 SP
- [ ] 13. [specs] Actualizar la sección del sistema de diseño de `.claude/CLAUDE.md` (tokens, lista de componentes, `--text-3xl` 24px) · **Verifica:** revisión manual · **Est:** 0,5 SP
- [ ] 14. [infra] Push de `master` y despliegue del frontend cuando lo pida el usuario; **validar en producción**: cada pestaña de Settings en escritorio y móvil (mismos ajustes, mismos guardados), anillo de foco con Tab, tablas como tarjetas en móvil, texto secundario #8a8a8a en el resto de la app · **Verifica:** manual (validación del usuario) · **Est:** 1 SP
- [ ] 15. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` (o el mes de cierre) · **Verifica:** manual · **Est:** 0,25 SP

**Estimación total**: 33,75 SP
