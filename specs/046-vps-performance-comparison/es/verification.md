# 046 — Comparación de rendimiento de los VPS · Verificación

## Tarea 1 — scripts de medición

- **Mecanismo:** manual — los dos scripts se ejecutan en los dos servidores y devuelven cifras completas de los 13 brokers.
- **Comandos:** `scp measure.ps1 bench.js <servidor>:` · `powershell -File measure.ps1` en los dos servidores en el mismo momento (2026-11-17 11:32:14 UTC) · `node bench.js` en los dos justo después.
- **Resultado:** ✅ correcto — los dos scripts devolvieron una línea de JSON en cada servidor, con los 13 terminales identificados por broker, los 13 brokers en las lecturas de ticks (119 lecturas cada uno, ninguna lectura fallida de `/health`) y las cinco pasadas de un hilo más las cuatro en paralelo.
- **Est vs Actual:** 1.5 SP vs 1 SP.

Ejecución de prueba (no es una ronda de la prueba: la igualdad de los dos servidores se comprueba en la tarea 2):

| | VPS nuevo | VPS viejo |
|---|---|---|
| CPU total | 49,8 % | 28,2 % |
| 13 terminales (100 = un núcleo) | 159,7 | 77,2 |
| Backend y otros procesos de Node | 14,5 | 9,6 |
| Base de datos | 3,1 | 2,3 |
| Antivirus | 1,0 | 0 |
| Resto | 21,0 | 23,7 |
| Memoria libre | 4003 MB | 1248 MB |
| Brokers con ticks tardíos (1 s o más) | 6 de 13 (peores: Demo 15,1 % de las lecturas, FTMO 11,8 %, hasta 2 s) | 0 de 13 |
| Brokers sin ningún tick | 3 (solidary aymerich, solidary isa, solidary jessy) | 1 (solidary isa) |
| Velocidad, un hilo (mejor de 5) | 1529 ms | 1034 ms |
| Velocidad, cuatro hilos a la vez (tiempo total) | 1857 ms | 1366 ms |

A mirar en la tarea 2: por qué tres brokers del servidor nuevo y uno del viejo no dieron ningún tick durante la ventana.

## Tarea 2 — los dos servidores iguales

- **Mecanismo:** manual — estado de los dos servidores leído en los propios servidores (2026-11-17, 11:35–11:45 UTC); diferencias comunicadas al operador antes de medir.
- **Resultado:** ✅ correcto con dos diferencias aceptadas por el operador el 2026-11-17 como no relevantes: los dos brokers sin conectar en el servidor nuevo y los ficheros del EA del terminal Demo del viejo. La comparación terminal a terminal usa el resto de brokers.
- **Est vs Actual:** 1 SP vs 1.5 SP — hubo que encontrar e igualar más diferencias de las previstas.

| | VPS nuevo | VPS viejo | Igual |
|---|---|---|---|
| Código de backend y frontend frente a `4e8022c` | sin diferencias | sin diferencias | sí |
| Código del EA | compilado el 2026-11-17 a partir del código de `4e8022c` | compilado el 2026-10-29 (último cambio del EA antes de `4e8022c`) | sí |
| Versión del EA en el arranque de cada terminal | State v3.13 · Commands v2.22 | State v3.13 · Commands v2.22 | sí |
| Compilación de MT4 | 1492 | 1492 | sí |
| Plan de energía de Windows | Equilibrado | Equilibrado | sí |
| Símbolos por broker | mismas listas | mismas listas | sí |
| `solidary isa` | sin EA en sus gráficos | sin EA en sus gráficos | sí (12 brokers activos en cada uno) |
| Gráficos abiertos por terminal | Demo 9, mick 4, II 4, manu 3, FTMO 3, solidary 3 → **2 en todos tras cerrar el operador los que sobraban** | 2 en todos | sí, desde ~11:40 UTC |
| Antivirus en tiempo real | activado → **desactivado para la prueba** | desactivado | sí, desde ~11:40 UTC |
| Alertas (`FEATURE_ALERTS`) | true → **puesto a false para la prueba**, backend reiniciado | false | sí, desde ~11:44 UTC |
| `solidary jessy`, `solidary aymerich` | sin conectar desde un reinicio a las 11:12 UTC (aymerich: el EA State ya no está en su gráfico) | conectados | no (aceptada) |
| Ficheros del EA del terminal Demo | desplegados el 2026-11-17 | compilados a mano el 2026-11-16 12:51, distintos de los otros 12 terminales | no se sabe (aceptada) |
| Histórico en disco del terminal Demo | 139 MB | 15 MB | no (anotado; no se cambia) |

**A restaurar en el servidor nuevo cuando termine la prueba:** antivirus en tiempo real activado (`Set-MpPreference -DisableRealtimeMonitoring $false`) y `FEATURE_ALERTS=true` en `backend/.env` más un reinicio del backend.
