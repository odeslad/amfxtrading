# 045 — System status indicator · Verification

## Task 1 — [backend] Liveness keeps the pipe loss time and the EA status

- **Mechanism:** vitest + `npm run build`
- **Commands:** `npx vitest run src/store/liveness.test.ts src/bridge/pipe-reader.test.ts` · `npm run build` · `npx vitest run`
- **Outcome:** ✅ pass
- **Evidence:** 13 tests pass in the two files (EA status stored and validated, unknown pipe message type ignored without a warning, pipe-lost time set on the first loss, kept across `listening` → `error` and cleared on reconnection, EA status forgotten with the pipe); `tsc` clean; full suite 165 tests in 18 files.
- **Notes:** a broker whose pipe is enabled counts as lost from the backend start until its EA connects. `GET /health` returns the same fields as before.
- **Est vs Actual:** 1 SP vs 0.75 SP

## Task 2 — [backend] Server load readings

- **Mechanism:** vitest + `npm run build`
- **Commands:** `npx vitest run src/services/server-load.test.ts` · `npm run build`
- **Outcome:** ✅ pass
- **Evidence:** 5 tests pass (percentage from two fabricated readings, 0–100 bounds with inconsistent counters, no figure when no time elapsed, real readings of this machine coherent); `tsc` clean.
- **Notes:** the comparison with Task Manager is part of task 4, when the figure is first exposed.
- **Est vs Actual:** 0.75 SP vs 0.5 SP

## Task 3 — [backend] Reduction to one level

- **Mechanism:** vitest + `npm run build`
- **Commands:** `npx vitest run src/services/system-status.test.ts` · `npm run build`
- **Outcome:** ✅ pass
- **Evidence:** 16 tests pass: the four broker states, one case per row of the level table (broker state, tick delay 5 s / 60 s, CPU 85 % over 15 s / 95 % over 60 s, free memory 10 % / 5 %), the worst rule wins, a single spike does not change the level in either direction, the level changes after two samples, a hidden broker is left out of the level and of the list; `tsc` clean.
- **Notes:** all thresholds are in the `THRESHOLDS` constant. The two-sample rule applies to the level; the broker list always shows the current state. A CPU average only counts once its whole window has been sampled.
- **Est vs Actual:** 1.5 SP vs 1 SP
