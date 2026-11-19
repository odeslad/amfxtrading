# 050 — Migrar la plataforma al VPS XL+ · Diseño

## Enfoque

Montar el XL+ como **réplica exacta del M+**: mismo usuario (`Administrator`), mismas rutas (`C:\amfxtrading`, `C:\nginx`, `C:\Program Files (x86)\<MT4>`, `MetaQuotes\Terminal\<hash>`), mismo nombre, rol y contraseña de la base de datos, mismas versiones de software y mismos secretos. Después, **mover el túnel de Cloudflare existente** del M+ al XL+: el túnel se gestiona en local, así que su fichero de credenciales y su `config.yml` se copian al XL+, y el cambio consiste en parar `cloudflared` en el M+ y arrancarlo en el XL+.

Con el mismo túnel, los nombres públicos, los registros DNS, la aplicación de Access, los secretos de GitHub y los workflows se quedan exactamente como están. **No cambia ningún fichero del repositorio** salvo la documentación; del cambio solo se sube la evidencia en `verification.md`.

### Alternativa considerada: un segundo túnel (el método de la spec 043)

| | Mover el túnel (elegido) | Segundo túnel |
|---|---|---|
| DNS / Access / workflows | sin tocar | tres rutas DNS sobrescritas, nombre en Access, workflows cambiados |
| Cambio | parar en M+, arrancar en XL+ (segundos) | cambio de DNS + push al repo |
| Vuelta atrás | lo inverso (segundos) | DNS + revertir commits |
| Probar el XL+ antes del cambio | por reenvío de puertos SSH en el puerto 22 | en sus propios nombres públicos |

Las dos copias del mismo túnel no deben correr nunca a la vez: Cloudflare repartiría el tráfico entre ellas. El guion del cambio para una antes de arrancar la otra.

## Inventario a copiar (M+ → XL+)

| Elemento | Cómo |
|---|---|
| Sistema base | plan de energía sin suspensión, Windows Update sin reinicios automáticos en horario de mercado, zona horaria UTC. Defender y servicios: ya hecho en el XL+ (18-nov-2026) |
| Software, mismas versiones que el M+ | Node, npm, pm2, git, PostgreSQL 17, nginx (`C:\nginx` copiado entero, con `nginx.conf`), `nssm` en `C:\nssm`, cloudflared. Versiones leídas del M+ al empezar la tarea 1 |
| Proyecto | `git clone` en `C:\amfxtrading`; ficheros fuera de git copiados: `backend\.env`, `backend\brokers.json`; `npm install`, `prisma generate`, builds del backend y del frontend |
| Base de datos | `pg_dump -Fc` en el M+ → pasa por el PC → `pg_restore` en el XL+ (430 MB, unos segundos) |
| MT4 | las 13 carpetas de instalación y todo el árbol `MetaQuotes\Terminal` a las mismas rutas (el hash de la carpeta de datos sale de la ruta de instalación, así que `origin.txt`, `brokers.json` y cada `config.json` del bridge siguen valiendo) |
| Túnel | `C:\Users\Administrator\.cloudflared\` (JSON de credenciales, `config.yml`, `cert.pem`); servicio instalado como el del M+ (LocalSystem, `--config` a ese fichero) pero **parado y en manual** hasta el cambio |
| Identidad SSH | las claves de host del M+ (`C:\ProgramData\ssh\ssh_host_*`) copiadas al XL+, para que `ssh amfx-vps` y los pipelines vean la misma identidad tras el cambio (sin aviso de known-hosts) |
| Tareas | `AMFX-Startup` y `AMFX-Watchdog` (`register-startup-tasks.ps1`), `PoolWatch` y `RAM-Log` como en el M+. En el M+ `RAM-Log` no escribe ningún fichero: se arregla en el XL+ para que el AC 9 tenga datos |
| Autologon | el operador, por RDP (el comando del README con el nombre de equipo del XL+) |

Lecciones de la spec 043 aplicadas: el instalador de PostgreSQL falla desde una sesión SSH (se lanza con una tarea programada puntual como `SYSTEM`); reiniciar `cloudflared` corta la sesión SSH que lo ejecuta (se hace desde una tarea programada con vuelta atrás automática); los logins guardados de MT4 sobrevivieron a una copia; una prueba de reinicio demuestra la cadena de arranque.

## Convivencia antes del cambio

Durante la preparación el XL+ corre su backend y sus 13 terminales junto al M+, como en la spec 043:

- **No es público**: el túnel está parado en el XL+; solo se llega por SSH en el puerto 22 (solo con clave) con reenvío de puertos para revisar la app.
- **Alertas apagadas** en el XL+ (`FEATURE_ALERTS=false`), para que ningún aviso salga dos veces.
- **Sin órdenes** desde el XL+; solo el operador podría, por el puerto reenviado.
- Los terminales entran en las mismas cuentas en las dos máquinas (el operador lo autorizó en la spec 043; entonces conectaron 11 de 13 sin problemas). Si un broker corta la sesión del M+, ese terminal se cierra en el XL+ hasta el cambio.

## Cambio (fin de semana, mercado cerrado)

1. Parar el backend del XL+.
2. Parar el backend y los terminales del M+ (`AMFX-Watchdog` desactivado en el M+ para que no los relance).
3. `pg_dump` final en el M+ → `pg_restore` en el XL+; número de filas comparado tabla a tabla (AC 2). El fichero del volcado se guarda.
4. `FEATURE_ALERTS` vuelve a encendido en el `.env` del XL+; arrancar el backend del XL+.
5. Parar y desactivar `cloudflared` en el M+; arrancarlo en el XL+ y ponerlo en automático (desde una tarea programada, con vuelta atrás al M+ si `/health` no responde por el túnel en 2 minutos).
6. Comprobaciones por los nombres públicos: `/health`, login, ticks, posiciones, una notificación push, la sincronización de una temporalidad (AC 3, AC 4); `ssh amfx-vps` llega al XL+ (comprobando el nombre de equipo); una ejecución manual de cada pipeline (`workflow_dispatch`) despliega en el XL+ (AC 5).
7. Cerrar el puerto 22 en el XL+ (regla de Windows y regla del firewall de IONOS, esta la quita el operador).

El M+ queda instalado, con su servicio del túnel desactivado y sus terminales parados.

### Vuelta atrás (hasta dar de baja el M+)

Parar `cloudflared` en el XL+, arrancarlo en el M+, arrancar el backend y los terminales del M+ y volver a activar su watchdog. Los datos creados en el XL+ tras el cambio (alertas, dibujos, ajustes, libro) se llevan de vuelta con un volcado de esas tablas; velas, operaciones y balances vuelven desde los terminales. Se escribe paso a paso en `verification.md` antes del cambio.

## Observación y cierre

- Memoria con los 13 terminales abiertos medida y registrada (AC 9).
- 14 días sin eventos 41, 1001 ni 6008 en el XL+ (AC 10), dentro de su plazo de devolución (hacia el 18 de diciembre de 2026). Después el operador da de baja el M+.

## Ficheros a tocar en el repositorio

- `infra/README.md`: el servidor que describe, el comando de Autologon sin nombre de equipo fijo, `RAM-Log` y `PoolWatch`.
- `.claude/CLAUDE.md` y `backend/docs/architecture.md`: solo si nombran el tamaño o el equipo del servidor.
- `specs/050-migrate-to-vps-xl/{en,es}/verification.md`.

Fuera del repositorio: nada en el PC (`ssh amfx-vps` mantiene su nombre de host; las claves de host son las mismas).

## Dependencias

Ninguna nueva.

## Riesgos

- **Dos copias del túnel a la vez** repartirían el tráfico. Se evita con el guion y con el servicio del XL+ en manual hasta el cambio.
- **El XL+ es más lento por núcleo** (2,0 frente a 2,6 GHz): los ticks con 13 terminales podrían ir más lentos. Se mide durante la preparación con los terminales en marcha; si no es aceptable, la migración se para antes del cambio y el XL+ se devuelve.
- **El XL+ también podría colgarse** (mismo proveedor): 14 días de observación con el M+ listo para volver.
- **Un broker puede rechazar dos sesiones** de la misma cuenta durante la preparación: ese terminal espera en el XL+ hasta el cambio.
- **El puerto 22 está abierto en el XL+ hasta el cambio** (solo con clave).
- **Los push durante la preparación** siguen desplegando en el M+ (el túnel está allí). Está bien, pero el XL+ debe ponerse en el mismo commit antes del cambio (`git pull` + builds en el guion).
