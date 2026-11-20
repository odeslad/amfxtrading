-- Spec 054: quick order settings for the chart context menu; null = not configured.
ALTER TABLE "settings_display" ADD COLUMN "quickOrders" JSONB;
