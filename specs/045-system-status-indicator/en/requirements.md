# 045 — System status indicator

> Status: **draft**

## Context

The app has no place that says whether the system behind it is healthy. On 2026-11-17, after an EA deploy, the terminals spent about twelve minutes reloading their candle history and the ticks of the brokers that export 15 symbols arrived 4 to 21 seconds late; nothing in the app showed it. The backend already knows part of the picture (`GET /health`: per broker, pipe state and age of the last tick and of the last file sync) but it is not shown anywhere, it does not include the server's load, and it does not know that a terminal is loading history. The footer of the app today shows only the product name and the build numbers.

## Affected layers

- backend
- frontend
- ea

## User stories

- As the operator, I want a small light in the footer that is green, orange or red, so that I know at a glance whether I can trust what the app shows right now.
- As the operator, I want to see why it is not green by hovering it (or tapping it on the phone), so that I know whether to wait, and for what.
- As the operator, I want the brokers I have hidden in Settings left out of that light, so that an account I keep switched off does not turn it orange for ever.

## Acceptance criteria

- AC 1. WHEN the app is open THEN the footer shows a status light, and on mobile, where the footer is not visible, the same light is reachable from the layout that is.
- AC 2. WHEN everything is normal THEN the light is **green**: the backend answers, every visible broker is connected, its ticks are current, no terminal is loading history, and the server is not under pressure.
- AC 3. WHEN the system works but something is degraded THEN the light is **orange**: a terminal is restarting or loading its history, the ticks of a visible broker arrive late, or the server's CPU or memory stay above their warning level.
- AC 4. WHEN what the app shows cannot be trusted THEN the light is **red**: the app has lost its connection to the backend, a visible broker has been disconnected beyond a grace period, the ticks of a visible broker are far behind, or the server is beyond its critical level.
- AC 5. WHEN the user hovers the light (desktop) or taps it (mobile) THEN a tooltip shows, in plain words: one line with the overall situation and its cause, the server's CPU and free memory, and for each visible broker its state (connected, loading history with its progress, restarting, disconnected) and the delay of its ticks.
- AC 6. WHEN a terminal is loading its candle history THEN the tooltip shows how far it is ("42 of 75") and the light stays orange until it finishes.
- AC 7. WHEN a broker is hidden in Settings (`hiddenBrokers`) THEN it does not count for the colour and is not listed in the tooltip.
- AC 8. WHEN the market is closed THEN the light stays green as long as the terminals are connected: prices that do not move are not a fault.
- AC 9. WHEN the situation changes THEN the light and the tooltip follow it within ten seconds, without reloading the page, and a brief spike (one sample) does not change the colour.
- AC 10. WHEN the status is being collected and sent THEN the cost is negligible: no visible effect on tick delivery, chart rendering or server load.
- AC 11. WHEN the thresholds need tuning THEN they live in one place in the backend, documented, not scattered through the code.

## Out of scope

- Removing the tick delay while a terminal loads its history (the EA writing full histories in small pieces). The light makes it visible; fixing it is a separate spec.
- Notifications or alerts when the status changes.
- A history or chart of past statuses.
- Showing the status of the old VPS.
- Any action from the tooltip (restarting a terminal, etc.).
