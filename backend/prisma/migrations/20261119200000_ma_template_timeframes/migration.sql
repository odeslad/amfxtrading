-- Spec 052: a template can be assigned to a broker on one timeframe; '' = every timeframe.
ALTER TABLE "ma_template_brokers" ADD COLUMN "timeframe" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ma_template_brokers" DROP CONSTRAINT "ma_template_brokers_pkey";
ALTER TABLE "ma_template_brokers" ADD CONSTRAINT "ma_template_brokers_pkey" PRIMARY KEY ("userId", "broker", "timeframe");
