# 046 — VPS performance comparison · Design

## Approach

Both servers run the code of `4e8022c` (EA 3.15, backend and frontend without specs 044 and 045) with their 13 brokers, as in normal operation. Nothing is stopped and nothing is reconfigured: the test only reads. The same measurement is launched on both servers at the same moment, several times, and the figures are compared.

No application code changes. The only new files are the measurement scripts under `infra/scripts/perf/`, copied to both servers by hand (the old server no longer receives deploys).

### Alternatives considered

| Option | For | Against |
|---|---|---|
| **All 13 brokers at once** (chosen) | Real load; no account is stopped; nothing is touched on the servers; done in about an hour | The machine speed test runs with the servers loaded, not idle |
| Demo alone, then one broker more at each step | Machine speed measured almost idle; shows how each server degrades as load grows | Real accounts out of the app on both servers during the test; the broker list is edited and the backend restarted at each step; several hours |

The second option stays available as a later decision if the result with all the brokers is not conclusive.

## What is measured

One script, `measure.ps1`, run on both servers at the same moment, with a 60-second window:

| Figure | How | Why |
|---|---|---|
| Total CPU | CPU time consumed by all processes during the window, over the 4 logical cores | The symptom the operator sees |
| CPU per process | Same, per terminal (with its broker name), backend, database, antivirus, rest | Same broker, same account, same ticks on both servers: the CPU time each terminal needs for the same work is the fairest comparison |
| Free memory | Reading at the start and at the end of the window | The old server's weak point |
| Tick delay | The local `/health` is read twice per second during the window; per broker: share of readings where the last tick is 1 second old or more, and the worst reading | Ticks are sent every 100 ms, so with a healthy server the age is always 0 |
| Machine speed | `bench.js`: a fixed calculation on one thread (5 runs) and the same on 4 threads at once | One thread = speed of a core; four at once = whether the 4 cores are really available |

Two limits, stated in the report:

- `/health` gives the tick age in whole seconds, so delays under one second are not seen. It is enough to tell "ticks arrive on time" from "ticks arrive late", which is the reported problem.
- The machine speed test runs while the 13 terminals are working. With the same software and the same brokers the load is the same on both, so the comparison stays fair, but the figure is "speed left for a new task", not "speed of an empty machine". The best of the 5 runs is the closest to the real speed of a core.

### Differences that are not the machine

Recorded once on both servers, because they can change the result without being hardware: Windows antivirus (running on the new server, absent in the first sample of the old one), Windows power plan, MT4 build, charts open and bars kept per terminal, and other programs open in the desktop session. A difference found here is reported; whether to equalise it and measure again is decided with the operator.

The old server has its alerts switched off (`FEATURE_ALERTS=false`) and nobody uses its app; the new one evaluates alerts and serves the users. This difference is known and small, and is named in the report.

## Sequence

1. **Check** (AC 1, AC 2): EA version loaded by every terminal (its log), backend commit, the 13 brokers connected on both servers.
2. **Differences** (AC 5): record the list above on both servers.
3. **Measurements** (AC 3, AC 4): at least 3 rounds, at least 10 minutes apart, with the market open; each round is `measure.ps1` on both servers at the same moment, then `bench.js` on both.
4. Figures go to `verification.md` after each round.
5. **Report** (AC 6, AC 7) under `reports/`.

## How the verdict is reached

- **Machine speed**: if the new server is clearly slower on the speed test in every round, the machine is slower.
- **Same work, CPU needed**: for each broker, CPU of its terminal on the new server divided by the same on the old one. If that ratio matches the machine speed ratio, the machine explains the whole difference. If it is clearly higher, something else on the new server costs CPU and is looked for among the recorded differences.
- **Against the first sample**: with different EA versions the 13 terminals needed 3.3 times more CPU on the new server. Whatever part of that disappears with the same EA on both was caused by the software (EA 3.16, spec 044), and goes to the list of changes to review.

The verdict can be mixed (a slower machine and heavier software); the report then says how much comes from each.

## Files

- `infra/scripts/perf/measure.ps1` — the 60-second measurement, output as one line of JSON per run.
- `infra/scripts/perf/bench.js` — the speed test.
- `reports/2026-11-vps-performance.md` — the final report.

No database change. No dependency added. No change to the EA ↔ backend contract.

## Risks

- **`master` stays on the old code** during the test: nothing may be pushed to `ea/`, `backend/` or `frontend/` until the verdict, or the two servers stop being equal. Users of the app do not have the system status indicator (spec 045) meanwhile.
- **The speed test adds load** for a few seconds (up to 4 threads) on servers that are working, the new one already near its limit: ticks may arrive late during those seconds. On the old server, with its history of crashes under memory peaks, the test uses almost no memory.
- **One sample is not a measurement**: market activity changes minute by minute. That is why both servers are measured at the same moment and at least three times.
