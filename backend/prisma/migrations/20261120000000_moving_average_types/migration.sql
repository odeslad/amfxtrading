-- Spec 053: each side of a cross is an EMA or an SMA; existing rows stay EMA against EMA.
ALTER TABLE "ema_cross_alerts" ADD COLUMN "fastType" TEXT NOT NULL DEFAULT 'ema', ADD COLUMN "slowType" TEXT NOT NULL DEFAULT 'ema';
ALTER TABLE "ema_notifications" ADD COLUMN "fastType" TEXT NOT NULL DEFAULT 'ema', ADD COLUMN "slowType" TEXT NOT NULL DEFAULT 'ema';
ALTER TABLE "settings_display" ADD COLUMN "emaTradesFastType" TEXT NOT NULL DEFAULT 'ema', ADD COLUMN "emaTradesSlowType" TEXT NOT NULL DEFAULT 'ema';
