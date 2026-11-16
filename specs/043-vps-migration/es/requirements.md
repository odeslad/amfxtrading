# 043 — Migración de VPS

> Status: **implementing**

## Contexto

Todo el sistema (10 terminales MT4 con el EA, backend, PostgreSQL 17, nginx sirviendo el frontend, cloudflared) corre en un único VPS Windows de IONOS (`WIN-16ESVKMCVCR`). Esa máquina ha sufrido BSODs repetidos (`0x1A`, julio de 2026, recaída el 2 de octubre de 2026) y errores transitorios "invalid page" de PostgreSQL, que apuntan ambos a RAM defectuosa en el host, y cada reinicio inesperado corta los datos de trading hasta que se restaura la sesión. El usuario ha contratado un VPS nuevo y quiere trasladar allí el sistema completo para que los reinicios desaparezcan. No cambia nada funcional: mismo código y mismos datos en otra máquina. El sistema nuevo recibe sus propios nombres públicos (`amfxtrading.com`, `api.amfxtrading.com`, `ssh.amfxtrading.com`) para que las dos máquinas puedan funcionar a la vez; la antigua conserva `v2` hasta que se apague. `www.amfxtrading.com` queda reservado para la web corporativa y no se toca.

## Capas afectadas

- infra (aprovisionamiento de la máquina nueva, túnel de Cloudflare, tareas programadas, pipelines de deploy)
- backend (configuración: `.env`, `brokers.json`; código: aceptar el dominio raíz como origen permitido; `db-tunnel.ps1`)
- db (traslado de datos; sin cambio de esquema)
- ea (configuración del bridge por terminal; sin cambio de código)
- frontend (build estático servido desde la máquina nueva; la dirección del API en su script de deploy)

## Historias de usuario

- Como operador, quiero todo el sistema corriendo en el VPS nuevo, para que los reinicios inesperados de la máquina de IONOS dejen de interrumpir mi operativa.
- Como operador, quiero que Claude haga la migración de principio a fin, para que mi trabajo se limite a los pasos que de verdad me necesitan.
- Como operador, quiero que el VPS antiguo se conserve intacto hasta que el nuevo demuestre ser estable, para poder volver atrás si algo falla.
- Como desarrollador, quiero los tres pipelines de deploy y mi acceso local (SSH, túnel de BD) apuntando a la máquina nueva, para que el flujo diario no cambie.

## Criterios de aceptación

- AC 1. CUANDO la migración termina ENTONCES la app responde en `https://amfxtrading.com` (API en `https://api.amfxtrading.com`), servida por el VPS nuevo, con login, gráficos, ticks en vivo, posiciones, cuenta y comandos funcionando para todos los brokers de `brokers.json`.
- AC 2. CUANDO se hace el cambio ENTONCES la base de datos nueva contiene todas las filas creadas por el usuario que tenía la antigua en el momento de la copia final (mismo número de filas en esas tablas; `prisma migrate diff` contra la base nueva sale vacío).
- AC 3. CUANDO se hace el cambio ENTONCES todos los terminales MT4 de `brokers.json` corren en el VPS nuevo, con sesión iniciada, con el EA adjunto y conectado al pipe del backend, y `GET /health` da todos los brokers vivos.
- AC 4. CUANDO las dos máquinas funcionan a la vez ENTONCES las alertas se evalúan en exactamente una de ellas en cada momento (ninguna notificación duplicada), y CUANDO acaba el periodo de observación ENTONCES el VPS antiguo se apaga.
- AC 5. CUANDO el VPS nuevo se reinicia ENTONCES backend, nginx, PostgreSQL, cloudflared y todos los terminales MT4 vuelven sin intervención manual (autologon + `AMFX-Startup` / `AMFX-Watchdog`).
- AC 6. CUANDO se hace push a `master` de un commit que toca `backend/**`, `frontend/**` o `ea/**` ENTONCES el pipeline correspondiente despliega en el VPS nuevo y pasa, incluida la compilación del EA y la recarga de terminales.
- AC 7. CUANDO el desarrollador ejecuta `ssh amfx-vps` o `backend/scripts/db-tunnel.ps1` ENTONCES llega al VPS nuevo (el antiguo sigue accesible como `amfx-vps-old` hasta que se apague).
- AC 8. CUANDO el VPS nuevo se está preparando y probando ENTONCES producción en el VPS antiguo sigue funcionando en `v2.amfxtrading.com`, y el paso al sistema nuevo no interrumpe el servicio.
- AC 9. CUANDO el cambio falla o el VPS nuevo se comporta mal durante el periodo de observación ENTONCES el sistema puede devolverse al VPS antiguo siguiendo un procedimiento de vuelta atrás escrito, y el VPS antiguo no se da de baja antes de que acabe ese periodo.
- AC 10. CUANDO la migración termina ENTONCES el puerto SSH del VPS nuevo no es alcanzable desde internet (el túnel de Cloudflare es la única vía) y no se ha commiteado ningún secreto al repo.
- AC 11. CUANDO la migración termina ENTONCES `infra/README.md`, `backend/docs/architecture.md` y `.claude/CLAUDE.md` describen la máquina nueva allí donde nombraban la antigua.

## Reparto del trabajo

Claude hace todo lo que se puede hacer por SSH. Los pasos del usuario se limitan a:

1. Dar la IP pública, el nombre del usuario administrador y las características de la máquina (SO, RAM, vCPU, disco).
2. Una sesión de RDP para ejecutar un script de arranque que entrega Claude (activar OpenSSH Server, instalar la clave pública de deploy).
3. Activar Autologon (Sysinternals) por RDP — necesita la contraseña de Windows.
4. Iniciar sesión en una cuenta de MT4 por RDP solo donde el terminal copiado no reconecte por sí mismo.
5. Añadir `ssh.amfxtrading.com` a la aplicación de Cloudflare Access que protege el SSH (panel), y quitar la regla temporal del puerto 22 en el panel de IONOS.
6. Reinstalar la app en el móvil y reactivar las notificaciones push en la dirección nueva.
7. Validar la app en producción tras el cambio y decidir cuándo se da de baja el VPS antiguo.

## Supuestos (tomados como valores recomendados; se cambian en esta aprobación)

- La máquina nueva es **Windows Server** (MT4 y los named pipes exigen Windows).
- Los dos sistemas funcionan **en paralelo**, cada uno en su dirección; el cambio no necesita parada y se hace **con el mercado cerrado** (fin de semana) solo por precaución.
- Los terminales MT4 se **copian** del VPS antiguo (instalaciones y carpetas de datos, mismas rutas) en lugar de reinstalarse, para conservar logins, perfiles y el EA adjunto.
- El VPS antiguo sigue **en marcha como respaldo (alertas apagadas) durante dos semanas** tras el cambio.

## Fuera de alcance

- Cualquier cambio funcional en backend, frontend o EA.
- Cambiar el stack (Linux, contenedores, base de datos gestionada, otro servidor web).
- Subir versiones de PostgreSQL, Node o MT4 más allá de lo que obligue el SO nuevo.
- El refactor pendiente del EA (dejar de escribir `positions.json`).
- Dar de baja el contrato de IONOS (lo hace el usuario).
- Migrar otros proyectos alojados en el VPS antiguo, si los hay.
