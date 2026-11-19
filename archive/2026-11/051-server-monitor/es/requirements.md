# 051 — Monitor del servidor en Settings

> Status: **closed**

## Contexto

Todo corre en un VPS Windows (el XL+ desde la spec 050): 13 terminales MT4 con sus EA, el backend, PostgreSQL, nginx y el túnel de Cloudflare. Hoy el operador solo sabe cómo está el servidor preguntando por SSH o RDP: memoria, CPU, cuándo se reinició por última vez, si se colgó, si todos los terminales están en marcha. Los cuelgues del servidor anterior (26 bugchecks entre julio y noviembre de 2026) pasaron meses sin verse porque nada los mostraba. La app ya enseña el estado de conexión de los brokers (`/health`), pero no la máquina.

## Capas afectadas

- backend (recoger los datos del servidor, guardar un historial, un endpoint)
- frontend (una pestaña nueva en Settings)
- db (tabla para el historial)

## Historias de usuario

- Como operador, quiero ver de un vistazo cómo está el servidor ahora mismo (CPU, memoria, disco, tiempo encendido, servicios, terminales), para no necesitar SSH ni RDP.
- Como operador, quiero ver cuándo se reinició el servidor por última vez y si fue un cuelgue, para que un cuelgue no vuelva a pasar desapercibido.
- Como operador, quiero ver la CPU y la memoria de las últimas horas y días, para distinguir un pico puntual de una tendencia.
- Como operador, quiero ver cada terminal MT4 y si está en marcha y enviando ticks, para saber qué cuenta necesita atención.

## Criterios de aceptación

- AC 1. CUANDO el operador abra Settings › Server ENTONCES ve el nombre del equipo, la versión de Windows, los núcleos de CPU, la memoria total, la hora del último arranque y el tiempo encendido.
- AC 2. CUANDO la pestaña esté abierta ENTONCES se muestran el uso de CPU, la memoria en uso, el uso del fichero de paginación y el disco libre, refrescados al menos cada 15 segundos sin recargar la página.
- AC 3. CUANDO la pestaña esté abierta ENTONCES muestra el estado de los servicios de los que depende la plataforma (PostgreSQL, nginx, túnel de Cloudflare, SSH) y del proceso del backend (tiempo encendido, memoria, reinicios).
- AC 4. CUANDO la pestaña esté abierta ENTONCES lista cada broker de `brokers.json` con si su terminal está en marcha, el estado de su pipe, la antigüedad de su último tick y la memoria del terminal.
- AC 5. CUANDO el servidor se haya reiniciado de forma inesperada o haya tenido un bugcheck en los últimos 30 días ENTONCES la pestaña lista cada evento con su fecha y su tipo (cuelgue con su código, o apagado inesperado), y el último arranque se marca como posterior a un cuelgue.
- AC 6. CUANDO el operador elija un rango de 24 horas o 7 días ENTONCES unas gráficas muestran la CPU y la memoria en uso en ese rango, a partir de muestras tomadas al menos una vez por minuto.
- AC 7. CUANDO el servidor se reinicie ENTONCES el historial se conserva (se guarda, no vive solo en memoria) y el hueco del reinicio se ve en las gráficas.
- AC 8. CUANDO las muestras tengan más de 7 días ENTONCES se borran, para que el historial no crezca sin límite.
- AC 9. CUANDO se recojan los datos ENTONCES el uso de CPU del propio monitor en el backend es despreciable (muy por debajo del 1 % de media).
- AC 10. CUANDO alguien no haya iniciado sesión ENTONCES los datos no son accesibles (la misma autenticación que el resto de la API).
- AC 11. CUANDO la página se vea en un móvil ENTONCES se lee bien (tarjetas en móvil, tablas en escritorio).

## Fuera de alcance

- Notificaciones push o avisos cuando algo va mal (una spec posterior).
- Actuar sobre el servidor desde la app (reiniciar terminales, servicios o la máquina).
- Vigilar otras máquinas (el M+ antiguo incluido).
- Tráfico de red y CPU por proceso de todos los procesos de Windows.
