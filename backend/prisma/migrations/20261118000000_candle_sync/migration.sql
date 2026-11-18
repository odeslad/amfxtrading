-- Spec 049: the current candles table has damaged pages. It is set aside as candles_legacy
-- and a new, empty candles table is filled pair by pair by the manual sync of Settings › Data.

ALTER TABLE "candles" RENAME TO "candles_legacy";
ALTER TABLE "candles_legacy" RENAME CONSTRAINT "candles_pkey" TO "candles_legacy_pkey";

CREATE TABLE "candles" (
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("broker", "symbol", "timeframe", "time")
);

CREATE TABLE "candle_syncs" (
    "broker" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 10000,
    "candleCount" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'idle',
    "detail" TEXT,
    "requestId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candle_syncs_pkey" PRIMARY KEY ("broker", "timeframe")
);
