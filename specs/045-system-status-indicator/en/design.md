# 045 — System status indicator · Design

## Approach

The backend already knows, per broker, whether the EA holds the pipe and how old its last tick is. It learns two more things — the server's load and whether each terminal is loading history — reduces everything to one level (`ok` / `warn` / `bad`) with the reasons, and pushes that small summary to every open app over the WebSocket every 5 seconds. The frontend only draws it: a light in the footer and a tooltip. The one thing the frontend decides by itself is the case the backend cannot report: that the connection to the backend is lost.

## Mockup

Approved by the user on 2026-11-17: https://claude.ai/artifact/Jx9zzR2QdCdrS4WCwueqpQ

| Artboard | Shows |
|---|---|
| Desktop · orange | Footer light and tooltip while three terminals load history, with progress and tick delay per broker |
| Desktop · green | All normal, short tooltip |
| Desktop · red | A broker disconnected for 4 minutes and another restarting |
| Mobile · orange, sheet open | The light in the header and the same content in a bottom sheet |

Layout rules taken from it: tooltip 440 px wide with 24 px padding and 20 px between blocks; one headline sentence; four server figures; only the brokers that need attention are listed, the rest summarised in one line; a closing sentence saying whether anything has to be done; broker rows follow the Devices panel pattern (data in DM Mono 14 px, state as a small uppercase label); red is a square, not a circle, so it differs by shape too. Texts in English, as in the rest of the app.

## Data flow

```
EA ──pipe──▶ backend ──WS 'system' every 5 s──▶ frontend light + tooltip
 │ ticks (existing)        ├─ per broker: pipe state, tick delay, history load progress
 └ {"type":"status",…}     └─ server: CPU %, free memory
```

## EA — `ea/HttpBridgeState.mq4`

A new pipe message every 5 seconds: `{"type":"status","version":"3.17","loading":true,"loadDone":12,"loadTotal":75}`. It is the EA that knows how far its history load is (`g_loadPair` / `g_pairCount`); `loading` is true until the load finishes and while full exports are queued.

Contract: one message type is added. A backend that does not know it must ignore it (checked in the first backend task); an EA that does not send it is shown without progress.

## Backend

### Inputs

- **Per broker** (`store/liveness.ts`, extended): pipe state and age of the last tick, as today, plus the time since the pipe was lost and the last `status` message of the EA.
- **Server** (new `services/server-load.ts`): CPU from the difference between two `os.cpus()` readings 5 seconds apart, free and total memory from `os`. No dependency added.
- **Hidden brokers**: `hiddenBrokers` of the global display settings, read at start and refreshed when Settings are saved. Hidden brokers are left out of the level and of the list.

### Reduction to one level — `services/system-status.ts` (pure, tested)

Broker state:

| State | When |
|---|---|
| `connected` | Pipe connected and the EA is not loading |
| `loading` | Pipe connected and the EA says it is loading history (with its progress) |
| `restarting` | Pipe lost for less than the grace period |
| `disconnected` | Pipe lost for longer |

Level, the worst of all rules:

| Rule | Orange (`warn`) | Red (`bad`) |
|---|---|---|
| Broker state | any `loading` or `restarting` | any `disconnected` |
| Tick delay of a connected broker | ≥ 5 s | ≥ 60 s |
| CPU, averaged | ≥ 85 % over 15 s | ≥ 95 % over 60 s |
| Free memory | < 10 % | < 5 % |

The thresholds and the grace period (120 s) live in one exported constant of that file. A value has to hold for two consecutive samples before it changes the level, so one spike does not flicker the light. The tick delay is the time since the last pipe message of the terminal, of any type (`touchTick` in `pipe-reader.ts` already works this way): the EA runs on one thread, so when it stalls everything stops together. With the market closed the EA keeps sending its batches, positions and account on its timer, so the delay stays at zero and nothing special is needed.

### Delivery

- WebSocket message `system` to every client every 5 seconds: `{ type: 'system', level, server: { cpuPct, freeMemMb, totalMemMb }, brokers: [{ name, state, tickDelayS, loadDone?, loadTotal?, disconnectedS? }], at }`. Around 1 KB.
- `GET /status` (authenticated) returns the same object, for the first paint before the first WebSocket message.
- `GET /health` is not changed: the deploy script and the watchdog depend on it.

## Frontend

- `lib/useSystemStatus.ts`: keeps the last `system` message. If the WebSocket is down, or no message arrived for 20 seconds, the level is `bad` with the reason "connection to the server lost" — decided in the browser, because the backend cannot say it.
- `app/layout/SystemStatus.tsx` + CSS module: the light (a `<button>`), the tooltip on hover and keyboard focus on desktop, and a bottom sheet on tap on mobile, built to the mockup with the design-system variables. Rendered in the footer of `AppLayout` on desktop and in its header on mobile, where the footer is hidden.
- The sentences (headline, closing line, state labels) are composed in the frontend from the level and the broker states, in English.
- The secondary grey of the mockup (`#9a9a9a`) is lighter than `--muted` (`#666`), which does not reach a readable contrast at 9–11 px. It is added as a design-system variable (`--muted-strong`) and documented in `.claude/CLAUDE.md`; existing screens are not touched.

## Files to touch

- `ea/HttpBridgeState.mq4`, `ea/docs/HttpBridgeState.md`
- `backend/src/bridge/pipe-reader.ts`, `backend/src/store/liveness.ts`, `backend/src/services/system-status.ts` (new), `backend/src/services/server-load.ts` (new), `backend/src/ws/ws.ts`, `backend/src/app.ts`, `backend/src/index.ts`, tests, `backend/docs/architecture.md`
- `frontend/src/lib/useSystemStatus.ts` (new), `frontend/src/app/layout/SystemStatus.tsx` + `.module.css` (new), `frontend/src/app/layout/AppLayout.tsx` + `.module.css`, the global variables file
- `.claude/CLAUDE.md` (WebSocket messages, design-system variable)

No database change. No dependency added.

## Deploy

Backend → frontend → EA. **The EA goes last and with the market closed**: reloading the terminals triggers the history load, during which ticks arrive late (measured on 2026-11-17: peaks of 83–107 s). Until the EA is deployed the light works without the history-load progress: a terminal that is loading is shown as connected, with whatever tick delay it has.

## Risks

- **The light itself must not add load.** One `os.cpus()` reading and one 1 KB broadcast every 5 seconds; measured in the validation.
- **Thresholds are a first guess.** They are in one constant so they can be tuned after watching the light for a few days.
- **CPU reading on Windows.** `os.cpus()` times are cumulative per core; the percentage is computed from deltas and checked against Task Manager in the validation.
- **A hidden broker that fails is invisible** to the light, by design (AC 7).
