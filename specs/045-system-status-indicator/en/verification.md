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

## Task 4 — [backend] Delivery of the system status

- **Mechanism:** vitest + `npm run build` + manual
- **Commands:** `npx vitest run src/routes/status.test.ts` (also with `DATABASE_URL`, `JWT_SECRET` and `BROKERS_FILE` unset, as in CI) · `npm run lint` · `npx tsc --noEmit` · `npx vitest run` · a 20 s script printing `cpuPercent` every 5 s next to Windows' own counter (`Win32_PerfFormattedData_PerfOS_Processor`, `_Total`)
- **Outcome:** ✅ pass (automatic part and CPU comparison) · 🕐 the running local backend is checked in task 6
- **Evidence:** 3 tests pass over a real HTTP server (401 without cookie; with cookie the object has `level`, `server`, `brokers`, `at`, the visible broker and not the hidden one; the route serves the last sample taken); lint and `tsc` clean; full suite 188 of 189: the one failure is the known flaky `pipe-reader.test.ts` (real named pipe with 80 ms waits, fails under parallel load, skipped in CI), which passes alone three times in a row. CPU: backend 72 % in four consecutive samples, Windows 71 %; free memory 32,304 MB against Windows' 32,298 MB.
- **Deviation:** the task asked to see `/status` on a local backend with the flags off. That needs the database tunnel and the whole local stack, which task 6 starts anyway to check the light, so it is verified there. The route test mounts the router with the real session check instead of importing `app.ts`, because `app.ts` needs the server environment that CI does not have.
- **Est vs Actual:** 1.25 SP vs 1.25 SP

## Task 5 — [frontend] `--muted-strong` and `useSystemStatus`

- **Mechanism:** `npm run build`
- **Commands:** `npm run build` · `npm run lint`
- **Outcome:** ✅ pass
- **Evidence:** build and lint clean.
- **Notes:** the hook is not used by any screen yet (task 6). The loss of connection is decided by silence alone: no `system` message nor `/status` answer for 20 s — a closed WebSocket is covered by the same rule, so `lib/ws.ts` is not touched.
- **Est vs Actual:** 0.75 SP vs 0.5 SP

## Task 6 — [frontend] Light and tooltip in the footer

- **Mechanism:** `npm run build` + manual
- **Commands:** `npm run build` · `npm run lint` (frontend) · `npx vitest run src/services/system-status.test.ts src/routes/status.test.ts` · `npx tsc --noEmit` · `npm run lint` (backend) · local stack: database tunnel on 5434, backend on 3001 with `FEATURE_PIPE=true` and five test brokers, Vite on 5175, four fake terminals writing to the pipes
- **Outcome:** ✅ build, lint and backend tests · ✅ `/status` on the running local backend (pending from task 4) · 🕐 the look of the light and tooltip, pending the user's review on the local app
- **Evidence:** frontend build and lint clean; backend 19 tests pass, `tsc` and lint clean. Local backend: `GET /status` answers 401 without cookie and, with a session, `warn` with `local-darwinex` and `local-axi` connected, `local-demo` loading "2 of 75", `local-ftmo` restarting (70 s without pipe) and `local-solidary` connected with an 11 s tick delay; the same object is served through the Vite proxy.
- **Deviations from the design, agreed here:**
  - Backend: each broker now carries its own `level` (`ok` / `warn` / `bad`), so the frontend knows which brokers need attention without repeating the thresholds. Separate backend commit; design and architecture docs updated.
  - The CPU figure is not tinted (in the orange artboard it was): tinting it would need the CPU thresholds in the frontend.
  - A broker without pipe shows "—" as tick delay, and the time it has been down goes in its state label ("Restarting · 38 s").
- **Est vs Actual:** 2 SP vs 2 SP (so far)
