# 056 — Símbolos de cada broker desde el frontend · Verificación

## Tarea 1 · [backend] Ficheros de símbolos del broker

- **Mecanismo:** lint + typecheck + test + build.
- **Pasos:** `services/broker-symbols.ts`: `isTrackedPair` (cruces de AUD, EUR, NZD, USD, CAD, GBP, JPY por las seis primeras letras, admite sufijo), `readAvailable` (`symbols-available.json`, tolera BOM, null hasta que el EA informa, únicos y ordenados), `readActive` (lista separada por comas de `config.json`), `writeActive` (conserva el resto de campos, `.tmp` + rename, `BrokerSymbolsError` si falta la carpeta o el fichero no se puede leer); tests sobre una carpeta temporal.
- **Resultado:** ✅ 4 tests en verde, typecheck, build y lint limpios.
- **Est vs Real:** 1.5 SP · 0.5 SP.
