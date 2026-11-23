# 061 — Tamaño del login

> Estado: **aprobado**

## Contexto

La página de login (`features/auth/LoginPage`) es igual en escritorio y en móvil: tarjeta de 360 px, campos de 29 px de alto con texto de 11 px y botón de 34 px. En el móvil los controles quedan por debajo de los 44 px táctiles que usa la app, y Safari de iPhone amplía la página al enfocar un campo con texto de menos de 16 px. Además la página dibuja sus propios campos y botón en lugar de usar el sistema de diseño compartido (la spec 057 dejó el login para migrarlo en su propia spec).

## Capas afectadas

- frontend

## Historias de usuario

- Como operador que entra desde el móvil, quiero campos y botón lo bastante grandes para tocarlos, y que no haga zoom al escribir.
- Como operador en escritorio, quiero un login que se lea cómodo por sí solo, con el estilo de la app.

## Criterios de aceptación

- AC 1. CUANDO el login se abre en escritorio ENTONCES la tarjeta mide unos 400 px y los campos y el botón usan el tamaño grande del sistema de diseño (48 px de alto).
- AC 2. CUANDO el login se abre en un móvil (≤ 768 px) ENTONCES la tarjeta ocupa el ancho con margen, campos y botón miden 48 px de alto y el texto de los campos es de 16 px, para que Safari de iPhone no haga zoom al enfocar.
- AC 3. La página se construye con `Field`, `TextInput` y `Button` compartidos (`shared/ui`); ningún control propio.
- AC 4. El comportamiento no cambia: email y contraseña obligatorios, el error bajo los campos, "Signing in…" mientras espera, vuelta a la página que pidió el login, el autorrelleno conserva el fondo oscuro.

## Fuera de alcance

- Cambios en la autenticación (cookie, JWT, endpoints).
- "He olvidado la contraseña" u otras opciones nuevas.
