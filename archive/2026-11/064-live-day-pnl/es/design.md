# 064 — Day P&L en vivo sin consultas periódicas · Diseño

> Status: **approved**

## Enfoque

Separar el Day P&L en sus dos partes, cada una donde ya vive:

- **Cerrado hoy**: solo cambia cuando se cierra una operación. El backend lo guarda en memoria por broker, lo recalcula una vez por cambio y lo envía dentro del mensaje `account` del WebSocket.
- **Flotante**: `equity − balance` del mensaje `account`, que ya llega cada segundo y mueve la columna Profit. Incluye swap y comisión, igual que la suma actual sobre las posiciones abiertas.

El frontend suma las dos partes al llegar cada mensaje `account`. Ya nada hace consultas periódicas.

### Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **A. Cerrado hoy en caché en el backend, enviado en `account`; flotante = equity − balance (elegida)** | Sin consultas periódicas, casi sin trabajo en la base de datos, el Day P&L se mueve con el Profit, sin tipo de mensaje nuevo | El mensaje `account` gana un campo |
| B. Mantener las consultas periódicas y cachear la suma en el backend | Un cambio pequeño en el backend | Siguen siendo unas 720 peticiones por hora y pestaña; el Day P&L sigue moviéndose cada 5 s |
| C. El frontend suma las posiciones abiertas del feed `positions` | La misma cifra que la parte flotante actual | El feed de posiciones en vivo solo corre en la página del Diario; equity − balance ya viene en el mensaje y es la cifra del propio broker |

## Flujo de datos

```
watcher: history.json con cambios → syncTrades → closedToday.refresh(broker)   (1 suma)
cambio de día del broker (se comprueba al enviar un mensaje account) → closedToday.refresh(broker)
arranque → el primer mensaje account de cada broker lanza su recálculo
pipe / watcher account → wss.broadcastAccount(broker, account)
   → { type: "account", broker, account, closedToday: number | null }   (null mientras el pipe no está vivo o el valor no está listo)
Accounts → dayPnl[broker] = closedToday == null ? undefined : closedToday + equity − balance
```

## Cambios por capa

### [backend]
- `store/closed-today.ts` (nuevo): `createClosedToday(aggregate, now)` con una caché por broker `{ dayStart, value }`.
  - `get(broker, brokerOffset)` devuelve el valor guardado del día actual del broker. Si aún no hay valor o es un día nuevo, lanza un recálculo: uno a la vez por broker, y el valor es `null` hasta que llega.
  - `refresh(broker, brokerOffset)` hace la misma suma que `/balances/daily-pnl` hoy (beneficio + swap + comisión de las operaciones con `closeTime` ≥ la medianoche del broker). Escribe `[DAYPNL] <broker> recomputed` en el log para la medición.
  - El límite del día es el mismo código de hoy, movido aquí: `brokerOffset`, `setUTCHours(0,0,0,0)`.
- `index.ts`:
  - `watcher.onHistory` llama a `closedToday.refresh(broker, brokerOffset)` después de `syncTrades` (AC 3);
  - los dos orígenes del mensaje de cuenta pasan por `broadcastAccount`, como hoy.
- `ws.ts`: `broadcastAccount(broker, account, closedToday)` añade `closedToday` en la raíz, `null` cuando `isPipeLive` es false (AC 6), sea cual sea el origen del mensaje.
- `routes/balances.ts`: `GET /balances/daily-pnl` se elimina cuando el frontend deja de usarla (tarea 3; no tiene otro consumidor).

### [frontend]
- `Accounts.tsx`: se eliminan el efecto de consulta periódica y su gestión de visibilidad (AC 1). El manejador WS de `account` guarda `closedToday` por broker; `dayPnl` se deriva como `closedToday + equity − balance` (AC 2). La fila inactiva sigue dependiendo de `dayPnl == null` (AC 6). `AccountCard` (móvil) recibe el mismo valor.

Sin dependencias nuevas. Sin cambios visuales, así que sin maqueta: la tabla y las tarjetas se ven exactamente como hoy.

## Contrato
- EA ↔ backend: sin cambios.
- WS `account`: gana `closedToday` (un número o `null`); el resto de campos no cambia.
- HTTP: desaparece `GET /balances/daily-pnl` (solo la usaba Accounts).

## Medición (AC 7)
- **Antes**, a partir del código y los logs: una pestaña de Accounts supone 720 peticiones por hora, cada una con una suma por broker vivo (13) = unas 9 360 sumas por hora.
- **Después**: contar las líneas `[DAYPNL]` del log de pm2 durante una hora con una pestaña de Accounts abierta, y confirmar en la pestaña de red del navegador que no se repite ninguna petición.

## Archivos a tocar
- backend: `src/store/closed-today.ts` (+ test), `src/index.ts`, `src/ws/ws.ts`, `src/routes/balances.ts`
- frontend: `src/features/journal/Accounts.tsx`
- docs: `backend/docs/architecture.md` y `.claude/CLAUDE.md` (el mensaje `account`, la ruta eliminada)

## Riesgos
- **Orden de los despliegues:** primero el backend añade `closedToday` y conserva la ruta antigua, así que el frontend actual sigue funcionando. Después cambia el frontend, y solo entonces se elimina la ruta (tarea 3).
- **Una operación cerrada entre dos archivos de historial:** la parte cerrada espera al siguiente historial, como hoy (fuera de alcance).
- **La equity de un broker cuyo EA se detiene:** su pipe deja de estar vivo, así que `closedToday` es `null` y la fila se apaga, como hoy.
