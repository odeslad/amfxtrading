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
