-- Spec 052: moving average templates (EMA / SMA) and the template of each broker.
CREATE TABLE "ma_templates" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "averages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ma_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ma_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ma_templates_userId_idx" ON "ma_templates"("userId");

CREATE TABLE "ma_template_brokers" (
    "userId" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,

    CONSTRAINT "ma_template_brokers_pkey" PRIMARY KEY ("userId", "broker"),
    CONSTRAINT "ma_template_brokers_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ma_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Each user's EMA list becomes their default template, so the charts look the same.
INSERT INTO "ma_templates" ("userId", "name", "isDefault", "averages")
SELECT ci."userId",
       'Default',
       true,
       COALESCE((SELECT jsonb_agg(e || '{"type":"ema"}'::jsonb) FROM jsonb_array_elements(ci."emas"::jsonb) AS e), '[]'::jsonb)
FROM "chart_indicators" ci;
