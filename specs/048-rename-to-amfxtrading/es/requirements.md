# 048 — Renombrar el proyecto a amfxtrading

> Status: **implementing**

## Contexto

El proyecto nació como la segunda versión de un MVP anterior y lleva "v2" en casi todos sus nombres: el repositorio de GitHub (`odeslad/amfxtradingv2`), la carpeta del servidor (`C:\amfxtradingv2`), la base de datos (`amfxtradingv2`), las direcciones públicas (`v2.amfxtrading.com`, `api-v2.amfxtrading.com`, `ssh-v2.amfxtrading.com`), el túnel de Cloudflare (`amfxtrading-v2`), la carpeta de trabajo local y los documentos. El MVP ya no se usa y este sistema es el único en producción, así que el "v2" ya no significa nada. El operador quiere que el proyecto se llame solo `amfxtrading` en todas partes.

El nombre sin "v2" está en parte ocupado: el MVP conserva una carpeta local `c:\Work\Odeslad\amfxtrading` y puede conservar un repositorio de GitHub con ese nombre, y las direcciones `amfxtrading.com`, `api.amfxtrading.com` y `ssh.amfxtrading.com` siguen apuntando al túnel del servidor cancelado el 2026-11-17 y responden con error.

En el repositorio el nombre aparece en 18 ficheros fuera de `archive/` (workflows, scripts de despliegue y de arranque, tests y herramientas del backend, documentos): 32 menciones de `amfxtradingv2`, 24 de `ssh-v2` y 28 de `v2.amfxtrading`.

## Capas afectadas

- infra (workflows, scripts de arranque y de despliegue, carpeta del servidor, tareas programadas, nginx, túnel y direcciones de Cloudflare)
- backend (script de despliegue, definición de pm2, orígenes permitidos, tests, `.env`)
- frontend (script de despliegue, dirección de la API)
- ea (scripts de compilación y distribución, documentos)
- db (solo el nombre de la base de datos; sin cambios de esquema)

## Decisiones tomadas por defecto, a confirmar con este documento

- **Alcance: todo.** Direcciones públicas, repositorio de GitHub, carpeta del servidor, base de datos, túnel de Cloudflare, carpeta local y documentos.
- **El MVP sigue existiendo, renombrado.** Su repositorio de GitHub se renombró a `odeslad/amfxtrading-v1` el 2026-11-17 (hecho, y su copia local ya apunta a él), lo que libera el nombre en GitHub. Su carpeta local pasa también a `amfxtrading-v1`.
- **Las direcciones antiguas siguen funcionando un tiempo.** `v2.amfxtrading.com` envía al visitante a `amfxtrading.com` durante 30 días y después se elimina.
- **Las specs cerradas no se reescriben.** Los documentos de `archive/` conservan los nombres que tenían cuando se escribieron.

## Historias de usuario

- Como operador, quiero que el proyecto se llame `amfxtrading` en todos los sitios donde tiene nombre, para que nada recuerde a una versión que ya no existe.
- Como usuario de la app, quiero abrirla en `amfxtrading.com`, para que la dirección sea la natural.
- Como operador, quiero que el cambio se haga en una ventana planificada con el mercado cerrado, para que la operativa no se vea afectada.
- Como operador, quiero saber de antemano qué tiene que volver a hacer cada usuario tras el cambio, para que nadie se lleve una sorpresa.

## Criterios de aceptación

- AC 1. CUANDO el trabajo termina ENTONCES la app responde en `amfxtrading.com`, la API en `api.amfxtrading.com` y el SSH en `ssh.amfxtrading.com`, todo servido por el servidor en uso.
- AC 2. CUANDO un usuario abre `v2.amfxtrading.com` durante los 30 días siguientes al cambio ENTONCES el navegador se envía a la misma página en `amfxtrading.com`.
- AC 3. CUANDO el trabajo termina ENTONCES el repositorio de GitHub es `odeslad/amfxtrading`, la copia local sube a él, y los tres pipelines de despliegue funcionan bien contra él.
- AC 4. CUANDO el trabajo termina ENTONCES el servidor ejecuta el sistema desde `C:\amfxtrading` con la base de datos `amfxtrading`, y nada de lo que corre en el servidor (proceso del backend, tareas programadas, nginx, túnel, scripts del EA) hace referencia a la carpeta antigua ni a la base de datos antigua.
- AC 5. CUANDO se renombra la base de datos ENTONCES conserva todas las tablas y todas las filas (se anota el número de filas antes y después), y una copia de seguridad tomada justo antes (todo salvo las filas de `candles`, cuya tabla no se puede volcar) se guarda hasta que el operador valide el cambio.
- AC 6. CUANDO el trabajo termina ENTONCES los 13 terminales están en marcha y están conectados los mismos brokers que antes; ticks, posiciones, historial y alertas funcionan como antes.
- AC 7. CUANDO el trabajo termina ENTONCES ningún fichero del repositorio fuera de `archive/` contiene `amfxtradingv2`, `amfxtrading-v2`, `api-v2`, `ssh-v2`, `v2.amfxtrading` ni "AMFX Trading v2".
- AC 8. CUANDO se hace el cambio de dirección ENTONCES el operador tiene, de antemano, la lista de lo que cada usuario debe volver a hacer: iniciar sesión, permitir de nuevo las notificaciones en cada dispositivo, reinstalar la app en el móvil si estaba instalada, y volver a poner lo que el navegador recordaba por dirección (selección del gráfico, herramientas del gráfico, vista partida).
- AC 9. CUANDO se permiten de nuevo las notificaciones en un dispositivo ENTONCES una alerta de precio llega a ese dispositivo desde la dirección nueva.
- AC 10. CUANDO se renombra la carpeta local ENTONCES el proyecto se abre desde `c:\Work\Odeslad\amfxtrading` con sus herramientas funcionando (git, compilaciones, acceso SSH, las notas de proyecto del asistente).
- AC 11. MIENTRAS se hace el cambio ENTONCES ocurre con el mercado cerrado, y si un paso falla el sistema se puede volver a arrancar como estaba antes de ese paso.

## Fuera de alcance

- Cualquier cambio de comportamiento de la app, del backend o del EA.
- Cambiar de servidor o de tamaño.
- Renombrar cosas dentro de las specs cerradas de `archive/`.
- La web corporativa de `www.amfxtrading.com`.
- Renombrar los brokers, los pipes o los terminales MT4.
- Reparar la tabla `candles` y poner al día la base de datos: una spec posterior, según lo acordado con el operador el 2026-11-17. Esta spec solo renombra la base de datos; la copia de seguridad previa al renombrado deja fuera las filas de velas.
