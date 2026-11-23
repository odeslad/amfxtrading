# 061 — Tamaño del login · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: solo frontend.

- [ ] 1. [frontend] Tamaño `lg` para los campos compartidos (48 px; texto de 16 px en móvil) y la regla de autorrelleno en el control compartido; `lg` en el catálogo de desarrollo · **Verifica:** `npm run build` + `/dev/ui`: el campo `lg` en escritorio y a 390 px · **Est:** 0,5 SP
- [ ] 2. [frontend] Login con `Field`, `TextInput size="lg"` y `Button size="lg"`; tarjeta de 400 px en escritorio, todo el ancho con margen en móvil · **Verifica:** `npm run build` + app local (cerrar sesión): escritorio y 390 px como la maqueta; contraseña errónea muestra el error; al entrar vuelve a la página que lo pidió; el autorrelleno conserva el fondo oscuro · **Est:** 1 SP
- [ ] 3. [infra] Push de `master`, desplegar el frontend cuando lo pida el usuario y **validar en producción**: el login en escritorio y en el iPhone (sin zoom al escribir) · **Verifica:** manual (validación del usuario) · **Est:** 0,25 SP
- [ ] 4. [specs] Registrar Est vs Real en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` (o el mes de cierre) · **Verifica:** manual · **Est:** 0,25 SP

**Estimación total**: 2 SP
