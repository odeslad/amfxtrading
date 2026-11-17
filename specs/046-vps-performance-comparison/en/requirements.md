# 046 — VPS performance comparison

> Status: **draft**
> Related: [043 · VPS migration](../../043-vps-migration/en/requirements.md)

## Context

The old VPS (4 vCPU, 4 GB RAM, 120 GB disk) suffered memory overflows and arbitrary reboots, which forced a move to a new one (4 vCPU, 8 GB RAM, 240 GB disk). After the migration the new server performs worse than the old one: the CPU is saturated and ticks arrive late, even though it has the same number of processors, twice the memory and twice the disk. At the time of the migration the two servers did not run the same software (the new one also carried specs 044 and 045), so today nobody can tell whether the cause is the machine or the software. This spec runs the same software and the same load on both servers (the 13 brokers at once, as in normal operation) and measures them side by side, to reach a verdict: the server (claim to IONOS) or the software (review of the changes).

First measurements taken on 2026-11-17, before equalising the software (one 10-second sample, 13 terminals on each server):

| | New VPS | Old VPS |
|---|---|---|
| Processor | 4 logical cores, 2000 MHz reported | 4 logical cores, 2596 MHz reported |
| Total CPU in use | 66 % | 29 % |
| 13 MT4 terminals (100 = one full core) | 196 | 60 |
| Backend | 28 | 17 |
| Windows antivirus | 7.5 | not present |
| Single-thread speed test (lower is better) | 1441 ms (server under load) | 1034 ms |

Already done on 2026-11-17: the code of the old server (`4e8022c`: EA 3.15, backend and frontend without specs 044 and 045) was restored on `master` (commits `56f7180`, `8ec9d22`, `89adb64`) and deployed on the new server.

## Affected layers

- infra (measurement scripts, the final report)
- ea · backend · frontend: only the rollback already done; no new code

## User stories

- As the operator, I want both servers running exactly the same EA, backend and frontend, so that any difference in performance can only come from the machine.
- As the operator, I want the test done with all the brokers running at once on both servers, so that it reflects the real load and no account has to be stopped.
- As the operator, I want the same measurements taken the same way and at the same moment on both servers, so that the comparison is fair and repeatable.
- As the operator, I want a written verdict with the figures, so that I can either claim to IONOS with evidence or know that the software has to be reviewed.

## Acceptance criteria

- AC 1. WHEN the test starts THEN both servers run the same EA version, the same backend code and the same frontend code, and this is checked on the servers themselves (EA version loaded by every terminal, backend commit), not assumed.
- AC 2. WHEN the test starts THEN both servers have the same 13 brokers running and connected, with the same accounts, and this is checked with the health of every broker.
- AC 3. WHEN a measurement is taken THEN the same figures are recorded on both servers over the same time window: total CPU, CPU per process (each terminal with its broker, backend, database, antivirus), free memory, tick delay per broker, and the machine speed test.
- AC 4. WHEN a measurement is taken THEN it is repeated at least three times at different moments with the market open, and the report shows every reading, not only the average.
- AC 5. WHEN the servers are compared THEN the differences that are not hardware are recorded too (antivirus, Windows power plan, MT4 build, charts open and bars kept per terminal, other programs open), so that they are not mistaken for a slower machine.
- AC 6. WHEN the measurements are done THEN a report under `reports/` contains every figure, both servers side by side, and a verdict: with the same software and the same load, the new server is slower (evidence for IONOS), equal or faster (the cause is the software).
- AC 7. WHEN the verdict is "software" THEN the report lists the changes made since `4e8022c` that can affect performance, as the starting point of a follow-up spec.
- AC 8. WHILE the test lasts THEN no account is stopped on either server and the app keeps working as usual on the new one; nothing is pushed to `ea/`, `backend/` or `frontend/`, so that both servers stay equal.

## Out of scope

- Tests with fewer brokers (one alone, or adding them one by one): only if the result with all of them is not conclusive, as a later decision.
- Fixing any performance problem found in the software (follow-up spec).
- Putting specs 044 and 045 back on `master` (decided after the verdict).
- The claim to IONOS itself; this spec only produces the evidence.
- Changes to the hardware plan or a move to another provider.
- Decommissioning the old server (spec 043).
