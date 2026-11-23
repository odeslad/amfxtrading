# 061 — Tamaño del login · Diseño

> Estado: **cerrada**

## Enfoque

`LoginPage` conserva su lógica y deja sus controles propios: los campos pasan a `Field` + `TextInput` y el botón a `Button` (`shared/ui`), todo en tamaño grande. Su módulo CSS solo conserva la página, la tarjeta, las líneas de marca y la línea de error.

## Sistema de diseño: un campo grande

`TextInput` / `NumberInput` / `Select` tienen hoy `sm` y `md`; el sistema de diseño del proyecto ya define un campo grande (`height 48px`, `padding 0 16px`) que nunca se construyó. `ControlSize` gana `lg`:

| Tamaño | Escritorio | Móvil (≤ 768 px) |
|---|---|---|
| `lg` (nuevo) | 48 px (`--h-lg`), padding `0 16px`, texto 14 px (`--text-lg`) | 48 px, texto 16 px (`--text-xl`), para que Safari de iPhone no haga zoom |

`Button size="lg"` ya existe (48 px, todo el ancho, 13 px; 16 px en móvil).

## Página

| | Escritorio | Móvil |
|---|---|---|
| Tarjeta | 400 px, padding `48px 40px 40px` | todo el ancho menos 16 px a cada lado, padding `40px 24px 32px` |
| Campos | `Field` + `TextInput size="lg"` (email / contraseña, autocompletado, obligatorios) | igual |
| Error | la línea actual bajo los campos (`--red`, con 16 px de alto fijo para que nada salte) | igual |
| Botón | `Button variant="primary" size="lg" type="submit"`, "Signing in…" mientras espera | igual |

La regla de autorrelleno que mantiene el fondo oscuro pasa al campo compartido (`.control:-webkit-autofill`), así la tienen todos los campos de la app.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/shared/ui/Input/controlClasses.ts`, `Input.module.css` | tamaño `lg`; regla de autorrelleno |
| `frontend/src/features/auth/LoginPage.tsx`, `LoginPage.module.css` | controles compartidos, tamaños por punto de corte |
| `frontend/src/dev/UiCatalogPage.tsx` | el campo `lg` en el catálogo |

Sin cambios en el backend; la autenticación no se toca.

## Maqueta

https://claude.ai/artifact/FDZcXNA4dC2m6iVZbak3XV (aprobada): tableros **Desktop** y **Phone**.

## Riesgos

- `Button` debe aceptar `type="submit"` (pasa las props nativas del botón; se comprueba en la tarea).
