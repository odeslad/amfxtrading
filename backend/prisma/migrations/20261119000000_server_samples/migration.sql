-- Spec 051: one row per minute of the server's CPU and memory, kept 7 days.
CREATE TABLE "server_samples" (
    "time" TIMESTAMP(3) NOT NULL,
    "cpu" REAL NOT NULL,
    "memUsedMb" INTEGER NOT NULL,
    "memTotalMb" INTEGER NOT NULL,
    "pageFileMb" INTEGER,
    "terminals" SMALLINT,

    CONSTRAINT "server_samples_pkey" PRIMARY KEY ("time")
);
