# 050 — Migrar la plataforma al VPS XL+

> Status: **closed**

## Contexto

Todo corre en un VPS M+ de IONOS (Windows Server 2025, 4 vCPU, 4 GB de RAM): los 13 terminales MT4 con sus EA, el backend (Node + pm2), el frontend servido por nginx, PostgreSQL, las tareas de arranque y watchdog, y el túnel de Cloudflare que publica `amfxtrading.com`, `api.amfxtrading.com` y `ssh.amfxtrading.com`. Entre el 17 de julio y el 18 de noviembre de 2026 el M+ se colgó 26 veces, siempre con el bugcheck `0x1A / 0x3F`. WinDbg sitúa la causa por debajo del sistema invitado: las páginas escritas en el fichero de paginación vuelven cambiadas, lo que apunta a la memoria o al almacenamiento del host. El informe para IONOS lo tiene el operador; no se espera al resultado de su revisión.

La spec 049 dejó la base de datos pequeña y sana (430 MB, `pg_dump` completo en 9 s), así que ya se puede copiar entera. Hay un VPS XL+ ya contratado (8 vCPU EPYC Milan a 2,0 GHz, 16 GB de RAM, Windows Server 2025), accesible por SSH y configurado como el M+ (Defender desactivado con exclusiones, los mismos 11 servicios desactivados). Es más lento por núcleo que el M+ en el benchmark y se puede devolver en los 30 días siguientes a la compra (hacia el 18 de diciembre de 2026).

## Capas afectadas

- infra (servidor nuevo, túnel de Cloudflare, tareas programadas, nginx, pm2, pipelines de despliegue, acceso al servidor desde el PC del operador)
- db (copia de la base de datos; sin cambios de esquema)
- backend, frontend, ea: se despliegan sin cambios en el servidor nuevo; cambios de código solo si aparece una ruta o ajuste ligado al servidor viejo

## Historias de usuario

- Como operador, quiero toda la plataforma en el XL+, para que deje de colgarse.
- Como operador, quiero hacer el cambio en una ventana corta con el mercado cerrado, para no afectar a la operativa.
- Como operador, quiero poder volver al M+ si el XL+ falla en los primeros días, para que el cambio no tenga riesgo.
- Como usuario de la app, quiero la misma dirección, el mismo login y los mismos datos tras el cambio, para no notar nada.

## Criterios de aceptación

- AC 1. CUANDO termine el cambio ENTONCES `amfxtrading.com`, `api.amfxtrading.com` y `ssh.amfxtrading.com` los sirve el XL+, con las mismas direcciones que antes.
- AC 2. CUANDO se copie la base de datos ENTONCES cada tabla tiene el mismo número de filas en los dos servidores (registrado), y la copia hecha en el cambio se guarda hasta que el operador valide.
- AC 3. CUANDO termine el cambio ENTONCES los 13 terminales corren en el XL+ con sus EA y están conectados los mismos brokers que antes (`/health`).
- AC 4. CUANDO termine el cambio ENTONCES ticks, posiciones, historial, balances, gráficos, alertas (de precio y de EMA, con Web Push), órdenes y la sincronización de velas funcionan como antes.
- AC 5. CUANDO se haga un push tras el cambio ENTONCES los pipelines del backend, el frontend y el EA despliegan en el XL+ y no en el M+.
- AC 6. CUANDO el XL+ se reinicie ENTONCES todo vuelve solo como en el M+ (autologon, tarea de arranque, terminales, backend, nginx, túnel), y el watchdog funciona.
- AC 7. MIENTRAS se hace el cambio ENTONCES el mercado está cerrado y, hasta dar de baja el M+, este se puede volver a arrancar como estaba.
- AC 8. CUANDO el operador se conecte desde el PC ENTONCES `ssh amfx-vps`, el túnel de la base de datos y los scripts de despliegue llegan al XL+.
- AC 9. CUANDO el XL+ funcione con los 13 terminales abiertos ENTONCES se mide y se registra su uso de memoria, con el registro de RAM funcionando.
- AC 10. CUANDO pasen las dos primeras semanas ENTONCES el XL+ no muestra ningún bugcheck ni apagado inesperado en el registro de eventos, antes de dar de baja el M+.
- AC 11. CUANDO cambie el repositorio ENTONCES no se sube ninguna IP ni ningún secreto (el repositorio es público).

## Fuera de alcance

- Cualquier cambio de comportamiento de la app, el backend o el EA.
- Esperar la respuesta de IONOS sobre el M+.
- Un servidor dedicado o un servidor en casa.
- La web corporativa de `www.amfxtrading.com`.
- Hacer el XL+ más rápido por núcleo.
