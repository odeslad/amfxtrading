-- Spec 063: named split layouts per user (broker, pair and timeframe of each chart).
-- CreateTable
CREATE TABLE "split_layouts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "leftBroker" TEXT NOT NULL,
    "leftSymbol" TEXT NOT NULL,
    "leftTimeframe" TEXT NOT NULL,
    "rightBroker" TEXT NOT NULL,
    "rightSymbol" TEXT NOT NULL,
    "rightTimeframe" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "split_layouts_userId_idx" ON "split_layouts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "split_layouts_userId_name_key" ON "split_layouts"("userId", "name");

-- AddForeignKey
ALTER TABLE "split_layouts" ADD CONSTRAINT "split_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

