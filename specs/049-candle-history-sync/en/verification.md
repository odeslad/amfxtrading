# 049 — Candle history sync from Settings · Verification

## Task 1 · [ea] Spike: history download on the Demo terminal

- **Mechanism:** manual, throwaway script `SyncSpike049` dropped by the operator on the Demo terminal (2026-11-18).
- **Runs:**
  1. `ChartOpen` + `ChartNavigate(CHART_BEGIN)`: EURUSD M5 2 621 → 2 621, D1 2 050 → 2 050; charts closed. No download.
  2. Same plus the Home key (`PostMessageW`): stopped by "DLL is not allowed" (the script needs *Allow DLL imports*).
  3. Home key with DLL allowed: M5 10 341 → 10 341, D1 2 875 → 2 875. The bars before the run came from the operator scrolling by hand with the left arrow.
  4. Chart brought to front + PageUp, Home and Left keys, 30 s patience: the charts visibly scroll back, but M5 24 869 → 24 869 and later 33 950 → 33 950 (again loaded by hand before each run).
- **Outcome:** inconclusive as a script — every growth came from manual scrolling, so the broker does serve more history but a script blocking in `Sleep` did not get it. Decision of the operator: implement it exactly as spec 044 did (archive commit `a86b7fb`), where the same terminal went from 2 065 to 65 425 bars on EURUSD M15: the EA, on each timer tick, opens the temporary chart, `ChartNavigate(CHART_BEGIN)` + Home by `PostMessageW` to `CHART_WINDOW_HANDLE`, returns, and decides on the next ticks (wait while `ERR_HISTORY_UPDATING` or new bars keep arriving; give up after a quiet period or a maximum per chart). Proof moves to task 6 on the Demo terminal.
- **Note:** the script always probed its `SPIKE_SYMBOL` input (EURUSD), whatever chart it was dropped on (GBPCHF, USDCNH); this was not explained to the operator. EURUSD M5 grew between runs 3 → 4 → 5 (10 341 → 24 869 → 33 950) while the operator worked on other charts: the blocks the keys requested arrived after the script had given up, which points to a wait too short, not to a wrong method.
- **Design impact:** `HttpBridgeCommands` needs `user32.dll` (`PostMessageW`), so *Allow DLL imports* must be on for that EA too (it already is for `HttpBridgeState`, which uses `kernel32.dll` for the pipe).
- Spike files removed from the Demo terminal.
- **Est vs Actual:** 1 SP · 1 SP.
