# 045 — System status indicator · Verification

## Task 1 — [backend] Liveness keeps the pipe loss time and the EA status

- **Mechanism:** vitest + `npm run build`
- **Commands:** `npx vitest run src/store/liveness.test.ts src/bridge/pipe-reader.test.ts` · `npm run build` · `npx vitest run`
- **Outcome:** ✅ pass
- **Evidence:** 13 tests pass in the two files (EA status stored and validated, unknown pipe message type ignored without a warning, pipe-lost time set on the first loss, kept across `listening` → `error` and cleared on reconnection, EA status forgotten with the pipe); `tsc` clean; full suite 165 tests in 18 files.
- **Notes:** a broker whose pipe is enabled counts as lost from the backend start until its EA connects. `GET /health` returns the same fields as before.
- **Est vs Actual:** 1 SP vs 0.75 SP
