# 046 — VPS performance comparison · Tasks

Each task is one conventional commit. No application code changes: nothing under `ea/`, `backend/` or `frontend/` is touched, so no deploy pipeline runs (they only react to those folders). The scripts are copied to both servers by hand. The usual production gate becomes the operator's review of the report and its verdict.

- [x] 1. [infra] Add `infra/scripts/perf/measure.ps1` (60-second window: total CPU, CPU per process with the broker of each terminal, free memory, tick delay per broker from the local `/health`; one line of JSON per run) and `infra/scripts/perf/bench.js` (fixed calculation on one thread, 5 runs, and on 4 threads at once) · **Verify:** manual — both scripts run on both servers and return complete figures for the 13 brokers; the output is recorded in `verification.md` · **Est:** 1.5 SP
- [ ] 2. [infra] Check that both servers are equal (EA version loaded by every terminal, backend commit, 13 brokers connected) and record the differences that are not hardware (antivirus, power plan, MT4 build, charts and bars per terminal, other programs open) · **Verify:** manual — table of both servers in `verification.md`; any difference is reported to the operator before measuring (AC 1, AC 2, AC 5) · **Est:** 1 SP
- [ ] 3. [infra] Take at least 3 rounds of measurements on both servers at the same moment, at least 10 minutes apart, with the market open · **Verify:** manual — every reading of every round in `verification.md`, both servers side by side (AC 3, AC 4, AC 8) · **Est:** 1.5 SP
- [ ] 4. [reports] Write `reports/2026-11-vps-performance.md`: figures, how they were taken, limits of the measurement, verdict (machine, software or part of each) and, if software takes part, the changes since `4e8022c` that can affect performance · **Verify:** manual — every figure of the report matches `verification.md` (AC 6, AC 7) · **Est:** 1.5 SP
- [ ] 5. [specs] The operator reviews the report and its verdict and decides the next move (claim to IONOS, follow-up spec on the software, or a further test with fewer brokers) · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 6. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 6.25 SP
