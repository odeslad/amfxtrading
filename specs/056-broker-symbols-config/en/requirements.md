# 056 — Broker symbols from the frontend

> Status: **approved**

## Context
Each MT4 terminal reads `bridge/config.json` (`brokerName`, `symbols`) when the EA starts; `symbols` decides which pairs the EA streams to the backend (ticks, active candles, candle files). Today the file is edited by hand on the server and a change needs the EA to be restarted. Separately, Settings › Visibility hides brokers and symbols only in the frontend (`settings_display.hiddenSymbols`): a hidden symbol is still received. The backend already knows each broker's bridge folder (`brokers.json`).

## Affected layers
- ea · backend · db · frontend

## User stories
- As the operator, I want to choose from the frontend which of the broker's symbols each EA sends, so that I don't edit files on the server.
- As the operator, I want one place to decide which symbols exist in the app, so that "hidden" and "not received" are not two different settings.

## Acceptance criteria
- AC 1. The EA reports every symbol its broker offers (MT4's full symbol list, not only Market Watch) to the backend, when it starts and when that list changes.
- AC 2. Settings › Visibility lists, per broker, only the crosses of AUD, EUR, NZD, USD, CAD, GBP and JPY that the broker offers (up to 21 pairs; a broker suffix such as `EURUSD.r` is kept), in alphabetical order on a 3-column grid, each one **on** or **off**: on = the EA sends it and it shows in the app; off = the EA does not send it and it does not show anywhere.
- AC 3. WHEN I save a change THEN the backend writes that broker's `bridge/config.json` with the on symbols (keeping `brokerName` and any other field as it is), and the EA picks it up by itself within a few seconds, without restarting MT4.
- AC 4. `brokerName` is never edited from the frontend.
- AC 5. A symbol with open positions or pending orders on that broker cannot be turned off; the screen says why.
- AC 6. Hiding a whole broker (Settings › Visibility) keeps working as today.
- AC 7. The old "hidden symbol" setting disappears: on rollout, the symbols hidden today are turned off in their broker's `config.json` and `hiddenSymbols` is cleared, so nothing that was hidden reappears.
- AC 8. A broker whose EA has not reported its symbols yet (old EA, terminal closed) shows its current `config.json` symbols as on, and the list of the rest is unavailable until the EA reports it.
- AC 9. WHEN `config.json` cannot be written (missing folder, file locked) THEN the save fails with a clear message and nothing changes.
- AC 10. WHEN a symbol is turned on THEN its candle history is synced automatically once the EA streams it, on every timeframe of Settings › Data (M5, M15, H1, H4, D1) with the default target, only for that symbol (the broker's other symbols are not touched); its progress shows in Settings › Data like a manual sync.
- AC 11. WHEN a symbol is turned off THEN its stored candles are kept (turning it on again re-syncs it).

- AC 12. (added during task 7) Turning a pair on shows its progress: Settings › Data marks the broker "waiting for the EA to stream it", then "history requested", the running sync and done, or an error when the EA sends no ticks or is disconnected; Settings › Visibility shows the same under the broker, linking to Data. Candles at time 0 (MT4 before the history of a new pair is loaded) are never stored.

## Out of scope
- Editing `brokerName` or adding/removing brokers (`brokers.json`).
- Market Watch management in MT4 beyond what the EA needs to stream a symbol.
