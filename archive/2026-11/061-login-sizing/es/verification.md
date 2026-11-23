# 061 — Tamaño del login · Verificación

| Tarea | Mecanismo | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|
| 1 | `npm run build` + `/dev/ui` | ✅ build · ✅ revisado en producción | `ControlSize` gana `lg` (48 px, `0 16px`, 14 px; 16 px en móvil); regla de autorrelleno en `.control`; "Text lg" en el catálogo | 0,5 SP | 0,25 SP |
| 2 | `npm run build` + eslint | ✅ build · ✅ validado en producción | Login con `Field`, `TextInput size="lg"`, `Button size="lg"`; tarjeta de 400 px, todo el ancho en móvil | 1 SP | 0,25 SP |
| 3 | Manual (usuario) | ✅ | Login validado en producción (escritorio e iPhone) | 0,25 SP | 0,1 SP |
| 4 | Manual | ✅ | Spec cerrada y archivada | 0,25 SP | 0,1 SP |

**Total**: Est 2 SP · Real 0,7 SP. Calibración: una pantalla que solo cambia a componentes compartidos existentes cuesta bastante menos de 1 SP.
