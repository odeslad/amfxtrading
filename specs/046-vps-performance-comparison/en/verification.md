# 046 — VPS performance comparison · Verification

## Task 1 — measurement scripts

- **Mechanism:** manual — both scripts run on both servers and return complete figures for the 13 brokers.
- **Commands:** `scp measure.ps1 bench.js <server>:` · `powershell -File measure.ps1` on both servers at the same moment (2026-11-17 11:32:14 UTC) · `node bench.js` on both right after.
- **Outcome:** ✅ pass — both scripts returned one line of JSON on each server, with the 13 terminals named by broker, the 13 brokers in the tick readings (119 readings each, no failed read of `/health`) and the five single-thread runs plus the four parallel ones.
- **Est vs Actual:** 1.5 SP vs 1 SP.

Trial run (not a round of the test: the equality of both servers is checked in task 2):

| | New VPS | Old VPS |
|---|---|---|
| Total CPU | 49.8 % | 28.2 % |
| 13 terminals (100 = one core) | 159.7 | 77.2 |
| Backend and other Node processes | 14.5 | 9.6 |
| Database | 3.1 | 2.3 |
| Antivirus | 1.0 | 0 |
| Rest | 21.0 | 23.7 |
| Free memory | 4003 MB | 1248 MB |
| Brokers with late ticks (1 s or more) | 6 of 13 (worst: Demo 15.1 % of readings, FTMO 11.8 %, up to 2 s) | 0 of 13 |
| Brokers with no tick at all | 3 (solidary aymerich, solidary isa, solidary jessy) | 1 (solidary isa) |
| Speed, one thread (best of 5) | 1529 ms | 1034 ms |
| Speed, four threads at once (total time) | 1857 ms | 1366 ms |

To look at in task 2: why three brokers of the new server and one of the old one gave no tick during the window.
