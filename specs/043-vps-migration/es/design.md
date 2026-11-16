# 043 — Migración de VPS · Diseño

## Enfoque

Montar el VPS nuevo como una **réplica del antiguo con el mismo nombre de usuario, versiones y secretos** (y las mismas rutas salvo la carpeta del proyecto, ver "Quitar el nombre `v2`"), y publicarlo con **sus propios nombres** a través de **su propio túnel de Cloudflare**, de modo que los dos sistemas funcionen a la vez:

| | VPS antiguo (`WIN-16ESVKMCVCR`) | VPS nuevo (`WIN-E5FGF0D8OH7`) |
|---|---|---|
| App | `v2.amfxtrading.com` | `amfxtrading.com` |
| API / WebSocket | `api-v2.amfxtrading.com` | `api.amfxtrading.com` |
| SSH | `ssh-v2.amfxtrading.com` | `ssh.amfxtrading.com` |

No hay corte con parada: el usuario empieza a usar la dirección nueva cuando la copia final de datos está hecha, y el sistema antiguo sigue en marcha como respaldo hasta que se apague. `www.amfxtrading.com` (futura web corporativa) no se toca.

Esto sustituye a la primera versión de este diseño (mover el túnel existente), después de que el usuario pidiera que los dos sistemas convivan y confirmara que `amfxtrading.com` y `api.amfxtrading.com` están libres.

## Inventario del VPS antiguo (medido el 2026-11-16, solo lectura)

| Elemento | Valor |
|---|---|
| SO / tamaño | Windows Server 2025 Datacenter · 4 vCPU · 4 GB RAM (0,75 GB libres) · 128 GB de disco (71 GB libres) · zona horaria UTC |
| Software | Node 24.16.0 · npm 11.13.0 · pm2 7.0.1 · git 2.54.0 · PostgreSQL 17.10 · cloudflared 2026.6.0 · nginx en `C:\nginx` |
| Servicios | `postgresql-x64-17` (NetworkService) · `nginx` (LocalSystem, envuelto con `nssm`) · `Cloudflared` (LocalSystem, `--config C:\Users\Administrator\.cloudflared\config.yml`) · `sshd` |
| Túnel | `fb1c65c3-9f0b-4aae-ada6-69b794760ee0`, gestionado en local; ingress `ssh-v2` → `ssh://localhost:22`, `v2` → `http://localhost:80`, `api-v2` → `http://localhost:3000`. `cert.pem` está en `C:\Users\Administrator\.cloudflared\` |
| Proyecto | `C:\amfxtradingv2`; fuera de git: `backend\.env` (12 claves), `backend\brokers.json`, `frontend\dist`, `C:\nginx\conf\nginx.conf` |
| MT4 | **13** instalaciones en `C:\Program Files (x86)\` (68 MB cada una) y **13** brokers en `brokers.json` (no 10, como dice la documentación); carpetas de datos en `C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\<hash>` (≈ 0,6 GB en total) |
| Base de datos | directorio de datos de 3,5 GB |
| Tareas programadas | `AMFX-Startup`, `AMFX-Watchdog`, `PoolWatch` (en ejecución, script `C:\pool-watch.ps1`). `RAM-Log` no apareció en la raíz de tareas — se localiza durante la implementación |
| Otros | Autologon activo · `C:\monitoring`, `C:\deploy` |

VPS nuevo (medido por SSH): Windows Server 2025 Datacenter · 4 vCPU · 8 GB RAM · 239 GB de disco · zona horaria UTC · usuario `Administrator` · IP `<IP del VPS nuevo>` (IONOS). SSH accesible por el puerto 22 con la clave de deploy (temporal, hasta que el túnel esté montado).

DNS hoy: `amfxtrading.com`, `www` y `api` ya tienen registros proxied en Cloudflare (el usuario confirmó que el primero y el tercero no sirven nada y se pueden sustituir); `ssh.amfxtrading.com` no existe.

## Cambios por capa

### infra — máquina nueva

1. **Sistema base**: zona horaria UTC (ya lo está), plan de energía sin suspensión, Windows Update restringido para que nunca reinicie por su cuenta en horario de mercado, exclusiones de Defender para `C:\amfxtrading`, el directorio de datos de PostgreSQL y las carpetas de MT4.
2. **Software, mismas versiones que el inventario**: Node 24.16.0, git, pm2 7.0.1 (`npm i -g`), PostgreSQL 17 (instalador silencioso, mismo puerto, mismo rol y contraseña que `DATABASE_URL`), nginx (la carpeta `C:\nginx` entera copiada, con su `nginx.conf` y el `server_name` adaptado si nombra `v2`) registrado como servicio con `nssm`, cloudflared 2026.6.0.
3. **Proyecto**: `git clone` en `C:\amfxtrading`; `backend\.env` y `backend\brokers.json` copiados del VPS antiguo; `npm install`, `prisma generate`, build del backend, build del frontend con `VITE_API_BASE=https://api.amfxtrading.com`.
4. **Tareas**: `register-startup-tasks.ps1` para `AMFX-Startup` / `AMFX-Watchdog`; `RAM-Log` y `PoolWatch` replicadas; se crean `C:\monitoring` y `C:\deploy`.
5. **Autologon**: el usuario, por RDP.

### infra — túnel, DNS y Access

- **Túnel nuevo** `amfxtrading` creado en el VPS nuevo con `cloudflared tunnel create`, autorizado por el `cert.pem` copiado del VPS antiguo (autoriza toda la zona). Aún sin verificar: si ese certificado se rechaza, el usuario ejecuta `cloudflared tunnel login` una vez por RDP.
- **Ingress**: `amfxtrading.com` → `http://localhost:80`, `api.amfxtrading.com` → `http://localhost:3000`, `ssh.amfxtrading.com` → `ssh://localhost:22`, 404 para el resto. Servicio instalado como en el VPS antiguo (LocalSystem, `--config` apuntando al perfil del usuario).
- **DNS**: `cloudflared tunnel route dns --overwrite-dns` para los tres nombres. Esto **sustituye los registros existentes** de `amfxtrading.com` y `api.amfxtrading.com`; `www` se deja como está. Los tres nombres son de un solo nivel o raíz, así que los cubre el Universal SSL.
- **Access**: `ssh.amfxtrading.com` debe protegerse igual que `ssh-v2` (política Service Auth para el token `github-actions` + Allow para el email del usuario). **El usuario añade el hostname a la aplicación "VPS SSH" existente en el panel**; esto no se puede hacer con el certificado del túnel. Hasta entonces el SSH va por la IP y el puerto 22; después ese puerto se cierra en Windows y en la política de IONOS.

### backend

- **Código**: `ALLOWED_ORIGINS` en `src/ws/policy.ts` es `/\.amfxtrading\.com(:\d+)?$/`, que exige un subdominio: el dominio raíz `https://amfxtrading.com` lo rechazan hoy tanto CORS como el upgrade del WebSocket. El patrón se amplía para aceptar también la raíz, con su caso de test. Los subdominios siguen funcionando, así que el sistema antiguo no se ve afectado.
- `scripts/db-tunnel.ps1`: hostname `ssh-v2` → `ssh`.
- Configuración en el VPS nuevo: `.env` copiado sin cambios (el `COOKIE_DOMAIN` por defecto `.amfxtrading.com` ya cubre la raíz y `api`), más `FEATURE_ALERTS=false` hasta el cambio.

### frontend

- `scripts/deploy.ps1` escribe `VITE_API_BASE=https://api-v2.amfxtrading.com` → `https://api.amfxtrading.com`. Cualquier otra dirección `v2` escrita en `frontend/src` que aparezca durante la implementación se lista y se cambia en la misma tarea.

### .github

- Los tres workflows: `ssh-v2.amfxtrading.com` → `ssh.amfxtrading.com`. Secrets sin cambios (misma clave, mismo service token, mismo usuario). A partir de este commit los pipelines despliegan **solo en el VPS nuevo**; el antiguo queda congelado en su último commit desplegado.

### db

`pg_dump -Fc` en el VPS antiguo → fichero pasado a través del PC del desarrollador → `pg_restore` en una base vacía del VPS nuevo. Se hace dos veces: un ensayo durante la preparación y la copia final en el cambio. El backend antiguo **no se para** para la copia final: las tablas que alimenta el EA (`candles`, `trades`, `balances`, `balance_operations`) las rellenan en el VPS nuevo sus propios terminales (histórico completo de velas y trades al arrancar el EA, las últimas 100 velas cada 60 s); las tablas creadas por el usuario se copian tal como estén en ese momento, y a partir de ahí el usuario no crea nada en el sistema antiguo. Verificación: recuento de filas de las tablas creadas por el usuario igual en ambos lados, `prisma migrate diff` vacío. Un dump/restore reescribe todas las páginas, así que no arrastra ningún bloque dañado; un error "invalid page" durante el `pg_dump` se reintenta (comportamiento transitorio conocido de la máquina antigua).

### db — velas (añadido durante la tarea 5)

La tabla `candles` del VPS antiguo (7,77 millones de filas, 2 GB) tiene al menos una fila dañada de forma permanente: `pg_dump` falla siempre en ella (`invalid memory alloc request size`), y una consulta agregada sobre la tabla tumbó un proceso servidor de PostgreSQL en producción. Por eso **no** forma parte del dump (`--exclude-table-data=public.candles`). Decisión del usuario: **las velas no se migran**. El VPS nuevo arranca con la tabla `candles` vacía y sus terminales la rellenan (el EA escribe todas las velas disponibles de cada símbolo y temporalidad al arrancar, y después las últimas 100 cada 60 s); con lo que los brokers sirven por MT4 es suficiente. Se renuncia a las velas más antiguas que el histórico que conserva MT4, y la tabla antigua no se vuelve a leer.

### ea — terminales MT4

Copiar las 13 carpetas de instalación y todo el árbol `MetaQuotes\Terminal` a las **mismas rutas**. El hash de la carpeta de datos se deriva de la ruta de instalación, así que los hashes, `origin.txt`, `brokers.json` y el `config.json` de cada bridge siguen siendo válidos. Los 13 terminales corren en las dos máquinas a la vez (autorizado por el usuario).

## Quitar el nombre `v2`

Pedido por el usuario durante la implementación (después de la tarea 4): en el sistema nuevo el nombre es `amfxtrading`, sin `v2`.

| Dónde | Antiguo | Nuevo | En esta spec |
|---|---|---|---|
| Carpeta del proyecto en el servidor | `C:\amfxtradingv2` | `C:\amfxtrading` | sí |
| Base de datos | `amfxtradingv2` | `amfxtrading` | sí (se crea con el nombre nuevo; el dump se restaura en ella) |
| Nombres públicos | `v2`, `api-v2`, `ssh-v2` | raíz, `api`, `ssh` | sí |
| Túnel | `amfxtrading-v2` | `amfxtrading` | sí |
| Repositorio de GitHub `odeslad/amfxtradingv2` y carpeta local | — | — | **no**: ahí el nombre `amfxtrading` lo ocupa el MVP v1; el usuario lo decide más adelante |

Consecuencias:

- El repo lleva escrito `C:\amfxtradingv2` en 14 ficheros (workflows, `backend/scripts/deploy.ps1`, `backend/ecosystem.config.js`, `backend/.env.example`, `frontend/scripts/deploy.ps1`, `ea/scripts/*.ps1`, `infra/scripts/*.ps1`, documentación). Pasan a `C:\amfxtrading` en los mismos commits que cambian los nombres de host, un commit por capa.
- Una vez esos commits estén en `master`, los scripts del repo ya no encajan con el VPS antiguo. Un push antes de que los workflows apunten al host nuevo lanzaría los pipelines contra la máquina antigua con las rutas nuevas (el workflow del EA incluso crearía la carpeta y reiniciaría los terminales), así que **los commits de rutas y de nombres de host se suben juntos, y solo cuando el túnel nuevo responda**. Eso adelanta el túnel (tarea 8) y los cambios del repo (tareas 9–12) al ensayo de la base de datos y a los terminales (tareas 5–7).
- `backend\.env` en el VPS nuevo: `DATABASE_URL` → base `amfxtrading`, `BROKERS_FILE` → `C:\amfxtrading\backend\brokers.json`. `nginx.conf`: `root C:/amfxtrading/frontend/dist`.

## Reglas de convivencia

- **Alertas en una sola máquina.** Las dos bases tienen las mismas alertas y suscripciones push; con las alertas activas en las dos, cada alerta notificaría dos veces. Antiguo = activas y nuevo = `FEATURE_ALERTS=false` hasta el cambio; después, al revés.
- **Comandos.** Cualquiera de los dos backends puede enviar órdenes a las mismas cuentas a través de sus propios terminales. Es seguro (cada orden la ejecuta una sola vez el terminal de la máquina que la recibió, y las dos máquinas ven después la posición), pero el usuario debería operar desde una sola dirección cada vez.
- **Los datos del usuario viven donde se crean.** Alertas, dibujos, ajustes, presets de mirror y el libro no se sincronizan entre las dos bases.
- **Sesiones.** Mismo `JWT_SECRET` y dominio de cookie `.amfxtrading.com`: una sesión abierta en una dirección vale en la otra.
- **Push y app instalada.** El service worker y la suscripción push pertenecen al origen: en `amfxtrading.com` el usuario reinstala la app en el móvil y reactiva las notificaciones. Las suscripciones copiadas del origen antiguo siguen en la base nueva, así que la app antigua instalada también recibiría las notificaciones del sistema nuevo hasta que se desinstale.

## Secuencia

1. **Preparación** (sistema antiguo sin tocar): sistema base, software, proyecto, base de datos de ensayo, 13 terminales, tareas, Autologon, prueba de reinicio. Se prueba por redirección de puertos por SSH.
2. **Publicación**: cambio de backend desplegado, túnel, DNS, hostname en Access, workflows y scripts de deploy apuntando a los nombres nuevos; puerto 22 cerrado. El sistema nuevo ya es accesible en `amfxtrading.com` con datos de ensayo y alertas apagadas. El antiguo sigue siendo producción.
3. **Cambio** (fin de semana, sin parada para el usuario): copia final de la base de datos (el backend nuevo se para esos minutos; la dirección antigua sigue funcionando), alertas apagadas en el antiguo y encendidas en el nuevo, el usuario pasa a `amfxtrading.com`.
4. **Observación** (14 días): sistema antiguo en marcha como respaldo con las alertas apagadas. Después el usuario lo apaga y lo da de baja.

### Vuelta atrás

Volver a `v2.amfxtrading.com`, reactivar las alertas en el backend antiguo y desactivarlas en el nuevo. Los datos creados en el sistema nuevo tras el cambio (alertas, dibujos, ajustes, libro) se llevan de vuelta con un dump de esas tablas; velas y trades no necesitan nada. Los pipelines de deploy habría que volver a apuntarlos a `ssh-v2` (revert de un commit). El procedimiento queda escrito en `verification.md` antes del cambio.

## Ficheros del repo a tocar

- `backend/src/ws/policy.ts`, `backend/src/ws/policy.test.ts` — origen raíz.
- `backend/scripts/db-tunnel.ps1` — hostname SSH.
- `frontend/scripts/deploy.ps1` — dirección del API.
- `.github/workflows/deploy-backend.yml`, `deploy-frontend.yml`, `deploy-ea.yml` — hostname SSH.
- `infra/README.md`, `ea/docs/deploy.md`, `backend/docs/architecture.md`, `.claude/CLAUDE.md` — documentación.
- `specs/043-vps-migration/{en,es}/verification.md`.

Fuera del repo: `~/.ssh/config` en el PC del desarrollador (`amfx-vps` → nuevo, `amfx-vps-old` → antiguo).

## Dependencias

No se añade ninguna.

## Riesgos

- **Los registros de la raíz y de `api` ya existen** y se sobrescriben. El usuario afirmó que ahí no se sirve nada; aquello a lo que apunten hoy esos registros deja de ser accesible.
- **`cert.pem` puede no autorizar la creación del túnel o de las rutas DNS** (no verificado). Alternativa: `cloudflared tunnel login` por parte del usuario.
- **Los logins guardados de MT4 pueden no sobrevivir a la copia** (no verificado). El usuario inicia sesión por RDP donde haga falta; la preparación lo revela para los 13.
- **Un broker puede limitar las sesiones simultáneas** de una cuenta. Se vería como una desconexión en uno de los lados; si afecta al VPS antiguo antes del cambio, ese terminal se cierra en el nuevo.
- **El sistema antiguo deja de recibir deploys** cuando los workflows apuntan al nuevo. La publicación y el cambio deberían estar separados por días, no por semanas.
- **Dos sistemas vivos que aceptan comandos.** Se mitiga con que el usuario opere desde una sola dirección cada vez; no se impone técnicamente.
- **El host nuevo podría tener sus propios problemas de hardware** (mismo proveedor): 14 días de observación con el sistema antiguo aún en marcha.
- **El puerto 22 es público durante la preparación** (login solo por clave). Se cierra en cuanto funcionen el túnel y el hostname en Access.
