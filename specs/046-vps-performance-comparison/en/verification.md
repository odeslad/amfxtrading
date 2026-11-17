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

## Task 2 — both servers equal

- **Mechanism:** manual — state of both servers read on the servers themselves (2026-11-17, 11:35–11:45 UTC); differences reported to the operator before measuring.
- **Outcome:** ✅ pass with two differences accepted by the operator on 2026-11-17 as not relevant: the two brokers not connected on the new server and the EA files of the old Demo terminal. The comparison terminal by terminal uses the other brokers.
- **Est vs Actual:** 1 SP vs 1.5 SP — more differences than expected had to be found and equalised.

| | New VPS | Old VPS | Equal |
|---|---|---|---|
| Backend and frontend source against `4e8022c` | no difference | no difference | yes |
| EA source | compiled on 2026-11-17 from the code of `4e8022c` | compiled on 2026-10-29 (last EA change before `4e8022c`) | yes |
| EA banner in every terminal | State v3.13 · Commands v2.22 | State v3.13 · Commands v2.22 | yes |
| MT4 build | 1492 | 1492 | yes |
| Windows power plan | Balanced | Balanced | yes |
| Symbols per broker | same lists | same lists | yes |
| `solidary isa` | no EA on its charts | no EA on its charts | yes (12 active brokers on each) |
| Charts open per terminal | Demo 9, mick 4, II 4, manu 3, FTMO 3, solidary 3 → **2 on all after the operator closed the extra ones** | 2 on all | yes, since ~11:40 UTC |
| Real-time antivirus | on → **switched off for the test** | off | yes, since ~11:40 UTC |
| Alerts (`FEATURE_ALERTS`) | true → **set to false for the test**, backend restarted | false | yes, since ~11:44 UTC |
| `solidary jessy`, `solidary aymerich` | not connected since a restart at 11:12 UTC (aymerich: the State EA is no longer on its chart) | connected | no (accepted) |
| EA files of the Demo terminal | deployed on 2026-11-17 | compiled by hand on 2026-11-16 12:51, different from the other 12 terminals | not known (accepted) |
| History on disk of the Demo terminal | 139 MB | 15 MB | no (recorded; not changed) |

**To restore on the new server when the test ends:** real-time antivirus on (`Set-MpPreference -DisableRealtimeMonitoring $false`) and `FEATURE_ALERTS=true` in `backend/.env` plus a backend restart.
