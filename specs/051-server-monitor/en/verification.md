# 051 — Server monitor in Settings · Verification

## Task 1 · [db] Table server_samples

- **Mechanism:** `prisma validate` + `prisma generate` + `npm run build`; `prisma migrate diff` from the production schema (read through the SSH tunnel to the XL+, nothing written) to the new datamodel.
- **Steps:** migration `20261119000000_server_samples` (`time` timestamp PK, `cpu` real, `memUsedMb` and `memTotalMb` int, `pageFileMb` int null, `terminals` smallint null); Prisma model `ServerSample`.
- **Outcome:** ✅ schema valid, client generated, build clean. The diff from production to the datamodel is exactly the `CREATE TABLE "server_samples"` of the migration, so it is empty once the migration runs with the backend deploy.
- **Est vs Actual:** 0.5 SP · 0.25 SP.
