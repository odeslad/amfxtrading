# 048 — Renombrar el proyecto a amfxtrading · Diseño

## Enfoque

El renombrado se parte en siete bloques, ordenados de menor a mayor riesgo. Cada bloque deja el sistema funcionando y se puede deshacer por separado, así que el trabajo puede parar después de cualquiera de ellos. Solo el bloque 4 (carpeta del servidor y base de datos) necesita una ventana con el mercado cerrado.

| Bloque | Qué | Para el sistema | Quién |
|---|---|---|---|
| 1 | Direcciones públicas | No (unos segundos del túnel) | Asistente; el operador solo si Cloudflare pide iniciar sesión |
| 2 | Repositorio de GitHub | No | Asistente |
| 3 | Nombres dentro del repositorio | No (sale con el bloque 4) | Asistente |
| 4 | Carpeta del servidor y base de datos | Sí, backend y web unos minutos | Asistente, con el operador presente |
| 5 | Nombre del túnel de Cloudflare y restos | No | Operador en el panel de Cloudflare |
| 6 | Carpetas locales | No | Operador, con el editor cerrado |
| 7 | Retirar las direcciones antiguas, 30 días después | No | Asistente |

Ningún código de la aplicación cambia de comportamiento. No se añade ninguna dependencia. El contrato EA ↔ backend no se toca.

## Lo que se ha encontrado en el servidor y en el código

- **El túnel se configura en el servidor** (`C:\Users\Administrator\.cloudflared\config.yml`): lista `ssh-v2`, `v2` y `api-v2`. Las direcciones nuevas se añaden editando ese fichero; no dependen del panel de Cloudflare, salvo el registro DNS de cada dirección.
- **El backend ya acepta las direcciones nuevas**: su regla permite `amfxtrading.com` y cualquier subdominio. Sin cambios de código.
- **La cookie de sesión pertenece a `.amfxtrading.com`**, así que un usuario con sesión iniciada en `v2.amfxtrading.com` la conserva en `amfxtrading.com`. No debería hacer falta volver a iniciar sesión (se comprueba en el bloque 1).
- **Lo que el navegador guarda por dirección se pierde**: el permiso de notificaciones, la app instalada en el móvil y las preferencias locales (selección del gráfico, herramientas del gráfico, vista partida).
- **nginx** sirve la web desde `C:/amfxtradingv2/frontend/dist`; su configuración está solo en el servidor, no en git.
- **Los terminales no dependen de la carpeta del proyecto**: MT4 y los ficheros del bridge viven en el perfil del usuario. El bloque 4 no necesita pararlos.
- **Dos tareas programadas** (`AMFX-Startup`, `AMFX-Watchdog`) apuntan al script de arranque dentro de la carpeta.
- **La base de datos** `amfxtradingv2` pesa unos 2 GB y solo la usa el backend.

## Bloque 1 — Direcciones públicas

1. Añadir `amfxtrading.com`, `api.amfxtrading.com` y `ssh.amfxtrading.com` a la configuración del túnel en el servidor, junto a las tres antiguas. El fichero se valida (`cloudflared tunnel ingress validate`) antes de reiniciar el servicio.
2. Apuntar los tres registros DNS a este túnel. Hoy apuntan al túnel del servidor cancelado. Se hace desde el servidor con `cloudflared tunnel route dns --overwrite-dns` si el servidor tiene el certificado de inicio de sesión de Cloudflare; si no, el operador cambia los tres registros en el panel de Cloudflare.
3. Comprobar la regla de Cloudflare Access de `ssh.amfxtrading.com`: existe desde la migración cancelada y debe dejar entrar a los mismos tokens de servicio que `ssh-v2` (el de GitHub y el del PC del operador).
4. Frontend: la dirección de la API que escribe `frontend/scripts/deploy.ps1` pasa a `https://api.amfxtrading.com`; despliegue del frontend.
5. Redirección: nginx responde a las peticiones de `v2.amfxtrading.com` con una redirección permanente a la misma ruta en `amfxtrading.com`. `api-v2` y `ssh-v2` siguen funcionando sin redirección durante los 30 días (los pipelines y las herramientas pasan a las nuevas en el bloque 3).

Notificaciones durante los 30 días: las suscripciones hechas en la dirección antigua siguen guardadas y siguen entregando, así que nadie deja de recibir alertas el día del cambio. Un dispositivo que vuelva a permitir las notificaciones en la dirección nueva puede recibir cada alerta dos veces hasta que el bloque 7 elimine las suscripciones antiguas.

Deshacer: quitar las tres direcciones nuevas del fichero del túnel, quitar la redirección y desplegar el frontend con la dirección antigua de la API.

## Bloque 2 — Repositorio de GitHub

El repositorio se renombra a `odeslad/amfxtrading` (el nombre quedó libre el 2026-11-17 al renombrar el MVP a `amfxtrading-v1`). Se actualizan el remoto de la copia local y el de la copia del servidor. GitHub sigue redirigiendo el nombre antiguo, y los secretos y los workflows del repositorio sobreviven al renombrado.

Deshacer: renombrarlo de vuelta.

## Bloque 3 — Nombres dentro del repositorio

18 ficheros fuera de `archive/`:

| Capa | Ficheros | Cambio |
|---|---|---|
| infra | 3 workflows, `infra/scripts/startup.ps1`, `register-startup-tasks.ps1`, `infra/README.md` | carpeta `C:\amfxtrading`, host `ssh.amfxtrading.com` |
| backend | `scripts/deploy.ps1`, `ecosystem.config.js`, `scripts/db-tunnel.ps1`, `.env.example`, `scripts/ws-measure.ts`, 2 tests | carpeta, nombre de la base de datos, hosts; los tests usan una dirección de ejemplo |
| frontend | `scripts/deploy.ps1` | carpeta (la dirección de la API cambia en el bloque 1) |
| ea | `scripts/compile-ea.ps1`, `scripts/distribute-ea.ps1`, `docs/deploy.md` | carpeta, host, nombre del túnel |
| docs | `.claude/CLAUDE.md` | título y árbol de carpetas |

Un commit por capa. Se suben durante el bloque 4, en este orden y de uno en uno, porque cada push despliega en la carpeta nueva: primero infra (no dispara ningún pipeline y lleva los workflows), después backend, después frontend y después ea. El push del backend va solo, sin ningún otro pipeline en marcha.

## Bloque 4 — Carpeta del servidor y base de datos (ventana con el mercado cerrado)

1. Anotar el número de filas de cada tabla. Hacer una copia de seguridad de la base de datos **sin las filas de `candles`**: esa tabla tiene páginas dañadas y un volcado completo falla en ella; sus filas vienen de MT4 y el renombrado no las reescribe. Copiar aparte `.env`, `brokers.json` y `nginx.conf`.
2. Pausar `AMFX-Watchdog`, parar el backend (pm2) y nginx. Los terminales siguen en marcha; se reconectan solos cuando vuelve el backend.
3. Renombrar la base de datos: `ALTER DATABASE amfxtradingv2 RENAME TO amfxtrading`. Cambia solo el nombre, al instante.
4. Renombrar la carpeta `C:\amfxtradingv2` a `C:\amfxtrading`.
5. Actualizar lo que está fuera de git: `DATABASE_URL` y `BROKERS_FILE` en `.env`, la raíz de la web en `nginx.conf`, la exclusión del antivirus y las dos tareas programadas (se registran de nuevo con la ruta nueva).
6. Subir los commits del bloque 3 de uno en uno; cada pipeline despliega en la carpeta nueva. El pipeline del EA recarga los 13 terminales, de uno en uno.
7. Arrancar nginx, reanudar `AMFX-Watchdog` y comprobar: `/health`, los mismos brokers conectados, la app, una alerta y el número de filas igual al del paso 1.

Parada prevista: de 10 a 20 minutos de backend y web.

Deshacer en cualquier paso: renombrar la carpeta y la base de datos de vuelta, reponer los tres ficheros copiados y arrancar el backend con pm2. Los commits del bloque 3 se revierten si ya estaban subidos.

## Bloque 5 — Nombre del túnel de Cloudflare y restos (operador)

- Eliminar el túnel del servidor cancelado (se llama `amfxtrading` y está muerto).
- Renombrar el túnel `amfxtrading-v2` a `amfxtrading` si el panel de Cloudflare lo permite. Si no lo permite, el nombre se queda: solo se ve en ese panel y en un documento, que lo dirá.

## Bloque 6 — Carpetas locales (operador, con el editor cerrado)

- `c:\Work\Odeslad\amfxtrading` (el MVP) → `amfxtrading-v1`.
- `c:\Work\Odeslad\amfxtradingv2` → `amfxtrading`.
- Las notas del asistente para este proyecto se guardan en una carpeta que lleva el nombre de la ruta; se copian a la carpeta de la ruta nueva para no perderlas.
- Accesos SSH del PC: `amfx-vps` apunta a `ssh.amfxtrading.com`; `amfx-vps-old` se elimina.

El asistente no puede renombrar la carpeta en la que está trabajando, así que deja los comandos exactos y el operador los ejecuta con el editor cerrado.

## Bloque 7 — Retirar las direcciones antiguas (30 días después del bloque 1)

Quitar `v2`, `api-v2` y `ssh-v2` del fichero del túnel y sus registros DNS, quitar la redirección de nginx y borrar las suscripciones de notificaciones hechas antes del bloque 1.

## Lo que cada usuario tiene que volver a hacer (AC 8)

| Qué | ¿Hace falta? |
|---|---|
| Iniciar sesión | Probablemente no (la sesión vale para todo el dominio); se comprueba en el bloque 1 |
| Permitir las notificaciones, en cada dispositivo | Sí |
| Reinstalar la app en el móvil, si estaba instalada | Sí |
| Selección del gráfico, herramientas del gráfico, vista partida | Sí, empiezan en sus valores por defecto |
| Alertas, dibujos, indicadores, ajustes | No, están guardados en el servidor |

## Riesgos

- **Perder el acceso al servidor** si el túnel no vuelve tras un cambio en su fichero. El fichero se valida antes del reinicio y se guarda una copia del anterior; el operador conserva el escritorio remoto o la consola del proveedor como vía de entrada.
- **El servidor tiene 4 GB y un historial de reinicios** en despliegues y arranques. El bloque 4 despliega tres veces y recarga los terminales; todo va de uno en uno, con el mercado cerrado.
- **Copia de seguridad sin las filas de velas.** Aceptado por el operador el 2026-11-17 (las velas y el estado de la base de datos van a una spec posterior): en este servidor no es posible un volcado completo. El renombrado en sí no reescribe datos, y el número de filas de `candles` se compara antes y después.
- **Notificaciones dobles** durante 30 días en los dispositivos que se suscriban en la dirección nueva.
- **`www.amfxtrading.com`** (futura web corporativa) no se toca; la app ocupa la dirección sin `www`.
